import express, { Application, Request, Response } from "express";
import cors from "cors";

const app: Application = express();

app.use(cors());
app.use(express.json());

/**
 * Stable account data for consistent TLS proofs
 * 
 * The "eligible" field is the key field that will be extracted
 * and proven via TLSNotary.
 */
const ACCOUNT_DATA = {
  accountId: "ACC-12345678",
  accountHolder: "Demo User",
  email: "demo@example.com",
  balance: 150000.0,
  currency: "USD",
  accountType: "checking",
  eligible: true,           // ← Key field for RWA eligibility
  accredited: true,         // Accredited investor status
  kycVerified: true,        // KYC verification status
  jurisdiction: "US",
  createdAt: "2024-01-15T00:00:00Z",
  lastUpdated: "2025-01-11T00:00:00Z",
};

/**
 * GET /api/account
 * Returns account data with eligibility status
 */
app.get("/api/account", (req: Request, res: Response) => {
  // Log the request for debugging
  console.log(`[${new Date().toISOString()}] GET /api/account`);
  console.log(`  User-Agent: ${req.headers["user-agent"]}`);
  console.log(`  Authorization: ${req.headers["authorization"] ? "present" : "none"}`);

  // Set headers that make the response realistic
  res.set({
    "Content-Type": "application/json",
    "X-Request-Id": `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": "99",
  });

  // Return the stable account data
  res.json(ACCOUNT_DATA);
});

/**
 * GET /api/balances
 * Alternative endpoint returning just balance info
 * (Compatible with the swissbank format from prover-demo)
 */
app.get("/api/balances", (req: Request, res: Response) => {
  console.log(`[${new Date().toISOString()}] GET /api/balances`);

  res.set({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });

  res.json({
    organization: "Zk-RWA Demo Bank",
    bank: "Mock Swiss Bank",
    accounts: {
      USD: "150,000.00",
      EUR: "125,000.00",
      CHF: "140,000.00",
    },
    eligible: true,
    lastUpdated: "2025-01-11T00:00:00Z",
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "mock-bank",
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/auth
 * Mock authentication endpoint
 * Returns a session token for realistic transcript
 */
app.post("/api/auth", (req: Request, res: Response) => {
  const { username, password } = req.body;
  
  console.log(`[${new Date().toISOString()}] POST /api/auth`);
  console.log(`  Username: ${username}`);

  if (username && password) {
    const sessionToken = `session-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    
    res.cookie("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600000, // 1 hour
    });

    res.json({
      success: true,
      message: "Authentication successful",
      token: sessionToken,
    });
  } else {
    res.status(400).json({
      success: false,
      error: "Username and password required",
    });
  }
});

// Start server
const PORT = parseInt(process.env.MOCK_BANK_PORT || "3002");

app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("Zk-RWA-Kit Mock Bank Service");
  console.log("=".repeat(50));
  console.log(`Port:     ${PORT}`);
  console.log(`Endpoints:`);
  console.log(`  GET  /api/account   - Account with eligibility`);
  console.log(`  GET  /api/balances  - Balance summary`);
  console.log(`  POST /api/auth      - Mock authentication`);
  console.log(`  GET  /health        - Health check`);
  console.log("=".repeat(50));
  console.log(`Mock Bank listening on http://localhost:${PORT}`);
});

export default app;
