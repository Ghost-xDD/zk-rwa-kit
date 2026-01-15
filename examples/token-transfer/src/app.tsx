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
const IDENTITY_REGISTRY_ADDRESS =
  process.env.IDENTITY_REGISTRY_ADDRESS ||
  '0x58698a19006443eD2e9F1e4284Bd0c341B1a5A12';

const MUSDY_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
];

const IDENTITY_REGISTRY_ABI = [
  'function isVerified(address wallet, bytes32 claimType) view returns (bool)',
];

let capturedLogs: string[] = [];
const originalLog = console.log;

const MantleLogo = ({ className = '' }: { className?: string }) => (
  <svg
    className={className}
    viewBox="0 0 32 32"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="32" height="32" rx="8" fill="#65B3AE" />
    <path d="M8 16L16 8L24 16L16 24L8 16Z" fill="white" fillOpacity="0.9" />
    <path d="M12 16L16 12L20 16L16 20L12 16Z" fill="#65B3AE" />
  </svg>
);

const WalletIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

const SendIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
    />
  </svg>
);

const CheckCircleIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const CoinsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg
    className="w-4 h-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

function App(): ReactElement {
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<
    'init' | 'connect' | 'prove' | 'submit' | 'done' | 'tokens'
  >('init');
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showConsole, setShowConsole] = useState(true);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isVerifiedOnChain, setIsVerifiedOnChain] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('100');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<string | null>(null);

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

      console.log('Initializing TLSNotary WASM...');
      await init({
        loggingLevel: 'Info',
        hardwareConcurrency: maxConcurrency,
        crateFilters,
      });

      setReady(true);
      setStep('connect');
      console.log(`TLSNotary initialized with ${maxConcurrency} threads`);
    })();
  }, []);

  const refreshTokenData = useCallback(
    async (
      address: string,
      ethProvider: ethers.BrowserProvider
    ): Promise<{ balance: string; verified: boolean }> => {
      try {
        const mUSDY = new ethers.Contract(
          MUSDY_ADDRESS,
          MUSDY_ABI,
          ethProvider
        );
        const identityRegistry = new ethers.Contract(
          IDENTITY_REGISTRY_ADDRESS,
          IDENTITY_REGISTRY_ABI,
          ethProvider
        );

        const balance = await mUSDY.balanceOf(address);
        const decimals = await mUSDY.decimals();
        const formattedBalance = ethers.formatUnits(balance, decimals);
        setTokenBalance(formattedBalance);

        const ELIGIBLE_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('ELIGIBLE'));
        const verified = await identityRegistry.isVerified(
          address,
          ELIGIBLE_CLAIM
        );
        setIsVerifiedOnChain(verified);

        console.log(`mUSDY balance: ${formattedBalance}`);
        console.log(`Verified on-chain: ${verified}`);

        return { balance: formattedBalance, verified };
      } catch (err) {
        console.log('Could not fetch token data');
        return { balance: '0', verified: false };
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

      console.log('Connecting wallet...');
      const ethProvider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await ethProvider.send('eth_requestAccounts', []);
      const address = accounts[0];

      setWalletAddress(address);
      setProvider(ethProvider);
      console.log(
        `✅ Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`
      );

      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x138B' }],
        });
        console.log('✅ Switched to Mantle Sepolia');
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

      console.log('🔍 Checking verification status...');
      await refreshTokenData(address, ethProvider);

      const identityRegistry = new ethers.Contract(
        IDENTITY_REGISTRY_ADDRESS,
        IDENTITY_REGISTRY_ABI,
        ethProvider
      );
      const ELIGIBLE_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('ELIGIBLE'));
      const verified = await identityRegistry.isVerified(
        address,
        ELIGIBLE_CLAIM
      );

      if (verified) {
        console.log('✅ Already verified! Skipping to token operations...');
        setStep('tokens');
      } else {
        console.log('⚠️ Not verified. Please complete verification.');
        setStep('prove');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
    }
  }, [refreshTokenData]);

  const generateProof = useCallback(async () => {
    setProcessing(true);
    setError(null);
    console.log('🎬 Starting eligibility verification...');

    let verifier: TVerifier;
    try {
      console.log('🔧 Setting up Verifier...');
      verifier = await new Verifier({
        max_sent_data: MAX_SENT_DATA,
        max_recv_data: MAX_RECV_DATA,
      });

      console.log('🔗 Connecting to prover server...');
      await verifier.connect(proverProxyUrl);
      console.log('✅ Connected to prover');

      await new Promise((r) => setTimeout(r, 1000));

      console.log('🔐 Starting MPC-TLS verification...');
      const result = await verifier.verify();
      console.log('✅ Verification completed!');

      const sent = result.transcript?.sent || [];
      const recv = result.transcript?.recv || [];
      const serverName = result.server_name || 'unknown';

      console.log(`🔑 Verified server: ${serverName}`);

      const recvString = bytesToUtf8(recv);
      const isEligible =
        recvString.includes('"organization"') ||
        recvString.includes('"bank"') ||
        recvString.includes('"USD"');

      if (!isEligible) {
        setError('Could not verify bank account data');
        setProcessing(false);
        return;
      }

      console.log('🎉 Bank account verified! User is eligible.');

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
          if (provider && walletAddress) {
            await refreshTokenData(walletAddress, provider);
          }
        }, 5000);
      } else {
        throw new Error(result.error || 'Submission failed');
      }
    } catch (e: any) {
      setError(`Submission failed: ${e.message}`);
    }

    setProcessing(false);
  }, [walletAddress, verifiedData, provider, refreshTokenData]);

  const goToTokens = useCallback(async () => {
    setStep('tokens');
    if (provider && walletAddress) {
      await refreshTokenData(walletAddress, provider);
    }
  }, [provider, walletAddress, refreshTokenData]);

  const requestMint = useCallback(async () => {
    if (!walletAddress) return;

    setProcessing(true);
    setTransferError(null);
    setTransferSuccess(null);
    setTxStatus('Requesting mint from relayer...');
    console.log('🪙 Requesting mUSDY mint...');

    try {
      const response = await fetch(`${relayerUrl}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: walletAddress, amount: '1000' }),
      });

      setTxStatus('Processing mint transaction...');
      const data = await response.json();

      if (data.success) {
        setTransferSuccess(`Successfully minted 1000 mUSDY!`);
        console.log(`Mint successful: ${data.txHash}`);
        setTxStatus(null);
        setTimeout(() => refreshTokenData(walletAddress, provider!), 5000);
      } else {
        throw new Error(data.error || 'Mint failed');
      }
    } catch (e: any) {
      setTransferError(`Mint failed: ${e.message}`);
      setTxStatus(null);
    }

    setProcessing(false);
  }, [walletAddress, provider, refreshTokenData]);

  const transferTokens = useCallback(async () => {
    if (!walletAddress || !provider || !transferRecipient) return;

    setProcessing(true);
    setTransferError(null);
    setTransferSuccess(null);
    setTxStatus('Initiating token transfer...');
    console.log(`Transferring ${transferAmount} mUSDY...`);

    try {
      const signer = await provider.getSigner();
      const mUSDY = new ethers.Contract(MUSDY_ADDRESS, MUSDY_ABI, signer);
      const amount = ethers.parseUnits(transferAmount, 18);

      setTxStatus('Sending transaction to blockchain...');
      const tx = await mUSDY.transfer(transferRecipient, amount);
      console.log(`Transaction sent: ${tx.hash}`);
      
      setTxStatus('Confirming transfer on blockchain...');
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setTransferSuccess(`Successfully transferred ${transferAmount} mUSDY!`);
        console.log(`Transfer successful: ${tx.hash}`);
        setShowConfetti(true);
        setTxStatus(null);
        await refreshTokenData(walletAddress, provider);
      }
    } catch (e: any) {
      let errorMessage = e.message || 'Transfer failed';
      if (errorMessage.includes('Transfer not compliant')) {
        errorMessage =
          'Transfer blocked: Recipient is not verified for compliance.';
        console.log('COMPLIANCE CHECK FAILED');
      }
      setTransferError(errorMessage);
      setTxStatus(null);
    }

    setProcessing(false);
  }, [
    walletAddress,
    provider,
    transferRecipient,
    transferAmount,
    refreshTokenData,
  ]);

  const [recipientVerified, setRecipientVerified] = useState<boolean | null>(
    null
  );
  React.useEffect(() => {
    if (!provider || !ethers.isAddress(transferRecipient)) {
      setRecipientVerified(null);
      return;
    }
    const checkVerified = async () => {
      const registry = new ethers.Contract(
        IDENTITY_REGISTRY_ADDRESS,
        IDENTITY_REGISTRY_ABI,
        provider
      );
      const ELIGIBLE_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('ELIGIBLE'));
      const verified = await registry.isVerified(
        transferRecipient,
        ELIGIBLE_CLAIM
      );
      setRecipientVerified(verified);
    };
    checkVerified();
  }, [transferRecipient, provider]);

  const steps = [
    { key: 'connect', label: 'Connect', icon: WalletIcon },
    { key: 'prove', label: 'Verify', icon: ShieldIcon },
    { key: 'submit', label: 'Submit', icon: SendIcon },
    { key: 'done', label: 'Complete', icon: CheckCircleIcon },
    { key: 'tokens', label: 'Transfer', icon: CoinsIcon },
  ];

  const currentStepIndex = steps.findIndex((s) => s.key === step);

  return (
    <div className="min-h-screen flex flex-col bg-mantle-darker grid-bg">
      {showConfetti && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <ConfettiExplosion
            force={0.6}
            duration={4000}
            particleCount={150}
            width={1600}
            colors={['#65B3AE', '#FFD700', '#4A9E99', '#FFFFFF']}
          />
        </div>
      )}

      {/* Header */}
      <header className="w-full border-b border-mantle-border bg-mantle-dark/80 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <MantleLogo className="w-8 h-8" />
              <div className="flex flex-col">
                <span className="font-display font-bold text-white text-lg leading-tight">
                  mUSDY
                </span>
                <span className="text-[10px] text-mantle-muted uppercase tracking-wider">
                  Token Transfer
                </span>
              </div>
            </div>

            {/* Network Badge + Wallet */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-mantle-primary/10 border border-mantle-primary/20">
                <span className="w-2 h-2 rounded-full bg-mantle-primary live-indicator" />
                <span className="text-xs font-medium text-mantle-primary">
                  Mantle Sepolia
                </span>
              </div>

              {walletAddress ? (
                <div className="flex items-center gap-3">
                  {/* Balance */}
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-mantle-card border border-mantle-border">
                    <CoinsIcon />
                    <span className="font-mono text-sm text-white font-medium">
                      {parseFloat(tokenBalance).toLocaleString()}
                    </span>
                    <span className="text-mantle-muted text-sm">mUSDY</span>
                  </div>

                  {/* Wallet */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-mantle-card border border-mantle-border">
                    {isVerifiedOnChain ? (
                      <span className="status-badge status-verified">
                        <CheckCircleIcon />
                        <span className="hidden sm:inline">Verified</span>
                      </span>
                    ) : (
                      <span className="status-badge status-pending">
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span className="hidden sm:inline">Pending</span>
                      </span>
                    )}
                    <span className="font-mono text-sm text-white">
                      {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </span>
                  </div>
                </div>
              ) : (
                <button
                  onClick={connectWallet}
                  disabled={!ready}
                  className="flex items-center gap-2 px-4 py-2 btn-primary rounded-xl text-white font-medium text-sm disabled:opacity-50"
                >
                  <WalletIcon />
                  <span>Connect Wallet</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-white mb-4">
              Compliance-Gated{' '}
              <span className="mantle-gradient">Token Transfer</span>
            </h1>
            <p className="text-mantle-muted text-base max-w-lg mx-auto leading-relaxed">
              Transfer mUSDY tokens with built-in compliance verification. Both
              sender and recipient must be verified to complete transfers.
            </p>
          </div>

          <div className="mb-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between relative">
              <div className="absolute top-5 left-0 right-0 h-0.5 bg-mantle-border" />

              <div
                className="absolute top-5 left-0 h-0.5 bg-mantle-primary transition-all duration-500"
                style={{
                  width: `${(currentStepIndex / (steps.length - 1)) * 100}%`,
                }}
              />

              {steps.map((s, i) => {
                const isActive = i <= currentStepIndex;
                const isCurrent = s.key === step;
                const Icon = s.icon;

                return (
                  <div
                    key={s.key}
                    className="relative flex flex-col items-center z-10"
                  >
                    <div
                      className={`
                      w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300
                      ${
                        isCurrent
                          ? 'bg-mantle-primary text-white shadow-lg shadow-mantle-primary/30 scale-110'
                          : isActive
                            ? 'bg-mantle-primary/20 text-mantle-primary border border-mantle-primary/30'
                            : 'bg-mantle-card text-mantle-muted border border-mantle-border'
                      }
                    `}
                    >
                      <Icon />
                    </div>
                    <span
                      className={`mt-2 text-xs font-medium ${isActive ? 'text-white' : 'text-mantle-muted'}`}
                    >
                      {s.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 glass-card rounded-2xl p-6 sm:p-8 animated-border">
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                  <svg
                    className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {step === 'connect' && ready && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-mantle-primary/10 flex items-center justify-center">
                    <WalletIcon />
                    <svg
                      className="w-10 h-10 text-mantle-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-display font-semibold text-white mb-3">
                    Connect Your Wallet
                  </h3>
                  <p className="text-mantle-muted mb-8 max-w-sm mx-auto">
                    Connect your wallet to start the verification process and
                    access mUSDY tokens.
                  </p>
                  <button
                    onClick={connectWallet}
                    className="px-8 py-4 btn-primary rounded-xl text-white font-semibold text-base"
                  >
                    Connect Wallet
                  </button>
                </div>
              )}

              {step === 'prove' && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-mantle-primary/10 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-mantle-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-display font-semibold text-white mb-3">
                    Verify Your Eligibility
                  </h3>
                  <p className="text-mantle-muted mb-8 max-w-sm mx-auto">
                    Generate a zero-knowledge proof of your bank account to
                    verify your eligibility for compliant token transfers.
                  </p>
                  <button
                    onClick={generateProof}
                    disabled={processing}
                    className={`px-8 py-4 rounded-xl text-white font-semibold text-base transition-all flex items-center gap-3 mx-auto ${
                      processing
                        ? 'bg-mantle-border cursor-not-allowed'
                        : 'btn-primary'
                    }`}
                  >
                    {processing && (
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    )}
                    {processing ? 'Generating Proof...' : 'Generate Proof'}
                  </button>
                </div>
              )}

              {step === 'submit' && verifiedData && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-green-500/10 flex items-center justify-center">
                    <svg
                      className="w-10 h-10 text-green-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-display font-semibold text-white mb-3">
                    Eligibility Verified
                  </h3>
                  <p className="text-mantle-muted mb-6 max-w-sm mx-auto">
                    Your eligibility has been cryptographically verified. Submit
                    the proof to Mantle to complete registration.
                  </p>

                  <div className="mb-8 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center justify-center gap-2 text-green-400">
                      <CheckCircleIcon />
                      <span className="font-medium">Bank Account Verified</span>
                    </div>
                  </div>

                  <button
                    onClick={submitToChain}
                    disabled={processing}
                    className={`px-8 py-4 rounded-xl text-white font-semibold text-base transition-all flex items-center gap-3 mx-auto ${
                      processing
                        ? 'bg-mantle-border cursor-not-allowed'
                        : 'btn-primary'
                    }`}
                  >
                    {processing && (
                      <svg
                        className="w-5 h-5 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                    )}
                    {processing ? 'Submitting...' : 'Submit to Mantle'}
                  </button>
                </div>
              )}

              {step === 'done' && txHash && (
                <div className="text-center py-8">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-mantle-primary/10 flex items-center justify-center animate-glow">
                    <svg
                      className="w-10 h-10 text-mantle-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <h3 className="text-xl font-display font-semibold text-white mb-3">
                    Registration Complete!
                  </h3>
                  <p className="text-mantle-muted mb-6 max-w-sm mx-auto">
                    You are now verified on Mantle. You can mint and transfer
                    mUSDY tokens.
                  </p>

                  <div className="mb-8 p-4 rounded-xl bg-mantle-card border border-mantle-border">
                    <p className="text-xs text-mantle-muted mb-2">
                      Transaction Hash
                    </p>
                    <a
                      href={`${chainExplorerUrl}/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 text-mantle-primary hover:text-white transition-colors font-mono text-sm"
                    >
                      {txHash.slice(0, 20)}...{txHash.slice(-10)}
                      <ExternalLinkIcon />
                    </a>
                  </div>

                  <button
                    onClick={goToTokens}
                    className="px-8 py-4 btn-primary rounded-xl text-white font-semibold text-base"
                  >
                    Start Transferring →
                  </button>
                </div>
              )}

              {/* Tokens Step */}
              {step === 'tokens' && (
                <div>
                  {/* Balance Overview */}
                  <div className="mb-8 p-6 rounded-xl bg-gradient-to-br from-mantle-primary/10 to-transparent border border-mantle-primary/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-mantle-muted text-sm mb-1">
                          Available Balance
                        </p>
                        <p className="text-3xl font-display font-bold text-white">
                          {parseFloat(tokenBalance).toLocaleString()}{' '}
                          <span className="text-mantle-primary">mUSDY</span>
                        </p>
                      </div>
                      <div className="w-16 h-16 rounded-2xl bg-mantle-primary/20 flex items-center justify-center">
                        <CoinsIcon />
                        <svg
                          className="w-8 h-8 text-mantle-primary"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Success/Error Messages */}
                  {transferSuccess && (
                    <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20 flex items-start gap-3">
                      <CheckCircleIcon />
                      <p className="text-green-400 text-sm">
                        {transferSuccess}
                      </p>
                    </div>
                  )}
                  {transferError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                      <svg
                        className="w-5 h-5 text-red-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-red-400 text-sm">{transferError}</p>
                    </div>
                  )}

                  {/* Mint Section */}
                  <div className="mb-6 p-5 rounded-xl bg-mantle-card border border-mantle-border">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-amber-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-display font-semibold text-white">
                          Mint Tokens
                        </h4>
                        <p className="text-xs text-mantle-muted">
                          Get test mUSDY tokens
                        </p>
                      </div>
                    </div>
                    
                    {processing && txStatus && step === 'tokens' && (
                      <div className="mb-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
                        <div className="flex items-center gap-3">
                          <div className="w-5 h-5">
                            <svg
                              className="w-5 h-5 animate-spin text-amber-400"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="3"
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-amber-400">
                              {txStatus}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    <button
                      onClick={requestMint}
                      disabled={processing || !isVerifiedOnChain}
                      className={`w-full px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                        processing || !isVerifiedOnChain
                          ? 'bg-mantle-border text-mantle-muted cursor-not-allowed'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30'
                      }`}
                    >
                      {processing
                        ? 'Minting...'
                        : !isVerifiedOnChain
                          ? 'Verification Required'
                          : 'Mint 1,000 mUSDY'}
                    </button>
                  </div>

                  <div className="p-5 rounded-xl bg-mantle-card border border-mantle-border">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-mantle-primary/10 flex items-center justify-center">
                        <SendIcon />
                      </div>
                      <div>
                        <h4 className="font-display font-semibold text-white">
                          Transfer Tokens
                        </h4>
                        <p className="text-xs text-mantle-muted">
                          Send mUSDY to another address
                        </p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-mantle-muted mb-2">
                          Recipient Address
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            value={transferRecipient}
                            onChange={(e) =>
                              setTransferRecipient(e.target.value)
                            }
                            placeholder="0x..."
                            className="w-full px-4 py-3 input-field rounded-xl text-white font-mono text-sm placeholder:text-mantle-muted/50"
                          />
                          {recipientVerified !== null &&
                            ethers.isAddress(transferRecipient) && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                {recipientVerified ? (
                                  <span className="status-badge status-verified text-xs">
                                    <CheckCircleIcon />
                                    Verified
                                  </span>
                                ) : (
                                  <span className="status-badge text-xs bg-red-500/15 text-red-400 border border-red-500/30">
                                    <svg
                                      className="w-3.5 h-3.5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M6 18L18 6M6 6l12 12"
                                      />
                                    </svg>
                                    Not Verified
                                  </span>
                                )}
                              </div>
                            )}
                        </div>
                      </div>

                      {/* Amount Input */}
                      <div>
                        <label className="block text-sm text-mantle-muted mb-2">
                          Amount
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                            placeholder="100"
                            className="w-full px-4 py-3 input-field rounded-xl text-white font-mono text-sm placeholder:text-mantle-muted/50"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-mantle-muted text-sm">
                            mUSDY
                          </span>
                        </div>
                      </div>

                      {processing && txStatus && (
                        <div className="p-4 rounded-xl bg-mantle-primary/10 border border-mantle-primary/30">
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5">
                              <svg
                                className="w-5 h-5 animate-spin text-mantle-primary"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="3"
                                />
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-white">
                                {txStatus}
                              </p>
                              <p className="text-xs text-mantle-muted mt-1">
                                Please wait for confirmation...
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={transferTokens}
                        disabled={
                          processing ||
                          !transferRecipient ||
                          parseFloat(tokenBalance) === 0
                        }
                        className={`w-full px-6 py-3 rounded-xl font-medium text-sm transition-all ${
                          processing ||
                          !transferRecipient ||
                          parseFloat(tokenBalance) === 0
                            ? 'bg-mantle-border text-mantle-muted cursor-not-allowed'
                            : 'btn-primary text-white'
                        }`}
                      >
                        {processing
                          ? 'Transferring...'
                          : `Transfer ${transferAmount} mUSDY`}
                      </button>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-mantle-dark border border-mantle-border">
                      <p className="text-xs text-mantle-muted flex items-start gap-2">
                        <ShieldIcon />
                        <span>
                          <strong className="text-mantle-primary">
                            Compliance Required:
                          </strong>{' '}
                          Both sender and recipient must be verified to complete
                          transfers.
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 p-4 rounded-xl bg-blue-500/5 border border-blue-500/20">
                    <p className="text-sm text-blue-400 flex items-start gap-2">
                      <svg
                        className="w-5 h-5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>
                        <strong>Demo:</strong> Try transferring to an unverified
                        address like{' '}
                        <code className="px-1.5 py-0.5 rounded bg-blue-500/20 font-mono text-xs">
                          0x0000...0001
                        </code>{' '}
                        to see compliance blocking in action.
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Loading State */}
              {!ready && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-6 relative">
                    <div className="absolute inset-0 rounded-full border-4 border-mantle-border" />
                    <div className="absolute inset-0 rounded-full border-4 border-mantle-primary border-t-transparent animate-spin" />
                  </div>
                  <p className="text-mantle-muted">
                    Initializing TLSNotary WASM...
                  </p>
                </div>
              )}
            </div>

            {/* Console Output */}
            <div className="lg:col-span-1">
              <div className="rounded-xl overflow-hidden border border-mantle-border bg-mantle-dark sticky top-20">
                <div className="px-4 py-3 bg-mantle-card border-b border-mantle-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-400 live-indicator" />
                    <h4 className="text-sm font-medium text-white">
                      Console Output
                    </h4>
                  </div>
                  <button
                    onClick={() => setShowConsole(!showConsole)}
                    className="text-mantle-muted hover:text-white transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d={showConsole ? 'M19 9l-7 7-7-7' : 'M9 5l7 7-7 7'}
                      />
                    </svg>
                  </button>
                </div>
                {showConsole && (
                  <ScrollToBottom className="h-96 p-4 overflow-y-auto console-output">
                    {consoleMessages.map((m, i) => (
                      <div
                        key={i}
                        className="text-mantle-primary/80 break-all py-0.5"
                      >
                        {m}
                      </div>
                    ))}
                  </ScrollToBottom>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-mantle-border bg-mantle-dark/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <MantleLogo className="w-6 h-6" />
              <span className="text-sm text-mantle-muted">
                Built on Mantle Network
              </span>
            </div>

            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-mantle-card border border-mantle-border">
              <svg
                className="w-4 h-4 text-mantle-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="text-sm text-mantle-muted">Powered by</span>
              <span className="text-sm font-semibold text-white">
                ZK RWA Kit
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function bytesToUtf8(array: number[]): string {
  return Buffer.from(array).toString('utf8').replaceAll('\u0000', '█');
}
