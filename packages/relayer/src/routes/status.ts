import { Router, Request, Response } from "express";
import { getTransactionStatus } from "../services/chain";

export const statusRouter: Router = Router();

statusRouter.get("/:txHash", async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;

    // Validate tx hash format
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return res.status(400).json({
        success: false,
        error: "Invalid transaction hash format",
      });
    }

    const status = await getTransactionStatus(txHash);

    res.json({
      success: true,
      ...status,
    });

  } catch (error) {
    console.error("Status check error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to check transaction status",
    });
  }
});
