import { Router } from 'express';
import * as anchor from "@coral-xyz/anchor";
import type { CipherScore } from "../../../target/types/cipher_score.ts";
import { Program } from "@coral-xyz/anchor";

const router = Router();

// Initialize computation definitions
router.post('/init_comp_def', async (req, res) => {
  try {
    const program = req.app.locals.program as Program<CipherScore>;
    const provider = req.app.locals.provider as anchor.AnchorProvider;
    const payerWallet = req.app.locals.payerWallet as anchor.web3.Keypair;
    const initCalculateScoreCompDef = req.app.locals.initCalculateScoreCompDef;
    
    if (!program || !provider || !payerWallet) {
      return res.status(503).json({
        error: "Solana not initialized. Please wait for initialization to complete.",
        timestamp: new Date().toISOString()
      });
    }

    console.log("Initializing computation definitions...");
    
    const signature = await initCalculateScoreCompDef(program, payerWallet, false);
    
    // Mark as initialized on success
    req.app.locals.compDefInitialized = true;
    console.log("Computation definitions initialized successfully:", signature);

    res.json({
      success: true,
      data: {
        transaction_signature: signature,
        message: "Computation definitions initialized successfully"
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error initializing computation definitions:', error);
    
    // Check if already initialized
    if (error.message?.includes("already initialized") || 
        error.message?.includes("AlreadyInitialized")) {
      return res.json({
        success: true,
        data: {
          message: "Computation definitions already initialized"
        },
        timestamp: new Date().toISOString()
      });
    }

    res.status(500).json({
      error: 'Failed to initialize computation definitions',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get sample wallet data for testing
router.get('/sample_wallets', (req, res) => {
  const samples = {
    high_quality: {
      wallet_age_days: 400,
      transaction_count: 150,
      total_volume_usd: 15_000_000, // $15k volume (scaled by 1000)
      unique_protocols: 12,
      defi_positions: 5,
      nft_count: 10,
      failed_txs: 2,
      sol_balance: 100_000_000_000, // 100 SOL in lamports
    },
    medium_quality: {
      wallet_age_days: 180,
      transaction_count: 50,
      total_volume_usd: 5_000_000, // $5k volume
      unique_protocols: 5,
      defi_positions: 2,
      nft_count: 3,
      failed_txs: 1,
      sol_balance: 10_000_000_000, // 10 SOL
    },
    low_quality: {
      wallet_age_days: 30,
      transaction_count: 5,
      total_volume_usd: 100_000, // $100 volume
      unique_protocols: 1,
      defi_positions: 0,
      nft_count: 0,
      failed_txs: 3,
      sol_balance: 1_000_000, // 0.001 SOL
    }
  };

  res.json({
    success: true,
    data: samples,
    description: "Sample wallet metrics for testing the credit score API"
  });
});

export default router; 