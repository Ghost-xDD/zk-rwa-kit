import express, { Application, Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { proofRouter } from "./routes/proof";
import { statusRouter } from "./routes/status";

// Load environment variables
dotenv.config({ path: "../../.env" });

const app: Application = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000"), // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "10"),
  message: {
    success: false,
    error: "Too many requests, please try again later",
    code: "RATE_LIMITED",
  },
});
app.use(limiter);

// Routes
app.use("/submit-proof", proofRouter);
app.use("/status", statusRouter);

// Health check
app.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    chain: {
      rpc: process.env.MANTLE_SEPOLIA_RPC_URL ? "configured" : "missing",
      oracle: process.env.ZK_ORACLE_ADDRESS ? "configured" : "missing",
    },
  });
});

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
});

// Start server
const PORT = parseInt(process.env.RELAYER_PORT || "3001");

app.listen(PORT, () => {
  console.log("=".repeat(50));
  console.log("Zk-RWA-Kit Relayer Service");
  console.log("=".repeat(50));
  console.log(`Port:     ${PORT}`);
  console.log(`RPC:      ${process.env.MANTLE_SEPOLIA_RPC_URL || "not configured"}`);
  console.log(`Oracle:   ${process.env.ZK_ORACLE_ADDRESS || "not configured"}`);
  console.log("=".repeat(50));
  console.log(`Relayer listening on http://localhost:${PORT}`);
});

export default app;
