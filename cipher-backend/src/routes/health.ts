import { Router } from 'express';
import * as anchor from "@coral-xyz/anchor";
import type { CipherScore } from "../../../target/types/cipher_score.ts";
import { Program } from "@coral-xyz/anchor";

const router = Router();

// Health check
router.get('/health', (req, res) => {
  const program = req.app.locals.program as Program<CipherScore>;
  const provider = req.app.locals.provider as anchor.AnchorProvider;
  const payerWallet = req.app.locals.payerWallet as anchor.web3.Keypair;
  
  const isInitialized = program && provider && payerWallet;
  res.json({
    status: isInitialized ? 'OK' : 'INITIALIZING',
    program_initialized: !!program,
    wallet_loaded: !!payerWallet,
    timestamp: new Date().toISOString()
  });
});

export default router; 