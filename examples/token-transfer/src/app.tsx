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

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);

  const [tokenBalance, setTokenBalance] = useState<string>('0');
  const [isVerifiedOnChain, setIsVerifiedOnChain] = useState(false);
  const [transferRecipient, setTransferRecipient] = useState('');
  const [transferAmount, setTransferAmount] = useState('100');
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);

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

  const refreshTokenData = useCallback(
    async (address: string, ethProvider: ethers.BrowserProvider) => {
      try {
        const mUSDY = new ethers.Contract(MUSDY_ADDRESS, MUSDY_ABI, ethProvider);
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
        const verified = await identityRegistry.isVerified(address, ELIGIBLE_CLAIM);
        setIsVerifiedOnChain(verified);

        console.log(`💰 mUSDY balance: ${formattedBalance}`);
        console.log(`🔐 Verified on-chain: ${verified}`);
      } catch (err) {
        console.log('⚠️ Could not fetch token data');
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
        console.log('✅ Switched to Mantle Sepolia');
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

      await refreshTokenData(address, ethProvider);
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
    console.log('🪙 Requesting mUSDY mint...');

    try {
      const response = await fetch(`${relayerUrl}/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient: walletAddress, amount: '1000' }),
      });

      const data = await response.json();

      if (data.success) {
        setTransferSuccess(`🎉 Minted 1000 mUSDY! TX: ${data.txHash.slice(0, 10)}...`);
        console.log(`✅ Mint successful: ${data.txHash}`);
        setTimeout(() => refreshTokenData(walletAddress, provider!), 5000);
      } else {
        throw new Error(data.error || 'Mint failed');
      }
    } catch (e: any) {
      setTransferError(`❌ Mint failed: ${e.message}`);
    }

    setProcessing(false);
  }, [walletAddress, provider, refreshTokenData]);

  const transferTokens = useCallback(async () => {
    if (!walletAddress || !provider || !transferRecipient) return;

    setProcessing(true);
    setTransferError(null);
    setTransferSuccess(null);
    console.log(`📤 Transferring ${transferAmount} mUSDY...`);

    try {
      const signer = await provider.getSigner();
      const mUSDY = new ethers.Contract(MUSDY_ADDRESS, MUSDY_ABI, signer);
      const amount = ethers.parseUnits(transferAmount, 18);

      const tx = await mUSDY.transfer(transferRecipient, amount);
      console.log(`📝 Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();

      if (receipt.status === 1) {
        setTransferSuccess(`✅ Transferred ${transferAmount} mUSDY!`);
        console.log(`✅ Transfer successful: ${tx.hash}`);
        setShowConfetti(true);
        await refreshTokenData(walletAddress, provider);
      }
    } catch (e: any) {
      let errorMessage = e.message || 'Transfer failed';
      if (errorMessage.includes('Transfer not compliant')) {
        errorMessage = '❌ Transfer blocked: Recipient is not verified!';
        console.log('⛔ COMPLIANCE CHECK FAILED');
      }
      setTransferError(errorMessage);
    }

    setProcessing(false);
  }, [walletAddress, provider, transferRecipient, transferAmount, refreshTokenData]);

  const [recipientVerified, setRecipientVerified] = useState<boolean | null>(null);
  React.useEffect(() => {
    if (!provider || !ethers.isAddress(transferRecipient)) {
      setRecipientVerified(null);
      return;
    }
    const checkVerified = async () => {
      const registry = new ethers.Contract(IDENTITY_REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, provider);
      const ELIGIBLE_CLAIM = ethers.keccak256(ethers.toUtf8Bytes('ELIGIBLE'));
      const verified = await registry.isVerified(transferRecipient, ELIGIBLE_CLAIM);
      setRecipientVerified(verified);
    };
    checkVerified();
  }, [transferRecipient, provider]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      {showConfetti && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <ConfettiExplosion force={0.6} duration={4000} particleCount={150} width={1600} />
        </div>
      )}

      <header className="w-full p-4 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
            🪙 Token Transfer Demo
          </h1>
          {walletAddress && (
            <div className="flex items-center gap-4">
              <div className="px-3 py-1.5 bg-cyan-500/20 rounded-lg border border-cyan-500/30">
                <span className="text-cyan-300 font-mono text-sm">{tokenBalance} mUSDY</span>
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
            <h2 className="text-3xl font-bold text-white mb-4">Compliance-Gated Token Transfer</h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              Mint and transfer mUSDY tokens. Transfers require both sender and recipient to be verified.
            </p>
          </div>

          <div className="flex justify-center gap-2 mb-8 flex-wrap">
            {['Connect', 'Prove', 'Submit', 'Verified', 'Transfer'].map((label, i) => {
              const steps = ['connect', 'prove', 'submit', 'done', 'tokens'];
              const stepIndex = steps.indexOf(step);
              const isActive = i <= stepIndex;
              const isCurrent = steps[i] === step;
              return (
                <div key={label} className={`flex items-center ${i > 0 ? 'ml-2' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isCurrent ? 'bg-cyan-400 text-slate-900 ring-2 ring-cyan-400/50'
                      : isActive ? 'bg-cyan-500 text-white' : 'bg-white/20 text-white/50'
                  }`}>{i + 1}</div>
                  <span className={`ml-2 text-sm ${isActive ? 'text-white' : 'text-white/50'}`}>{label}</span>
                  {i < 4 && <div className={`w-6 h-0.5 ml-2 ${isActive ? 'bg-cyan-500' : 'bg-white/20'}`} />}
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
                <button onClick={connectWallet} className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all transform hover:scale-105">
                  Connect Wallet
                </button>
              </div>
            )}

            {step === 'prove' && (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">Prove Eligibility</h3>
                <p className="text-white/70 mb-6">Generate a TLS proof of your bank account to verify eligibility.</p>
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
                  <p className="text-green-300">Your eligibility has been cryptographically verified.</p>
                </div>
                <button onClick={submitToChain} disabled={processing} className={`px-8 py-4 font-semibold rounded-xl transition-all ${
                  processing ? 'bg-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90'
                } text-white`}>
                  {processing ? 'Submitting...' : 'Submit to Mantle'}
                </button>
              </div>
            )}

            {step === 'done' && txHash && (
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white mb-4">🎉 You're Verified!</h3>
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <a href={`${chainExplorerUrl}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                     className="text-cyan-400 hover:text-cyan-300 font-mono text-sm break-all">{txHash}</a>
                </div>
                <button onClick={goToTokens} className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:opacity-90">
                  Manage Tokens →
                </button>
              </div>
            )}

            {step === 'tokens' && (
              <div>
                <div className="text-center mb-6">
                  <h3 className="text-xl font-semibold text-white mb-2">mUSDY Token Operations</h3>
                </div>

                {transferSuccess && (
                  <div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-300">{transferSuccess}</div>
                )}
                {transferError && (
                  <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">{transferError}</div>
                )}

                <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
                  <h4 className="text-lg font-semibold text-white mb-4">🪙 Mint mUSDY</h4>
                  <button onClick={requestMint} disabled={processing || !isVerifiedOnChain}
                    className={`w-full px-6 py-3 font-semibold rounded-xl transition-all ${
                      processing || !isVerifiedOnChain
                        ? 'bg-gray-600 cursor-not-allowed text-white/50'
                        : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:opacity-90'
                    }`}>
                    {processing ? 'Minting...' : !isVerifiedOnChain ? 'Verification Required' : 'Mint 1000 mUSDY'}
                  </button>
                </div>

                <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                  <h4 className="text-lg font-semibold text-white mb-4">📤 Transfer mUSDY</h4>
                  <p className="text-white/60 mb-4 text-sm">
                    <strong className="text-yellow-300">Note:</strong> Recipient must be verified!
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-white/70 text-sm mb-2">Recipient Address</label>
                      <div className="relative">
                        <input type="text" value={transferRecipient}
                          onChange={(e) => setTransferRecipient(e.target.value)} placeholder="0x..."
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500" />
                        {recipientVerified !== null && ethers.isAddress(transferRecipient) && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {recipientVerified ? (
                              <span className="text-green-400 text-sm">✓ Verified</span>
                            ) : (
                              <span className="text-red-400 text-sm">✗ Not Verified</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-white/70 text-sm mb-2">Amount</label>
                      <input type="number" value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)} placeholder="100"
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500" />
                    </div>
                    <button onClick={transferTokens}
                      disabled={processing || !transferRecipient || parseFloat(tokenBalance) === 0}
                      className={`w-full px-6 py-3 font-semibold rounded-xl transition-all ${
                        processing || !transferRecipient || parseFloat(tokenBalance) === 0
                          ? 'bg-gray-600 cursor-not-allowed text-white/50'
                          : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:opacity-90'
                      }`}>
                      {processing ? 'Transferring...' : `Transfer ${transferAmount} mUSDY`}
                    </button>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <p className="text-blue-300 text-sm">
                    <strong>💡 Demo:</strong> Try transferring to <code className="bg-black/30 px-1 rounded">0x0000...0001</code> (unverified) to see compliance blocking!
                  </p>
                </div>
              </div>
            )}

            {!ready && (
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
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
        Zk-RWA-Kit Token Transfer Example • Built for Mantle Global Hackathon 2025
      </footer>
    </div>
  );
}

function bytesToUtf8(array: number[]): string {
  return Buffer.from(array).toString('utf8').replaceAll('\u0000', '█');
}
