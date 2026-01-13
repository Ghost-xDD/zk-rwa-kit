import React, { ReactElement, useCallback, useState } from 'react';
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
  process.env.MYIELD_VAULT_ADDRESS || '0xc7effA35eFFE2d1EaB90B3107927CaBeE4258170';
const IDENTITY_REGISTRY_ADDRESS =
  process.env.IDENTITY_REGISTRY_ADDRESS || '0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12';

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
        const mUSDY = new ethers.Contract(MUSDY_ADDRESS, MUSDY_ABI, ethProvider);
        const vault = new ethers.Contract(MYIELD_VAULT_ADDRESS, MYIELD_VAULT_ABI, ethProvider);
        const registry = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, ethProvider);

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
      console.log(`✅ Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`);

      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x138B' }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x138B',
              chainName: 'Mantle Sepolia',
              nativeCurrency: { name: 'MNT', symbol: 'MNT', decimals: 18 },
              rpcUrls: ['https://rpc.sepolia.mantle.xyz'],
              blockExplorerUrls: ['https://sepolia.mantlescan.xyz'],
            }],
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
      verifier = await new Verifier({ max_sent_data: MAX_SENT_DATA, max_recv_data: MAX_RECV_DATA });
      await verifier.connect(proverProxyUrl);
      console.log('✅ Connected to prover');

      await new Promise((r) => setTimeout(r, 1000));
      const result = await verifier.verify();
      console.log('✅ Verification completed!');

      const sent = result.transcript?.sent || [];
      const recv = result.transcript?.recv || [];
      const serverName = result.server_name || 'unknown';

      const recvString = bytesToUtf8(recv);
      const isEligible = recvString.includes('"organization"') || recvString.includes('"bank"');

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
          if (provider && walletAddress) await refreshData(walletAddress, provider);
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
      const vault = new ethers.Contract(MYIELD_VAULT_ADDRESS, MYIELD_VAULT_ABI, signer);
      const amount = ethers.parseUnits(depositAmount, 18);

      const allowance = await mUSDY.allowance(walletAddress, MYIELD_VAULT_ADDRESS);
      if (allowance < amount) {
        console.log('📝 Approving vault...');
        const approveTx = await mUSDY.approve(MYIELD_VAULT_ADDRESS, amount);
        await approveTx.wait();
        console.log('✅ Approved');
      }

      const tx = await vault.deposit(amount, walletAddress);
      console.log(`📝 Deposit TX: ${tx.hash}`);
      await tx.wait();

      setActionSuccess(`🎉 Deposited ${depositAmount} mUSDY! You received mYV shares.`);
      setShowConfetti(true);
      await refreshData(walletAddress, provider);
    } catch (e: any) {
      let errorMsg = e.message || 'Deposit failed';
      if (errorMsg.includes('SessionCredential')) {
        errorMsg = '❌ You need a valid SessionCredential! Prove eligibility first.';
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
      const vault = new ethers.Contract(MYIELD_VAULT_ADDRESS, MYIELD_VAULT_ABI, signer);
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

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {showConfetti && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <ConfettiExplosion force={0.6} duration={4000} particleCount={150} width={1600} />
        </div>
      )}

      <header className="w-full p-4 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            🏦 Yield Vault Demo
          </h1>
          {walletAddress && (
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                <span className="text-cyan-300 font-mono text-sm">{tokenBalance} mUSDY</span>
              </div>
              <div className="px-3 py-1.5 bg-purple-500/20 rounded-lg border border-purple-500/30">
                <span className="text-purple-300 font-mono text-sm">{vaultShares} mYV</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm">
                {isVerifiedOnChain ? (
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                ) : (
                  <span className="w-2 h-2 bg-yellow-400 rounded-full" />
                )}
                <span className="text-white/80">{walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}</span>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-4">Compliant DeFi Vault</h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              Deposit mUSDY into the yield vault. Requires a valid SessionCredential (proof of eligibility).
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {['Connect', 'Prove', 'Submit', 'Verified', 'Vault'].map((label, i) => {
              const steps = ['connect', 'prove', 'submit', 'done', 'vault'];
              const stepIndex = steps.indexOf(step);
              const isActive = i <= stepIndex;
              const isCurrent = steps[i] === step;
              return (
                <div key={label} className={`flex items-center ${i > 0 ? 'ml-2' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isCurrent ? 'bg-purple-400 text-slate-900 ring-2 ring-purple-400/50'
                      : isActive ? 'bg-purple-500 text-white' : 'bg-white/20 text-white/50'
                  }`}>{i + 1}</div>
                  <span className={`ml-2 text-sm ${isActive ? 'text-white' : 'text-white/50'}`}>{label}</span>
                  {i < 4 && <div className={`w-6 h-0.5 ml-2 ${isActive ? 'bg-purple-500' : 'bg-white/20'}`} />}
                </div>
              );
            })}
          </div>

          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 mb-6">
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">{error}</div>
            )}

            {step === 'connect' && ready && (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">Connect Your Wallet</h3>
                <button onClick={connectWallet} className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all transform hover:scale-105">
                  Connect Wallet
                </button>
              </div>
            )}

            {step === 'prove' && (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">Prove Eligibility</h3>
                <p className="text-white/70 mb-6">Generate a TLS proof to verify you can use the yield vault.</p>
                <button onClick={generateProof} disabled={processing} className={`px-8 py-4 font-semibold rounded-xl transition-all ${
                  processing ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-green-500 to-cyan-500 hover:opacity-90'
                } text-white`}>
                  {processing ? 'Generating Proof...' : 'Generate Proof'}
                </button>
              </div>
            )}

            {step === 'submit' && verifiedData && (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">✅ Eligibility Verified!</h3>
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
                  <p className="text-green-300">You're eligible for the compliant yield vault.</p>
                </div>
                <button onClick={submitToChain} disabled={processing} className={`px-8 py-4 font-semibold rounded-xl transition-all ${
                  processing ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90'
                } text-white`}>
                  {processing ? 'Submitting...' : 'Submit SessionCredential'}
                </button>
              </div>
            )}

            {step === 'done' && txHash && (
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white mb-4">🎉 SessionCredential Active!</h3>
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <a href={`${chainExplorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                     className="text-purple-400 hover:text-purple-300 font-mono text-sm break-all">{txHash}</a>
                </div>
                <button onClick={goToVault} className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-xl hover:opacity-90">
                  Enter Vault →
                </button>
              </div>
            )}

            {step === 'vault' && (
              <div>
                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl p-6 mb-6 border border-purple-500/30">
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-white/50 text-sm mb-1">Vault TVL</p>
                      <p className="text-2xl font-bold text-white">{vaultTotalAssets} <span className="text-sm text-white/50">mUSDY</span></p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm mb-1">Simulated APY</p>
                      <p className="text-2xl font-bold text-green-400">5.00%</p>
                    </div>
                    <div>
                      <p className="text-white/50 text-sm mb-1">Your Eligibility</p>
                      {vaultEligible ? (
                        <p className="text-xl font-bold text-green-400">✓ Eligible</p>
                      ) : (
                        <p className="text-xl font-bold text-red-400">✗ Not Eligible</p>
                      )}
                    </div>
                  </div>
                </div>

                {actionSuccess && (
                  <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">{actionSuccess}</div>
                )}
                {actionError && (
                  <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">{actionError}</div>
                )}

                {parseFloat(tokenBalance) === 0 && (
                  <div className="bg-amber-500/10 rounded-xl p-6 mb-6 border border-amber-500/30">
                    <h4 className="text-lg font-semibold text-amber-300 mb-2">💡 No mUSDY?</h4>
                    <p className="text-white/70 mb-4 text-sm">Mint some mUSDY first to deposit into the vault.</p>
                    <button onClick={requestMint} disabled={processing || !isVerifiedOnChain}
                      className={`px-6 py-3 font-semibold rounded-xl transition-all ${
                        processing || !isVerifiedOnChain
                          ? 'bg-gray-600 cursor-not-allowed text-white/50'
                          : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
                      }`}>
                      {processing ? 'Minting...' : 'Mint 1000 mUSDY'}
                    </button>
                  </div>
                )}

                <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
                  <h4 className="text-lg font-semibold text-white mb-4">⬆️ Deposit mUSDY</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white/70 text-sm mb-2">Amount</label>
                      <input type="number" value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)} placeholder="100"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500" />
                      <p className="text-white/40 text-xs mt-1">Available: {tokenBalance} mUSDY</p>
                    </div>
                    <button onClick={depositToVault} disabled={processing || parseFloat(tokenBalance) === 0}
                      className={`w-full px-6 py-3 font-semibold rounded-xl transition-all ${
                        processing || parseFloat(tokenBalance) === 0
                          ? 'bg-gray-600 cursor-not-allowed text-white/50'
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                      }`}>
                      {processing ? 'Depositing...' : `Deposit ${depositAmount} mUSDY`}
                    </button>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h4 className="text-lg font-semibold text-white mb-4">⬇️ Withdraw mUSDY</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white/70 text-sm mb-2">Amount</label>
                      <input type="number" value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)} placeholder="50"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500" />
                      <p className="text-white/40 text-xs mt-1">Your shares: {vaultShares} mYV</p>
                    </div>
                    <button onClick={withdrawFromVault} disabled={processing || parseFloat(vaultShares) === 0}
                      className={`w-full px-6 py-3 font-semibold rounded-xl transition-all ${
                        processing || parseFloat(vaultShares) === 0
                          ? 'bg-gray-600 cursor-not-allowed text-white/50'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:opacity-90'
                      }`}>
                      {processing ? 'Withdrawing...' : `Withdraw ${withdrawAmount} mUSDY`}
                    </button>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <p className="text-purple-300 text-sm">
                    <strong>🎯 Why this matters:</strong> RWAs break DeFi composability because smart contracts can't be KYC'd.
                    Zk-RWA-Kit solves this with SessionCredentials—expiring proofs of eligibility that let verified users
                    interact with compliant DeFi protocols.
                  </p>
                </div>
              </div>
            )}

            {!ready && (
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/70">Initializing TLSNotary WASM...</p>
              </div>
            )}
          </div>

          <div className="bg-black/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-2 bg-white/5 border-b border-white/10">
              <h4 className="text-sm font-medium text-white/70">Console Output</h4>
            </div>
            <ScrollToBottom className="h-48 p-4 overflow-y-auto font-mono text-xs">
              {consoleMessages.map((m, i) => (
                <div key={i} className="text-green-400/80 break-all py-0.5">{m}</div>
              ))}
            </ScrollToBottom>
          </div>
        </div>
      </main>

      <footer className="p-4 text-center text-white/50 text-sm">
        Zk-RWA-Kit Yield Vault Example • Built for Mantle Global Hackathon 2025
      </footer>
    </div>
  );
}

function bytesToUtf8(array: number[]): string {
  return Buffer.from(array).toString('utf8').replaceAll('\u0000', '█');
}
