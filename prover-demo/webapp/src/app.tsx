import React, { ReactElement, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Comlink from 'comlink';
import { Verifier as TVerifier, CrateLogFilter } from 'tlsn-wasm';
import ConfettiExplosion from 'react-confetti-explosion';
import ScrollToBottom from 'react-scroll-to-bottom';
import './app.scss';
import OverviewDiagram from './overview_prover_verifier.svg';
import { trackEvent } from './matomo';

const worker = Comlink.wrap(
  new Worker(new URL('./worker.ts', import.meta.url)),
);
const { init, Verifier, getBufferedLogs }: any = worker;

const container = document.getElementById('root');
const root = createRoot(container!);

root.render(<App />);

// Simple console capture
let capturedLogs: string[] = [];
const originalLog = console.log;

const proverProxyUrl = process.env.PROVER_PROXY_URL || 'ws://localhost:9816/prove';
const poapLink = process.env.POAP_LINK || '';
const gitCommitSha = process.env.GIT_COMMIT_SHA || '';
const githubRepository = process.env.GITHUB_REPOSITORY || '';

function App(): ReactElement {
  const [ready, setReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [consoleMessages, setConsoleMessages] = useState<string[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // Simple console capture
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

    // Poll worker logs periodically
    const pollInterval = setInterval(async () => {
      const workerLogs = await getBufferedLogs();
      workerLogs.forEach((log: string) => addLogMessage(log));
    }, 50); // Poll every 50ms for faster log capture

    return () => {
      console.log = originalLog;
      clearInterval(pollInterval);
    };
  }, []);

  // Initialize TLSNotary
  React.useEffect(() => {
    (async () => {
      const maxConcurrency = navigator.hardwareConcurrency;

      // Configure crate-specific log levels to reduce noise
      const crateFilters: CrateLogFilter[] = [
        { name: 'yamux', level: 'Info' },
        { name: 'uid_mux', level: 'Info' },
      ];

      console.log('🔧 start TLSNotary WASM initialization');

      await init({
        loggingLevel: 'Debug',
        hardwareConcurrency: maxConcurrency,
        crateFilters: crateFilters,
      });
      setReady(true);
      console.log(`🔧 TLSNotary initialized with ${maxConcurrency} threads`);

      trackEvent('devconnect', 'Initialized', `threads`, maxConcurrency);
    })();
  }, []);

  const onClick = useCallback(async () => {
    setProcessing(true);
    console.log('🎬 Starting verification demo...');

    trackEvent('devconnect', 'Start Verification', `started`);


    let verifier: TVerifier;
    try {
      console.log('🔧 Setting up Verifier');
      verifier = await new Verifier({
        max_sent_data: 2048,
        max_recv_data: 4096
      });
      console.log('🔧 Verifier class instantiated');
      await verifier.connect(proverProxyUrl);
    } catch (e: any) {
      console.error('Error setting up verifier: ' + e.message);
      console.error('Error connecting verifier to prover server: ' + e.message);

      trackEvent('devconnect', 'Error', `Connection failed`);

      setProcessing(false);
      return;
    }

    await new Promise((r) => setTimeout(r, 2000));

    console.log('🔐 Start verification');
    const verified = verifier.verify();
    const result = await verified;
    console.log('🔐 Verification completed');

    const sent_b = result.transcript?.sent || [];
    const recv_b = result.transcript?.recv || [];

    const server_name = result.server_name

    console.log(`🔑 Verified server name: ${server_name}`);

    let recv = bytesToUtf8(recv_b);
    let sent = bytesToUtf8(sent_b);

    // console.log('✅ Verified data received');
    // console.log(`📋 Transcript sent: ${sent.substring(0, 100)}${sent.length > 100 ? '...' : ''}`);
    // console.log(`📋 Transcript received: ${recv.substring(0, 100)}${recv.length > 100 ? '...' : ''}`);

    console.log('✅ Ready - verification completed successfully');

    setResult(`Sent to ${server_name}:\n` +
      sent +
      "\n" +
      `Received from ${server_name}:\n` +
      recv,
    );

    setProcessing(false);
    setShowConfetti(true);

    trackEvent('devconnect', 'Verification successful');

  }, [setResult, setProcessing]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
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
      <div className="w-full p-4 bg-slate-800 text-white flex-shrink-0 shadow-md">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">TLSNotary Devconnect Demo</h1>
          <a
            href="https://github.com/tlsnotary/devconnect25_demo"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors duration-200 group"
            title="View source on GitHub"
          >
            <svg
              className="w-6 h-6 group-hover:scale-110 transition-transform duration-200"
              fill="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
            </svg>
            <span className="text-sm font-medium">Source</span>
          </a>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 flex-grow">
        <div className="flex flex-col bg-white rounded-lg shadow-md border border-gray-200 p-4">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-3">
              Verify the Ethereum Foundation's bank balance with TLSNotary
            </h2>
            <p className="text-lg text-gray-600 mb-4">
              With this demo prover, you can verify the EF's bank balance without having access to this (fake) swiss bank yourself.
            </p>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 text-left rounded">
              <p className="text-gray-700 mb-2">
                <strong className="text-gray-800">How it works:</strong>
              </p>
              <p className="text-gray-700 mb-2">
                Your browser connects to our prover who proves <a href="https://swissbank.tlsnotary.org/balances" className="text-blue-600 underline hover:text-blue-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-sm">the bank balance</a> via TLSNotary's <strong>MPC-TLS protocol</strong>, giving you cryptographic guarantees of authenticity.
              </p>
              <p className="text-gray-700">
                You get a proof that the EF's Swiss Bank balance is genuine. The prover only reveals what it wants to reveal through <strong>selective disclosure</strong>.
              </p>
            </div>
          </div>

          <div className="text-center text-gray-700 mb-6">
            {/* Architecture Overview Diagram */}
            <div className="my-6 flex justify-center">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3 text-center">Demo Overview</h3>
                <OverviewDiagram />
              </div>
            </div>
          </div>

          {!processing && (
            <div className="text-center">
              <button
                onClick={ready ? onClick : undefined}
                disabled={!ready}
                className={`
                  inline-block px-6 py-3 rounded-xl font-semibold text-white mb-6 text-lg
                  transition-all duration-200 ease-in-out transform
                  shadow-lg hover:shadow-xl
                  ${!ready
                    ? 'bg-gray-400 cursor-not-allowed opacity-70'
                    : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 hover:scale-105 active:scale-95 hover:-translate-y-0.5'
                  }
                  focus:outline-none focus:ring-4 focus:ring-blue-300 focus:ring-opacity-50
                  border-0 relative overflow-hidden
                `}
              >
                <span className="relative z-10 flex items-center justify-center space-x-2">
                  <span>{ready ? 'Verify Bank Balance' : 'Initializing...'}</span>
                </span>
                {ready && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 hover:opacity-20 transition-opacity duration-200"></div>
                )}
              </button>
            </div>
          )}

          {/* Console Log View */}
          <div className="mb-4">
            <h3 className="text-md font-semibold text-gray-800 mb-2">Console Log</h3>
            <ScrollToBottom className="flex flex-col text-sm bg-slate-50 border border-slate-200 w-full h-48 py-2 overflow-y-auto rounded">
              {consoleMessages.map((m, index) => (
                <div
                  key={index}
                  data-testid="console-log"
                  className="px-3 py-1 text-slate-600 break-all whitespace-pre-wrap"
                >
                  {m}
                </div>
              ))}
            </ScrollToBottom>
          </div>

          <div className="mt-6 mb-4">
            {(processing || result) && (
              <>
                <h3 className="text-md font-semibold text-gray-800 mb-2">Verified data:</h3>
                <div className="bg-gray-100 border border-gray-300 p-4 rounded-lg mt-4">
                  {processing ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="ml-3 text-gray-600">Verifying...</span>
                    </div>
                  ) : (
                    <pre data-testid="proof-data" className="text-left text-sm text-gray-800 whitespace-pre-wrap break-all overflow-auto">
                      {result}
                    </pre>
                  )}
                </div>
              </>
            )}
          </div>

          {/* POAP Link Section - Only shown when verification is successful and POAP link is configured */}
          {result && (
            <div className="mt-6 mb-4">
              <h3 className="text-md font-semibold text-gray-800 mb-2">🎉 Verification Successful!</h3>
              {poapLink && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-800 font-medium mb-1">Claim your POAP!</p>
                      <p className="text-green-700 text-sm">
                        You've successfully verified data using TLSNotary.
                      </p>
                    </div>
                    <a
                      href={poapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors duration-200 flex items-center space-x-2"
                      onClick={() => trackEvent('devconnect', 'Click POAP')}
                    >
                      <span>🏆</span>
                      <span>Claim POAP</span>
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}


        </div>
      </div>

      {/* Footer */}
      {gitCommitSha && (
        <footer className="w-full p-3 bg-slate-800 text-gray-400 text-center text-xs flex-shrink-0">
          {githubRepository ? (
            <a
              href={`https://github.com/${githubRepository}/commit/${gitCommitSha}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors duration-200"
            >
              Build: {gitCommitSha.slice(0, 7)}
            </a>
          ) : (
            <span>Build: {gitCommitSha.slice(0, 7)}</span>
          )}
        </footer>
      )}
    </div>
  );
}

function bytesToUtf8(array: number[]): string {
  return Buffer.from(array).toString("utf8").replaceAll('\u0000', '█');
}