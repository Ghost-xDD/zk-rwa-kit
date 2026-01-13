import { Router, Request, Response } from 'express';
import { submitClaimOnChain } from '../services/chain';
import { validateTranscript } from '../services/verifier';

export const proofRouter: Router = Router();

interface SubmitProofRequest {
  walletAddress: string;
  transcript: {
    sent: string;
    received: string;
    serverName: string;
  };
  claimType: string;
  extractedValue: string;
}

proofRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { walletAddress, transcript, claimType, extractedValue } =
      req.body as SubmitProofRequest;

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing walletAddress',
        code: 'MISSING_FIELD',
      });
    }

    if (!transcript || !transcript.received) {
      return res.status(400).json({
        success: false,
        error: 'Missing transcript',
        code: 'MISSING_FIELD',
      });
    }

    if (!claimType) {
      return res.status(400).json({
        success: false,
        error: 'Missing claimType',
        code: 'MISSING_FIELD',
      });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format',
        code: 'INVALID_TRANSCRIPT',
      });
    }

    const validation = validateTranscript(transcript, extractedValue);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: validation.error,
        code: 'INVALID_TRANSCRIPT',
      });
    }

    console.log(`Processing proof submission for ${walletAddress}`);
    console.log(`Claim type: ${claimType}, value: ${extractedValue}`);

    const result = await submitClaimOnChain(
      walletAddress,
      claimType,
      extractedValue || 'true'
    );

    console.log(`Transaction submitted: ${result.txHash}`);

    res.json({
      success: true,
      txHash: result.txHash,
      claimType,
      claimValue: extractedValue || 'true',
      expiry: result.expiry,
    });
  } catch (error) {
    console.error('Proof submission error:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('insufficient funds')) {
      return res.status(503).json({
        success: false,
        error: 'Relayer has insufficient funds for gas',
        code: 'CHAIN_ERROR',
      });
    }

    res.status(500).json({
      success: false,
      error: 'Chain submission failed: ' + errorMessage,
      code: 'CHAIN_ERROR',
    });
  }
});
