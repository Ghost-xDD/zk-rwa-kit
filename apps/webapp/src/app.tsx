import React, { ReactElement, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Comlink from 'comlink';
import { Verifier as TVerifier, CrateLogFilter } from 'tlsn-wasm';
import ConfettiExplosion from 'react-confetti-explosion';
import ScrollToBottom from 'react-scroll-to-bottom';
import './app.scss';

// Worker setup for WASM isolation
const worker = Comlink.wrap(
  new Worker(new URL('./worker.ts', import.meta.url)),
);
const { init, Verifier, getBufferedLogs }: any = worker;

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(<App />);

// Configuration from environment
const proverProxyUrl = process.env.PROVER_PROXY_URL || 'wss://localhost/prove';
const relayerUrl = process.env.RELAYER_URL || 'http://localhost:3001';
const chainExplorerUrl = process.env.CHAIN_EXPLORER_URL || 'https://sepolia.mantlescan.xyz';

// Simple console capture
let capturedLogs: string[] = [];
const originalLog = console.log;

function App(): ReactElement {
  // State
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [step, setStep] = useState<'init' | 'connect' | 'prove' | 'submit' | 'done'>('init');
  const [verifiedData, setVerifiedData] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  
  // Wallet state (simplified - in production use wagmi)
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Console capture setup
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

  // Initialize TLSNotary WASM
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
        crateFilters: crateFilters,
      });
      
      setReady(true);
      setStep('connect');
      console.log(`✅ TLSNotary initialized with ${maxConcurrency} threads`);
    })();
  }, []);

  // Connect wallet (simplified - use wagmi in production)
  const connectWallet = useCallback(async () => {
    try {
      if (typeof (window as any).ethereum === 'undefined') {
        setError('MetaMask not installed. Please install MetaMask.');
        return;
      }

      console.log('🔗 Connecting wallet...');
      const accounts = await (window as any).ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      const address = accounts[0];
      setWalletAddress(address);
      setStep('prove');
      console.log(`✅ Wallet connected: ${address.slice(0, 6)}...${address.slice(-4)}`);

      // Switch to Mantle Sepolia if needed
      try {
        await (window as any).ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x138B' }], // 5003 in hex
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
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setError(err.message || 'Failed to connect wallet');
    }
  }, []);

  // Generate TLS proof
  const generateProof = useCallback(async () => {
    setProcessing(true);
    setError(null);
    console.log('🎬 Starting eligibility verification...');

    let verifier: TVerifier;
    try {
      console.log('🔧 Setting up Verifier...');
      verifier = await new Verifier({
        max_sent_data: 512,
        max_recv_data: 2048
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
      const serverName = result.server_name;

      console.log(`🔑 Verified server: ${serverName}`);

      // Parse received data to check eligibility
      const recvString = bytesToUtf8(recv);
      const eligibleMatch = recvString.match(/"eligible"\s*:\s*(true|false)/i);
      const isEligible = eligibleMatch ? eligibleMatch[1].toLowerCase() === 'true' : false;

      if (!isEligible) {
        setError('Account is not eligible for RWA tokens');
        setProcessing(false);
        return;
      }

      setVerifiedData({
        serverName,
        sent: arrayToBase64(sent),
        received: arrayToBase64(recv),
        eligible: isEligible,
        rawReceived: recvString,
      });

      setStep('submit');
      setProcessing(false);
      console.log('✅ Eligibility verified! Ready to submit to chain.');

    } catch (e: any) {
      console.error('Verification error:', e.message);
      setError(`Verification failed: ${e.message}`);
      setProcessing(false);
    }
  }, []);

  // Submit to relayer
  const submitToChain = useCallback(async () => {
    if (!walletAddress || !verifiedData) return;
    
    setProcessing(true);
    setError(null);
    console.log('📤 Submitting proof to relayer...');

    try {
      const response = await fetch(`${relayerUrl}/submit-proof`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          transcript: {
            sent: verifiedData.sent,
            received: verifiedData.received,
            serverName: verifiedData.serverName,
          },
          claimType: 'ELIGIBLE',
          extractedValue: 'true',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setTxHash(data.txHash);
        setStep('done');
        setShowConfetti(true);
        console.log(`✅ Transaction submitted: ${data.txHash}`);
        console.log(`📋 Claim expires: ${new Date(data.expiry * 1000).toLocaleDateString()}`);
      } else {
        throw new Error(data.error || 'Submission failed');
      }
    } catch (e: any) {
      console.error('Submission error:', e.message);
      setError(`Submission failed: ${e.message}`);
    }

    setProcessing(false);
  }, [walletAddress, verifiedData]);

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {showConfetti && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50">
          <ConfettiExplosion force={0.6} duration={4000} particleCount={150} width={1600} />
        </div>
      )}

      {/* Header */}
      <header className="w-full p-4 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
            Zk-RWA-Kit
          </h1>
          {walletAddress && (
            <div className="px-4 py-2 bg-white/10 rounded-full text-sm text-white/80">
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          
          {/* Hero Section */}
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Privacy-Preserving RWA Compliance
            </h2>
            <p className="text-lg text-white/70 max-w-2xl mx-auto">
              Prove your eligibility for Real World Asset tokens using TLSNotary. 
              Your sensitive data never leaves your browser.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center gap-2 mb-8">
            {['Connect', 'Prove', 'Submit', 'Done'].map((label, i) => {
              const stepIndex = ['connect', 'prove', 'submit', 'done'].indexOf(step);
              const isActive = i <= stepIndex;
              return (
                <div key={label} className={`flex items-center ${i > 0 ? 'ml-2' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                    isActive ? 'bg-cyan-500 text-white' : 'bg-white/20 text-white/50'
                  }`}>
                    {i + 1}
                  </div>
                  <span className={`ml-2 text-sm ${isActive ? 'text-white' : 'text-white/50'}`}>
                    {label}
                  </span>
                  {i < 3 && <div className={`w-8 h-0.5 ml-2 ${isActive ? 'bg-cyan-500' : 'bg-white/20'}`} />}
                </div>
              );
            })}
          </div>

          {/* Action Card */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 md:p-8 border border-white/20 mb-6">
            
            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-300">
                {error}
              </div>
            )}

            {/* Step: Connect Wallet */}
            {step === 'connect' && ready && (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">Connect Your Wallet</h3>
                <p className="text-white/70 mb-6">
                  Connect your wallet to Mantle Sepolia to begin the verification process.
                </p>
                <button
                  onClick={connectWallet}
                  className="px-8 py-4 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-semibold rounded-xl hover:opacity-90 transition-all transform hover:scale-105"
                >
                  Connect Wallet
                </button>
              </div>
            )}

            {/* Step: Generate Proof */}
            {step === 'prove' && (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">Prove Eligibility</h3>
                <p className="text-white/70 mb-6">
                  Generate a TLS proof of your eligibility status from the mock bank.
                  This proves your eligibility without revealing your account details.
                </p>
                <button
                  onClick={generateProof}
                  disabled={processing}
                  className={`px-8 py-4 font-semibold rounded-xl transition-all transform ${
                    processing 
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-green-500 to-cyan-500 hover:opacity-90 hover:scale-105'
                  } text-white`}
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Generating Proof...
                    </span>
                  ) : (
                    'Generate Proof'
                  )}
                </button>
              </div>
            )}

            {/* Step: Submit to Chain */}
            {step === 'submit' && verifiedData && (
              <div className="text-center">
                <h3 className="text-xl font-semibold text-white mb-4">✅ Eligibility Verified!</h3>
                <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-4 mb-6">
                  <p className="text-green-300">
                    Your eligibility has been cryptographically verified via TLS proof.
                  </p>
                </div>
                <p className="text-white/70 mb-6">
                  Submit this proof to the blockchain. The relayer will pay the gas fees.
                </p>
                <button
                  onClick={submitToChain}
                  disabled={processing}
                  className={`px-8 py-4 font-semibold rounded-xl transition-all transform ${
                    processing 
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 hover:scale-105'
                  } text-white`}
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    'Submit to Mantle'
                  )}
                </button>
              </div>
            )}

            {/* Step: Done */}
            {step === 'done' && txHash && (
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-white mb-4">🎉 Success!</h3>
                <p className="text-white/70 mb-6">
                  Your eligibility is now recorded on Mantle Sepolia. 
                  You can now mint and transfer RWA tokens.
                </p>
                <div className="bg-white/10 rounded-lg p-4 mb-6">
                  <p className="text-sm text-white/50 mb-1">Transaction Hash</p>
                  <a 
                    href={`${chainExplorerUrl}/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 font-mono text-sm break-all"
                  >
                    {txHash}
                  </a>
                </div>
                <a
                  href={`${chainExplorerUrl}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block px-6 py-3 bg-cyan-500 text-white font-semibold rounded-xl hover:bg-cyan-400 transition-all"
                >
                  View on Explorer →
                </a>
              </div>
            )}

            {/* Loading State */}
            {!ready && (
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-white/70">Initializing TLSNotary WASM...</p>
              </div>
            )}
          </div>

          {/* Console Logs */}
          <div className="bg-black/50 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <div className="px-4 py-2 bg-white/5 border-b border-white/10">
              <h4 className="text-sm font-medium text-white/70">Console Output</h4>
            </div>
            <ScrollToBottom className="h-48 p-4 overflow-y-auto font-mono text-xs">
              {consoleMessages.map((m, index) => (
                <div key={index} className="text-green-400/80 break-all py-0.5">
                  {m}
                </div>
              ))}
            </ScrollToBottom>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="p-4 text-center text-white/50 text-sm">
        Zk-RWA-Kit • Built for Mantle Global Hackathon 2025
      </footer>
    </div>
  );
}

// Utility functions
function bytesToUtf8(array: number[]): string {
  return Buffer.from(array).toString('utf8').replaceAll('\u0000', '█');
}

function arrayToBase64(array: number[]): string {
  return Buffer.from(array).toString('base64');
}
