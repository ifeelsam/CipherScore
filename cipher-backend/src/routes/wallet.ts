import { Router } from 'express';
import * as anchor from "@coral-xyz/anchor";

const router = Router();

// Get wallet info
router.get('/wallet', async (req, res) => {
  try {
    const payerWallet = req.app.locals.payerWallet as anchor.web3.Keypair;
    const provider = req.app.locals.provider as anchor.AnchorProvider;
    const PROGRAM_ADDRESS = req.app.locals.PROGRAM_ADDRESS as string;
    const compDefInitialized = req.app.locals.compDefInitialized as boolean;
    
    if (!payerWallet || !provider) {
      return res.status(503).json({
        error: "Solana not initialized"
      });
    }

    const balance = await provider.connection.getBalance(payerWallet.publicKey);

    res.json({
      success: true,
      data: {
        public_key: payerWallet.publicKey.toString(),
        balance_sol: balance / anchor.web3.LAMPORTS_PER_SOL,
        balance_lamports: balance,
        program_address: PROGRAM_ADDRESS,
        comp_def_initialized: compDefInitialized,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    res.status(500).json({
      error: error.message || "Failed to get wallet info"
    });
  }
});

export default router; 