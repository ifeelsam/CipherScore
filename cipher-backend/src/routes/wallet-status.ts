import { Router } from 'express';
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import type { CipherScore } from "../../../target/types/cipher_score.ts";
import { Program } from "@coral-xyz/anchor";

const router = Router();

// Helper function for wallet status logic
async function getWalletStatus(walletAddress: PublicKey, program: Program<CipherScore>) {
  console.log(`Checking wallet status for: ${walletAddress.toString()}`);

  const [creditAccountPub] = PublicKey.findProgramAddressSync(
    [Buffer.from("credit"), walletAddress.toBuffer()],
    program.programId
  );

  try {
    const creditAccount = await program.account.creditAccount.fetch(creditAccountPub);
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
    const lastUpdated = creditAccount.lastUpdated.toNumber();
    const scoreTimestamp = creditAccount.scoreTimestamp.toNumber();
    const cooldownPeriod = 0; // Cooldown disabled for testing
    const timeSinceUpdate = currentTime - lastUpdated;
    const remainingCooldown = Math.max(0, cooldownPeriod - timeSinceUpdate);
    
    // Convert to human readable format
    const hoursRemaining = Math.floor(remainingCooldown / 3600);
    const minutesRemaining = Math.floor((remainingCooldown % 3600) / 60);
    
    return {
      wallet_address: walletAddress.toString(),
      credit_account: creditAccountPub.toString(),
      account_exists: true,
      current_score: creditAccount.currentScore,
      risk_level: creditAccount.riskLevel,
      last_updated: new Date(lastUpdated * 1000).toISOString(),
      score_timestamp: new Date(scoreTimestamp * 1000).toISOString(),
      cooldown_status: {
        can_update: remainingCooldown === 0,
        remaining_seconds: remainingCooldown,
        remaining_time: remainingCooldown === 0 ? "Ready to update" : `${hoursRemaining}h ${minutesRemaining}m`,
        next_update_available: new Date((lastUpdated + cooldownPeriod) * 1000).toISOString()
      }
    };

  } catch (accountError) {
    // Account doesn't exist yet
    return {
      wallet_address: walletAddress.toString(),
      credit_account: creditAccountPub.toString(),
      account_exists: false,
      current_score: null,
      risk_level: null,
      last_updated: null,
      score_timestamp: null,
      cooldown_status: {
        can_update: true,
        remaining_seconds: 0,
        remaining_time: "Ready for first calculation",
        next_update_available: "Now"
      }
    };
  }
}

// Get wallet status for current payer wallet
router.get('/wallet_status', async (req, res) => {
  try {
    const program = req.app.locals.program as Program<CipherScore>;
    const provider = req.app.locals.provider as anchor.AnchorProvider;
    const payerWallet = req.app.locals.payerWallet as anchor.web3.Keypair;
    
    if (!program || !provider || !payerWallet) {
      return res.status(503).json({
        error: "Solana not initialized"
      });
    }

    const data = await getWalletStatus(payerWallet.publicKey, program);
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error checking wallet status:', error);
    res.status(500).json({
      error: 'Failed to check wallet status',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Get wallet status for specific wallet address
router.get('/wallet_status/:wallet_address', async (req, res) => {
  try {
    const program = req.app.locals.program as Program<CipherScore>;
    const provider = req.app.locals.provider as anchor.AnchorProvider;
    const payerWallet = req.app.locals.payerWallet as anchor.web3.Keypair;
    
    if (!program || !provider || !payerWallet) {
      return res.status(503).json({
        error: "Solana not initialized"
      });
    }

    const walletAddress = new PublicKey(req.params.wallet_address);
    const data = await getWalletStatus(walletAddress, program);
    
    res.json({
      success: true,
      data,
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error checking wallet status:', error);
    res.status(500).json({
      error: 'Failed to check wallet status',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

export default router; 