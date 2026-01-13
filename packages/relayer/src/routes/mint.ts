import { Router, Request, Response } from 'express';
import { mintTokens, isAddressVerified } from '../services/chain';

export const mintRouter: Router = Router();

interface MintRequest {
  recipient: string;
  amount?: string;
}

/**
 * POST /mint
 * Mint mUSDY tokens to a verified address
 */
mintRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { recipient, amount = '1000' } = req.body as MintRequest;

    if (!recipient) {
      return res.status(400).json({
        success: false,
        error: 'Missing recipient address',
        code: 'MISSING_FIELD',
      });
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address',
        code: 'INVALID_ADDRESS',
      });
    }

    console.log(`Mint request: ${amount} mUSDY to ${recipient}`);

    const isVerified = await isAddressVerified(recipient);
    if (!isVerified) {
      console.log(`Mint rejected: ${recipient} is not verified`);
      return res.status(403).json({
        success: false,
        error: 'Recipient is not verified for mUSDY tokens',
        code: 'NOT_VERIFIED',
      });
    }

    const result = await mintTokens(recipient, amount);

    console.log(`Mint successful: ${result.txHash} (${result.symbol})`);

    res.json({
      success: true,
      txHash: result.txHash,
      recipient,
      amount,
      symbol: result.symbol,
    });
  } catch (error: any) {
    console.error('Mint error:', error.message);

    if (error.message.includes('Recipient not eligible')) {
      return res.status(403).json({
        success: false,
        error: 'Recipient is not eligible for mUSDY tokens',
        code: 'NOT_ELIGIBLE',
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Mint failed',
      code: 'CHAIN_ERROR',
    });
  }
});
