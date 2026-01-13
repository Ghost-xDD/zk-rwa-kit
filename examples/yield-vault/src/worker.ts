import * as Comlink from 'comlink';
import initWasm, { LoggingLevel, initialize, Verifier, CrateLogFilter } from 'tlsn-wasm';

// Capture console logs from the worker - use a simple buffer that main thread polls
const logBuffer: string[] = [];

// Save original console methods
const originalConsoleLog = console.log;
const originalConsoleInfo = console.info;
const originalConsoleDebug = console.debug;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

console.log = (...args) => {
  const message = args.join(' ');
  logBuffer.push(message);
  originalConsoleLog.apply(console, args);
};

console.info = (...args) => {
  const message = args.join(' ');
  logBuffer.push(message);
  originalConsoleInfo.apply(console, args);
};

console.debug = (...args) => {
  const message = args.join(' ');
  logBuffer.push(message);
  originalConsoleDebug.apply(console, args);
};

console.warn = (...args) => {
  const message = args.join(' ');
  logBuffer.push(message);
  originalConsoleWarn.apply(console, args);
};

console.error = (...args) => {
  const message = args.join(' ');
  logBuffer.push(message);
  originalConsoleError.apply(console, args);
};

// Test that our overrides are working
originalConsoleLog('[worker.ts] Console overrides installed');

// Function for main thread to retrieve buffered logs
function getBufferedLogs(): string[] {
  const logs = [...logBuffer];
  logBuffer.length = 0; // Clear the buffer
  return logs;
}

Comlink.expose({
  init,
  Verifier,
  getBufferedLogs,
});

export default async function init(config?: {
  loggingLevel?: LoggingLevel;
  hardwareConcurrency?: number;
  crateFilters?: CrateLogFilter[];
}) {
  const {
    loggingLevel = 'Info',
    hardwareConcurrency = navigator.hardwareConcurrency,
    crateFilters,
  } = config || {};

  // console.log('[worker.ts] init() called, about to initialize WASM');
  // console.debug('[worker.ts] This is a debug message from worker init');

  const res = await initWasm();

  // console.log('[worker.ts] initWasm() completed');

  await initialize(
    {
      level: loggingLevel,
      crate_filters: crateFilters,
      span_events: undefined,
    },
    hardwareConcurrency,
  );

  // console.log('[worker.ts] initialize() completed');
}
