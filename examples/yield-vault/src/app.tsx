import React, { ReactElement, useCallback, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Comlink from 'comlink';
import { Verifier as TVerifier, CrateLogFilter } from 'tlsn-wasm';
import ConfettiExplosion from 'react-confetti-explosion';
import ScrollToBottom from 'react-scroll-to-bottom';
import { ethers } from 'ethers';
import './app.scss';

import {
  submitProof,
  CLAIM_TYPES,
  MANTLE_SEPOLIA_CONFIG,
  DEFAULT_RELAYER_URL,
  DEFAULT_PROVER_URL,
  MAX_SENT_DATA,
  MAX_RECV_DATA,
  type VerifiedTranscript,
  type SubmitResult,
} from '@zk-rwa-kit/client-sdk';

const worker = Comlink.wrap(
  new Worker(new URL('./worker.ts', import.meta.url))
);
const { init, Verifier, getBufferedLogs }: any = worker;

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);

const proverProxyUrl = process.env.PROVER_PROXY_URL || DEFAULT_PROVER_URL;
const relayerUrl = process.env.RELAYER_URL || DEFAULT_RELAYER_URL;
const chainExplorerUrl =
  process.env.CHAIN_EXPLORER_URL || MANTLE_SEPOLIA_CONFIG.explorerUrl;

const MUSDY_ADDRESS =
  process.env.MUSDY_ADDRESS || '0x1AFF98321D111A555F56FE977B3cBc01704FECBF';
const MYIELD_VAULT_ADDRESS =
  process.env.MYIELD_VAULT_ADDRESS ||
  '0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170';
const IDENTITY_REGISTRY_ADDRESS =
  process.env.IDENTITY_REGISTRY_ADDRESS ||
  '0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12';

const MUSDY_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

const MYIELD_VAULT_ABI = [
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
  'function isEligible(address user) view returns (bool)',
  'function totalAssets() view returns (uint256)',
];

const IDENTITY_REGISTRY_ABI = [
  'function isVerified(address wallet, bytes32 claimType) view returns (bool)',
];

let capturedLogs: string[] = [];
const originalLog = console.log;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function safeNum(value: string) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtCompact(value: string, maxFrac = 4) {
  const n = safeNum(value);
  if (!Number.isFinite(n)) return '0';
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: n >= 1000 ? 2 : maxFrac,
  }).format(n);
}

function App(): ReactElement {
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<
    'init' | 'connect' | 'prove' | 'submit' | 'done' | 'vault'
  >('init');
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [vaultShares, setVaultShares] = useState<string>('0');
  const [vaultTotalAssets, setVaultTotalAssets] = useState<string>('0');
  const [isVerifiedOnChain, setIsVerifiedOnChain] = useState(false);
  const [vaultEligible, setVaultEligible] = useState(false);
  const [depositAmount, setDepositAmount] = useState('100');
  const [withdrawAmount, setWithdrawAmount] = useState('50');
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [vaultTab, setVaultTab] = useState<'deposit' | 'withdraw'>('deposit');
  const [devConsoleOpen, setDevConsoleOpen] = useState(false);

  const stepIndex = useMemo(() => {
    const steps = ['connect', 'prove', 'submit', 'done', 'vault'] as const;
    return Math.max(0, steps.indexOf(step as any));
  }, [step]);

  const vaultApy = useMemo(() => 5.0, []);

  React.useEffect(() => {
    const addLogMessage = (message: string) => {
      const timestamp = new Date().toLocaleTimeString();
      const timestampedMessage = `[${timestamp}] ${message}`;
      capturedLogs.push(timestampedMessage);
      setConsoleMessages([...capturedLogs]);
    };

    console.log = (...args) => {
      addLogMessage(args.join(' '));
      originalLog.apply(console, args);
    };

    const pollInterval = setInterval(async () => {
      const workerLogs = await getBufferedLogs();
      workerLogs.forEach((log: string) => addLogMessage(log));
    }, 50);

    return () => {
      console.log = originalLog;
      clearInterval(pollInterval);
    };
  }, []);

  React.useEffect(() => {
    (async () => {
      const maxConcurrency = navigator.hardwareConcurrency;
      const crateFilters: CrateLogFilter[] = [
        { name: 'yamux', level: 'Info' },
        { name: 'uid_mux', level: 'Info' },
      ];

      console.log('🔧 Initializing TLSNotary WASM...');
      await init({
        loggingLevel: 'Info',
        hardwareConcurrency: maxConcurrency,
        crateFilters,
      });

      setReady(true);
      setStep('connect');
      console.log(`✅ TLSNotary initialized with ${maxConcurrency} threads`);
    })();
  }, []);

  const refreshData = useCallback(
    async (address: string, ethProvider: ethers.BrowserProvider) => {
      try {
        const mUSDY = new ethers.Contract(
          MUSDY_ADDRESS,
          MUSDY_ABI,
          ethProvider
        );
        const vault = new ethers.Contract(
          MYIELD_VAULT_ADDRESS,
          MYIELD_VAULT_ABI,
          ethProvider
        );
        const registry = new ethers.Contract(
          IDENTITY_REGISTRY_ADDRESS,
          IDENTITY_REGISTRY_ABI,
          ethProvider
        );

        const balance = await mUSDY.balanceOf(address);
        const decimals = await mUSDY.decimals();
        setTokenBalance(ethers.formatUnits(balance, decimals));

        const shares = await vault.balanceOf(address);
        setVaultShares(ethers.formatUnits(shares, 18));

        const tvl = await vault.totalAssets();
        setVaultTotalAssets(ethers.formatUnits(tvl, decimals));

        const ELIGIBLE_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('ELIGIBLE'));
        const verified = await registry.isVerified(address, ELIGIBLE_CLAIM);
        setIsVerifiedOnChain(verified);

        const eligible = await vault.isEligible(address);
        setVaultEligible(eligible);

        console.log(`💰 mUSDY: ${ethers.formatUnits(balance, decimals)}`);
        console.log(`🏦 Vault shares: ${ethers.formatUnits(shares, 18)} mYV`);
        console.log(`📊 Vault TVL: ${ethers.formatUnits(tvl, decimals)} mUSDY`);
        console.log(`✅ Eligible for vault: ${eligible}`);
      } catch (err) {
        console.log('⚠️ Could not fetch data');
      }
    },
    []
  );

  const connectWallet = useCallback(async () => {
    try {
      if (typeof (window as any).ethereum === 'undefined') {
        setError('MetaMask not installed');
        return;
      }

      console.log('🔗 Connecting wallet...');
      const ethProvider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await ethProvider.send('eth_requestAccounts', []);
      const address = accounts[0];

      setWalletAddress(address);
      setProvider(ethProvider);
      setStep('prove');
      console.log(
        `✅ Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`
      );

      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x138B' }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0x138B',
                chainName: 'Mantle Sepolia',
                nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
                rpcUrls: ['https://rpc.sepolia.mantle.xyz'],
                blockExplorerUrls: ['https://sepolia.mantlescan.xyz'],
              },
            ],
          });
        }
      }

      await refreshData(address, ethProvider);
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
    }
  }, [refreshData]);

  const generateProof = useCallback(async () => {
    setProcessing(true);
    setError(null);
    console.log('🎬 Starting eligibility verification...');

    let verifier: TVerifier;
    try {
      verifier = await new Verifier({
        max_sent_data: MAX_SENT_DATA,
        max_recv_data: MAX_RECV_DATA,
      });
      await verifier.connect(proverProxyUrl);
      console.log('✅ Connected to prover');

      await new Promise((r) => setTimeout(r, 1000));
      const result = await verifier.verify();
      console.log('✅ Verification completed!');

      const sent = result.transcript?.sent || [];
      const recv = result.transcript?.recv || [];
      const serverName = result.server_name || 'unknown';

      const recvString = bytesToUtf8(recv);
      const isEligible =
        recvString.includes('"organization"') || recvString.includes('"bank"');

      if (!isEligible) {
        setError('Could not verify eligibility');
        setProcessing(false);
        return;
      }

      console.log('🎉 User is eligible for DeFi vault!');

      const transcript: VerifiedTranscript = {
        serverName,
        sent: new Uint8Array(sent),
        received: new Uint8Array(recv),
        timestamp: Date.now(),
      };

      setVerifiedData({ transcript, eligible: isEligible });
      setStep('submit');
      setProcessing(false);
    } catch (e: any) {
      setError(`Verification failed: ${e.message}`);
      setProcessing(false);
    }
  }, []);

  const submitToChain = useCallback(async () => {
    if (!walletAddress || !verifiedData?.transcript) return;

    setProcessing(true);
    setError(null);
    console.log('📤 Submitting proof to relayer...');

    try {
      const result: SubmitResult = await submitProof(
        walletAddress,
        verifiedData.transcript,
        { relayerUrl, claimType: CLAIM_TYPES.ELIGIBLE, extractedValue: 'true' }
      );

      if (result.success && result.txHash) {
        setTxHash(result.txHash);
        setStep('done');
        setShowConfetti(true);
        console.log(`✅ Transaction submitted: ${result.txHash}`);

        setTimeout(async () => {
          if (provider && walletAddress)
            await refreshData(walletAddress, provider);
        }, 5000);
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (e: any) {
      setError(`Submission failed: ${e.message}`);
    }

    setProcessing(false);
  }, [walletAddress, verifiedData, provider, refreshData]);

  const goToVault = useCallback(async () => {
    setStep('vault');
    if (provider && walletAddress) await refreshData(walletAddress, provider);
  }, [provider, walletAddress, refreshData]);

  const requestMint = useCallback(async () => {
    if (!walletAddress) return;

    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    console.log('🪙 Requesting mUSDY for vault deposit...');

    try {
      const response = await fetch(`${relayerUrl}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: walletAddress, amount: '1000' }),
      });
      const data = await response.json();

      if (data.success) {
        setActionSuccess(`🎉 Minted 1000 mUSDY! Ready to deposit.`);
        setTimeout(() => refreshData(walletAddress, provider!), 5000);
      } else {
        throw new Error(data.error);
      }
    } catch (e: any) {
      setActionError(`❌ Mint failed: ${e.message}`);
    }

    setProcessing(false);
  }, [walletAddress, provider, refreshData]);

  const depositToVault = useCallback(async () => {
    if (!walletAddress || !provider) return;

    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    console.log(`🏦 Depositing ${depositAmount} mUSDY into vault...`);

    try {
      const signer = await provider.getSigner();
      const mUSDY = new ethers.Contract(MUSDY_ADDRESS, MUSDY_ABI, signer);
      const vault = new ethers.Contract(
        MYIELD_VAULT_ADDRESS,
        MYIELD_VAULT_ABI,
        signer
      );
      const amount = ethers.parseUnits(depositAmount, 18);

      const allowance = await mUSDY.allowance(
        walletAddress,
        MYIELD_VAULT_ADDRESS
      );
      if (allowance < amount) {
        console.log('📝 Approving vault...');
        const approveTx = await mUSDY.approve(MYIELD_VAULT_ADDRESS, amount);
        await approveTx.wait();
        console.log('✅ Approved');
      }

      const tx = await vault.deposit(amount, walletAddress);
      console.log(`📝 Deposit TX: ${tx.hash}`);
      await tx.wait();

      setActionSuccess(
        `🎉 Deposited ${depositAmount} mUSDY! You received mYV shares.`
      );
      setShowConfetti(true);
      await refreshData(walletAddress, provider);
    } catch (e: any) {
      let errorMsg = e.message || 'Deposit failed';
      if (errorMsg.includes('SessionCredential')) {
        errorMsg =
          '❌ You need a valid SessionCredential! Prove eligibility first.';
      }
      setActionError(errorMsg);
    }

    setProcessing(false);
  }, [walletAddress, provider, depositAmount, refreshData]);

  const withdrawFromVault = useCallback(async () => {
    if (!walletAddress || !provider) return;

    setProcessing(true);
    setActionError(null);
    setActionSuccess(null);
    console.log(`🏦 Withdrawing ${withdrawAmount} mUSDY from vault...`);

    try {
      const signer = await provider.getSigner();
      const vault = new ethers.Contract(
        MYIELD_VAULT_ADDRESS,
        MYIELD_VAULT_ABI,
        signer
      );
      const amount = ethers.parseUnits(withdrawAmount, 18);

      const tx = await vault.withdraw(amount, walletAddress, walletAddress);
      await tx.wait();

      setActionSuccess(`✅ Withdrew ${withdrawAmount} mUSDY from vault!`);
      await refreshData(walletAddress, provider);
    } catch (e: any) {
      setActionError(e.message || 'Withdrawal failed');
    }

    setProcessing(false);
  }, [walletAddress, provider, withdrawAmount, refreshData]);

  const explorerLinks = useMemo(() => {
    const repo = process.env.GITHUB_REPOSITORY;
    const sha = process.env.GIT_COMMIT_SHA;
    const commitUrl =
      repo && sha ? `https://github.com/${repo}/commit/${sha}` : null;
    return { commitUrl };
  }, []);

  const mintDisabledReason = useMemo(() => {
    if (processing) return 'Processing…';
    if (!isVerifiedOnChain) return 'Submit SessionCredential first';
    return null;
  }, [processing, isVerifiedOnChain]);

  return (
    <div className="min-h-screen flex flex-col bg-mantle-darker text-white">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-mantle-primary/15 blur-3xl" />
        <div className="absolute -bottom-40 left-1/4 h-[520px] w-[520px] rounded-full bg-mantle-accent/10 blur-3xl" />
        <div className="absolute top-1/4 right-0 h-[420px] w-[420px] rounded-full bg-white/5 blur-3xl" />
      </div>

      {showConfetti && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <ConfettiExplosion
            force={0.6}
            duration={4000}
            particleCount={150}
            width={1600}
          />
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-mantle-border/70 bg-mantle-dark/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-mantle-primary/30 bg-mantle-primary/15 shadow-[0_0_0_1px_rgba(101,179,174,0.08)]">
              <div className="flex h-full w-full items-center justify-center font-bold text-mantle-primary">
                M
              </div>
            </div>
            <div className="leading-tight">
              <div className="font-semibold tracking-tight">
                Mantle Yield Vault
              </div>
              <div className="text-xs text-mantle-muted">
                Compliant RWA yield • Mantle Sepolia
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-6 text-sm text-white/70 md:flex">
            <button
              className="hover:text-white transition-colors"
              onClick={() => {
                if (step !== 'vault') setStep('connect');
              }}
            >
              Onboarding
            </button>
            <button
              className="hover:text-white transition-colors"
              onClick={() => {
                if (walletAddress) setStep('vault');
              }}
            >
              Vault
            </button>
            <a
              className="hover:text-white transition-colors"
              href={chainExplorerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Explorer
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-full border border-mantle-border bg-mantle-card/60 px-3 py-1.5 text-xs text-mantle-muted">
              <span className="h-2 w-2 rounded-full bg-mantle-primary animate-pulse-slow" />
              Mantle Sepolia
            </div>

            {!walletAddress ? (
              <button
                onClick={connectWallet}
                className="rounded-xl bg-mantle-primary px-4 py-2 text-sm font-semibold text-mantle-darker shadow-sm hover:brightness-110 transition"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <div className="hidden lg:flex items-center gap-2 rounded-xl border border-mantle-border bg-mantle-card/60 px-3 py-2">
                  <div className="text-xs text-mantle-muted">mUSDY</div>
                  <div className="font-mono text-xs text-white">
                    {fmtCompact(tokenBalance, 4)}
                  </div>
                </div>
                <div className="hidden lg:flex items-center gap-2 rounded-xl border border-mantle-border bg-mantle-card/60 px-3 py-2">
                  <div className="text-xs text-mantle-muted">mYV</div>
                  <div className="font-mono text-xs text-white">
                    {fmtCompact(vaultShares, 4)}
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-full border border-mantle-border bg-mantle-card/60 px-3 py-2 text-sm">
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full',
                      isVerifiedOnChain
                        ? 'bg-green-400 animate-pulse'
                        : 'bg-amber-400'
                    )}
                  />
                  <span className="font-mono text-xs text-white/90">
                    {shortAddr(walletAddress)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-grow px-4 py-6 md:py-10">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-2xl font-semibold tracking-tight">
                {step === 'vault' ? 'Vault' : 'Onboarding'}
              </div>
              <div className="mt-1 text-sm text-mantle-muted">
                Prove eligibility with a SessionCredential, then deposit into a
                compliant yield vault.
              </div>
            </div>

            <div className="flex items-center gap-2">
              {(
                ['Connect', 'Prove', 'Submit', 'Verified', 'Vault'] as const
              ).map((label, i) => {
                const isActive = i <= stepIndex;
                const isCurrent = i === stepIndex;
                return (
                  <div key={label} className="flex items-center">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all',
                        isCurrent
                          ? 'bg-mantle-primary text-mantle-darker ring-2 ring-mantle-primary/40'
                          : isActive
                            ? 'bg-mantle-card text-white border border-mantle-border'
                            : 'bg-mantle-card/30 text-white/40 border border-mantle-border/50'
                      )}
                    >
                      {i + 1}
                    </div>
                    <span
                      className={cn(
                        'ml-2 hidden text-xs sm:inline',
                        isActive ? 'text-white/80' : 'text-white/40'
                      )}
                    >
                      {label}
                    </span>
                    {i < 4 && (
                      <div
                        className={cn(
                          'mx-2 h-px w-6',
                          isActive ? 'bg-mantle-border' : 'bg-mantle-border/40'
                        )}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {walletAddress && (
            <div className="mb-8 grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-mantle-border bg-mantle-card/60 p-4">
                <div className="text-xs text-mantle-muted">Vault TVL</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-2xl font-semibold">
                    {fmtCompact(vaultTotalAssets, 4)}
                  </div>
                  <div className="text-xs text-mantle-muted">mUSDY</div>
                </div>
              </div>
              <div className="rounded-2xl border border-mantle-border bg-mantle-card/60 p-4">
                <div className="text-xs text-mantle-muted">Net APY</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-2xl font-semibold text-mantle-primary">
                    {vaultApy.toFixed(2)}%
                  </div>
                  <div className="text-xs text-mantle-muted">simulated</div>
                </div>
              </div>
              <div className="rounded-2xl border border-mantle-border bg-mantle-card/60 p-4">
                <div className="text-xs text-mantle-muted">Wallet balance</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-2xl font-semibold">
                    {fmtCompact(tokenBalance, 4)}
                  </div>
                  <div className="text-xs text-mantle-muted">mUSDY</div>
                </div>
              </div>
              <div className="rounded-2xl border border-mantle-border bg-mantle-card/60 p-4">
                <div className="text-xs text-mantle-muted">Your shares</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-2xl font-semibold">
                    {fmtCompact(vaultShares, 4)}
                  </div>
                  <div className="text-xs text-mantle-muted">mYV</div>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="rounded-2xl border border-mantle-border bg-mantle-card/60 p-6 md:p-7">
                {error && (
                  <div className="mb-5 rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200">
                    {error}
                  </div>
                )}

                {!ready && (
                  <div className="text-center">
                    <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-mantle-primary/20 border-t-mantle-primary" />
                    <div className="text-sm text-mantle-muted">
                      Initializing TLSNotary WASM…
                    </div>
                  </div>
                )}

                {ready && step === 'connect' && (
                  <div className="space-y-4">
                    <div className="text-lg font-semibold">
                      Connect your wallet
                    </div>
                    <div className="text-sm text-mantle-muted">
                      This dapp runs on{' '}
                      <span className="text-white/80">Mantle Sepolia</span>.
                      We’ll prompt MetaMask to switch networks on connect.
                    </div>
                    <button
                      onClick={connectWallet}
                      className="w-full rounded-xl bg-mantle-primary px-5 py-3 text-sm font-semibold text-mantle-darker shadow-sm hover:brightness-110 transition"
                    >
                      Connect Wallet
                    </button>
                  </div>
                )}

                {ready && step === 'prove' && (
                  <div className="space-y-4">
                    <div className="text-lg font-semibold">
                      Prove eligibility
                    </div>
                    <div className="text-sm text-mantle-muted">
                      Generate a privacy-preserving TLS proof. This produces an
                      off-chain SessionCredential that can be submitted
                      on-chain.
                    </div>
                    <button
                      onClick={generateProof}
                      disabled={processing}
                      className={cn(
                        'w-full rounded-xl px-5 py-3 text-sm font-semibold transition',
                        processing
                          ? 'bg-mantle-border text-white/50 cursor-not-allowed'
                          : 'bg-mantle-primary text-mantle-darker hover:brightness-110'
                      )}
                    >
                      {processing ? 'Generating proof…' : 'Generate proof'}
                    </button>
                  </div>
                )}

                {ready && step === 'submit' && verifiedData && (
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-lg font-semibold">
                          Eligibility verified
                        </div>
                        <div className="mt-1 text-sm text-mantle-muted">
                          Submit your SessionCredential so contracts can enforce
                          compliance.
                        </div>
                      </div>
                      <div className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs text-green-200">
                        Ready
                      </div>
                    </div>
                    <button
                      onClick={submitToChain}
                      disabled={processing}
                      className={cn(
                        'w-full rounded-xl px-5 py-3 text-sm font-semibold transition',
                        processing
                          ? 'bg-mantle-border text-white/50 cursor-not-allowed'
                          : 'bg-mantle-primary text-mantle-darker hover:brightness-110'
                      )}
                    >
                      {processing ? 'Submitting…' : 'Submit SessionCredential'}
                    </button>
                  </div>
                )}

                {ready && step === 'done' && txHash && (
                  <div className="space-y-4">
                    <div className="text-lg font-semibold">
                      SessionCredential active
                    </div>
                    <div className="rounded-xl border border-mantle-border bg-mantle-dark/40 p-4">
                      <div className="text-xs text-mantle-muted">
                        Transaction
                      </div>
                      <a
                        href={`${chainExplorerUrl}/tx/${txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 block break-all font-mono text-xs text-mantle-primary hover:brightness-110"
                      >
                        {txHash}
                      </a>
                    </div>
                    <button
                      onClick={goToVault}
                      className="w-full rounded-xl bg-mantle-primary px-5 py-3 text-sm font-semibold text-mantle-darker shadow-sm hover:brightness-110 transition"
                    >
                      Enter vault
                    </button>
                  </div>
                )}

                {ready && step === 'vault' && (
                  <div className="space-y-6">
                    {actionSuccess && (
                      <div className="rounded-xl border border-green-500/40 bg-green-500/10 p-4 text-sm text-green-200">
                        {actionSuccess}
                      </div>
                    )}
                    {actionError && (
                      <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-4 text-sm text-red-200">
                        {actionError}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold">
                          Deposit / Withdraw
                        </div>
                        <div className="mt-1 text-sm text-mantle-muted">
                          Deposit mUSDY to receive vault shares (mYV). Withdraw
                          mUSDY by burning shares.
                        </div>
                      </div>
                      <div className="rounded-full border border-mantle-border bg-mantle-dark/40 px-3 py-1 text-xs text-mantle-muted">
                        {vaultEligible ? (
                          <span className="text-green-300">Eligible</span>
                        ) : (
                          <span className="text-red-300">Not eligible</span>
                        )}
                      </div>
                    </div>

                    {safeNum(tokenBalance) === 0 && (
                      <div className="rounded-2xl border border-mantle-border bg-mantle-dark/40 p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-semibold">Need mUSDY?</div>
                            <div className="mt-1 text-sm text-mantle-muted">
                              Mint test mUSDY (demo only) to try deposits.
                            </div>
                          </div>
                          <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs text-amber-200">
                            Demo faucet
                          </div>
                        </div>
                        <button
                          onClick={requestMint}
                          disabled={!!mintDisabledReason}
                          className={cn(
                            'mt-4 w-full rounded-xl px-5 py-3 text-sm font-semibold transition',
                            mintDisabledReason
                              ? 'bg-mantle-border text-white/50 cursor-not-allowed'
                              : 'bg-mantle-primary text-mantle-darker hover:brightness-110'
                          )}
                          title={mintDisabledReason || undefined}
                        >
                          {processing ? 'Minting…' : 'Mint 1000 mUSDY'}
                        </button>
                        {mintDisabledReason && (
                          <div className="mt-2 text-xs text-mantle-muted">
                            {mintDisabledReason}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="rounded-2xl border border-mantle-border bg-mantle-dark/40 p-5">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setVaultTab('deposit')}
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-semibold transition',
                            vaultTab === 'deposit'
                              ? 'bg-mantle-primary text-mantle-darker'
                              : 'border border-mantle-border bg-mantle-card/40 text-white/70 hover:text-white'
                          )}
                        >
                          Deposit
                        </button>
                        <button
                          onClick={() => setVaultTab('withdraw')}
                          className={cn(
                            'rounded-full px-3 py-1 text-xs font-semibold transition',
                            vaultTab === 'withdraw'
                              ? 'bg-mantle-primary text-mantle-darker'
                              : 'border border-mantle-border bg-mantle-card/40 text-white/70 hover:text-white'
                          )}
                        >
                          Withdraw
                        </button>
                      </div>

                      {vaultTab === 'deposit' ? (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">Amount</div>
                            <button
                              className="text-xs text-mantle-primary hover:brightness-110 transition"
                              onClick={() =>
                                setDepositAmount(
                                  String(Math.max(0, safeNum(tokenBalance)))
                                )
                              }
                            >
                              Max
                            </button>
                          </div>
                          <input
                            type="number"
                            value={depositAmount}
                            onChange={(e) => setDepositAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-xl border border-mantle-border bg-mantle-card/40 px-4 py-3 font-mono text-sm text-white outline-none focus:border-mantle-primary"
                          />
                          <div className="flex items-center justify-between text-xs text-mantle-muted">
                            <span>Available</span>
                            <span className="font-mono text-white/80">
                              {fmtCompact(tokenBalance, 6)} mUSDY
                            </span>
                          </div>
                          <button
                            onClick={depositToVault}
                            disabled={processing || safeNum(tokenBalance) === 0}
                            className={cn(
                              'mt-2 w-full rounded-xl px-5 py-3 text-sm font-semibold transition',
                              processing || safeNum(tokenBalance) === 0
                                ? 'bg-mantle-border text-white/50 cursor-not-allowed'
                                : 'bg-mantle-primary text-mantle-darker hover:brightness-110'
                            )}
                          >
                            {processing ? 'Depositing…' : 'Deposit'}
                          </button>
                          <div className="text-xs text-mantle-muted">
                            You’ll receive vault shares (mYV) at the current
                            share price.
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold">Amount</div>
                            <button
                              className="text-xs text-mantle-primary hover:brightness-110 transition"
                              onClick={() =>
                                setWithdrawAmount(
                                  String(Math.max(0, safeNum(vaultShares)))
                                )
                              }
                            >
                              Max
                            </button>
                          </div>
                          <input
                            type="number"
                            value={withdrawAmount}
                            onChange={(e) => setWithdrawAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-xl border border-mantle-border bg-mantle-card/40 px-4 py-3 font-mono text-sm text-white outline-none focus:border-mantle-primary"
                          />
                          <div className="flex items-center justify-between text-xs text-mantle-muted">
                            <span>Your shares</span>
                            <span className="font-mono text-white/80">
                              {fmtCompact(vaultShares, 6)} mYV
                            </span>
                          </div>
                          <button
                            onClick={withdrawFromVault}
                            disabled={processing || safeNum(vaultShares) === 0}
                            className={cn(
                              'mt-2 w-full rounded-xl px-5 py-3 text-sm font-semibold transition',
                              processing || safeNum(vaultShares) === 0
                                ? 'bg-mantle-border text-white/50 cursor-not-allowed'
                                : 'bg-mantle-primary text-mantle-darker hover:brightness-110'
                            )}
                          >
                            {processing ? 'Withdrawing…' : 'Withdraw'}
                          </button>
                          <div className="text-xs text-mantle-muted">
                            Withdraw burns shares and returns underlying mUSDY.
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              <div className="rounded-2xl border border-mantle-border bg-mantle-card/60 p-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold">Compliance</div>
                  <div
                    className={cn(
                      'rounded-full px-3 py-1 text-xs border',
                      isVerifiedOnChain
                        ? 'border-green-500/40 bg-green-500/10 text-green-200'
                        : 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                    )}
                  >
                    {isVerifiedOnChain
                      ? 'SessionCredential on-chain'
                      : 'Not submitted'}
                  </div>
                </div>
                <div className="mt-3 text-sm text-mantle-muted">
                  RWAs require eligibility checks. zk RWA Kit issues expiring
                  SessionCredentials so protocols can remain composable while
                  enforcing access control.
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-mantle-border bg-mantle-dark/40 p-4">
                    <div className="text-xs text-mantle-muted">
                      Vault access
                    </div>
                    <div className="mt-2 text-sm font-semibold">
                      {vaultEligible ? (
                        <span className="text-green-300">Eligible</span>
                      ) : (
                        <span className="text-red-300">Restricted</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-xl border border-mantle-border bg-mantle-dark/40 p-4">
                    <div className="text-xs text-mantle-muted">Claim type</div>
                    <div className="mt-2 font-mono text-xs text-white/80">
                      {CLAIM_TYPES.ELIGIBLE}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-mantle-border bg-mantle-card/60 p-6">
                <div className="text-sm font-semibold">Protocol</div>
                <div className="mt-3 space-y-3 text-sm text-mantle-muted">
                  <div className="flex items-center justify-between gap-3">
                    <span>Asset</span>
                    <span className="font-mono text-white/80">mUSDY</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Vault token</span>
                    <span className="font-mono text-white/80">mYV</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Network</span>
                    <span className="text-white/80">Mantle Sepolia</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Explorer</span>
                    <a
                      className="text-mantle-primary hover:brightness-110 transition"
                      href={chainExplorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open
                    </a>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    className="rounded-full border border-mantle-border bg-mantle-dark/40 px-3 py-1 text-xs text-white/70 hover:text-white transition"
                    href={`${chainExplorerUrl}/address/${MYIELD_VAULT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Vault contract
                  </a>
                  <a
                    className="rounded-full border border-mantle-border bg-mantle-dark/40 px-3 py-1 text-xs text-white/70 hover:text-white transition"
                    href={`${chainExplorerUrl}/address/${MUSDY_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    mUSDY contract
                  </a>
                  <a
                    className="rounded-full border border-mantle-border bg-mantle-dark/40 px-3 py-1 text-xs text-white/70 hover:text-white transition"
                    href={`${chainExplorerUrl}/address/${IDENTITY_REGISTRY_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Identity registry
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-mantle-border bg-mantle-card/60">
                <button
                  className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
                  onClick={() => setDevConsoleOpen((v) => !v)}
                >
                  <div>
                    <div className="text-sm font-semibold">
                      Developer console
                    </div>
                    <div className="mt-1 text-xs text-mantle-muted">
                      TLSNotary + worker logs (useful for debugging)
                    </div>
                  </div>
                  <div className="text-xs text-mantle-muted">
                    {devConsoleOpen ? 'Hide' : 'Show'}
                  </div>
                </button>
                {devConsoleOpen && (
                  <div className="border-t border-mantle-border">
                    <ScrollToBottom className="h-56 p-4 overflow-y-auto font-mono text-xs">
                      {consoleMessages.map((m, i) => (
                        <div
                          key={i}
                          className="break-all py-0.5 text-green-300/80"
                        >
                          {m}
                        </div>
                      ))}
                    </ScrollToBottom>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-mantle-border/70 bg-mantle-dark/40">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-5 text-sm text-mantle-muted md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-white/80">Powered by zk rwa kit</span>
            <span className="hidden sm:inline">•</span>
            <span>Built on Mantle</span>
            {explorerLinks.commitUrl && (
              <>
                <span className="hidden sm:inline">•</span>
                <a
                  className="text-mantle-primary hover:brightness-110 transition"
                  href={explorerLinks.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Commit
                </a>
              </>
            )}
          </div>
          <div className="text-xs">
            Demo app • Contracts + relayer configurable via env
          </div>
        </div>
      </footer>
    </div>
  );
}

function bytesToUtf8(array: number[]): string {
  return Buffer.from(array).toString('utf8').replaceAll('\u0000', '█');
}
