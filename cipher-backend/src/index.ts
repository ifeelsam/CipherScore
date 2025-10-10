import express from 'express';
import IDL from "../../target/idl/cipher_score.json";
import type { CipherScore } from "../../target/types/cipher_score.ts"
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Connection, clusterApiUrl } from "@solana/web3.js";
import { randomBytes } from "crypto";
import {
  awaitComputationFinalization,
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  getArciumProgAddress,
  RescueCipher,
  deserializeLE,
  getClusterAccAddress,
  getMXEPublicKey,
  getMXEAccAddress,
  getMempoolAccAddress,
  getCompDefAccAddress,
  getExecutingPoolAccAddress,
  getComputationAccAddress,
  x25519,
} from "@arcium-hq/client";
import * as fs from "fs";
import * as os from "os";
import cors from 'cors';
import { db } from './database.js'

// Import route modules
import healthRoutes from './routes/health.js';
import walletRoutes from './routes/wallet.js';
import walletStatusRoutes from './routes/wallet-status.js';
import adminRoutes from './routes/admin.js';
import apiKeyRoutes from './routes/api-keys.js';
import userRoutes from './routes/users.js';
import walletAuthRoutes from './routes/wallet-auth.js';
import userApiKeyRoutes from './routes/user-api-keys.js';
import userProfileRoutes from './routes/user-profile.js'

// Import middleware
import authenticateAPIKey, { requireAdmin } from './middleware/auth.js';

const PROGRAM_ADDRESS = IDL.address || "Y6EgVRhLQCnh6cDDetuH3eYRWSscpubkFp1iuvtGqT7";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// CORS for frontend (adjust origin via env if needed)
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:3001';
app.use(cors());

// Types based on the cipher_score.ts and lib.rs
interface WalletMetrics {
  wallet_age_days: number;
  transaction_count: number;
  total_volume_usd: number;  // In USD scaled by 1000
  unique_protocols: number;
  defi_positions: number;
  nft_count: number;
  failed_txs: number;
  sol_balance: number;  // In lamports
}

interface CreditScoreResponse {
  success: boolean;
  data?: {
    wallet: string;
    score: number;
    risk_level: 'low' | 'medium' | 'high';
    transaction_signature: string;
    computation_offset: string;
  };
  error?: string;
  timestamp: string;
  details?: string;
  error_code?: string;
  cooldown_period_hours?: number;
  suggestion?: string;
}

// Global variables for program state
let program: Program<CipherScore>;
let provider: anchor.AnchorProvider;
let payerWallet: anchor.web3.Keypair;
let mxePublicKey: Uint8Array;
let compDefInitialized = false;

// Initialize Solana connection and program
async function initializeSolana() {
  try {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Load payer wallet from wallet.json
    try {
      const walletPath = "../wallet.json";
      if (fs.existsSync(walletPath)) {
        const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
        payerWallet = anchor.web3.Keypair.fromSecretKey(new Uint8Array(walletData));
        console.log("Loaded wallet from wallet.json:", payerWallet.publicKey.toString());
      } else {
        // Fallback to system wallet
        const keypairPath = `${os.homedir()}/.config/solana/id.json`;
        const file = fs.readFileSync(keypairPath);
        payerWallet = anchor.web3.Keypair.fromSecretKey(
          new Uint8Array(JSON.parse(file.toString()))
        );
        console.log("Loaded system wallet:", payerWallet.publicKey.toString());
      }
    } catch (error: any) {
      throw new Error(`Failed to load wallet: ${error.message}`);
    }

    // Check balance (no airdrop)
    const balance = await connection.getBalance(payerWallet.publicKey);
    console.log("Current balance:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");

    if (balance < 0.1 * anchor.web3.LAMPORTS_PER_SOL) {
      console.log("Low balance! You may need to fund this wallet for transactions.");
    }

    // Set up provider
    provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(payerWallet),
      { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    // Initialize program with explicit program ID to avoid mismatch
    const programId = new PublicKey(PROGRAM_ADDRESS);
    program = new anchor.Program(IDL as any, provider);

    // Verify the program ID matches
    console.log("Expected Program ID:", PROGRAM_ADDRESS);
    console.log("IDL Program ID:", IDL.address);
    console.log("Program initialized with ID:", program.programId.toString());

    // Get MXE public key

    // Check if CompDef is already initialized
    try {
      const compDefAddress = getCompDefAccAddress(
        program.programId,
        Buffer.from(getCompDefAccOffset("calculate_credit_score")).readUInt32LE()
      );
      
      const compDefAccount = await provider.connection.getAccountInfo(compDefAddress);
      if (compDefAccount) {
        compDefInitialized = true;
        console.log("Computation definition already initialized");
      } else {
        console.log("Computation definition not initialized. Use /init_comp_def endpoint to initialize.");
        compDefInitialized = false;
      }
    } catch (error) {
      console.log("Error checking CompDef status:", error);
      compDefInitialized = false;
    }

    mxePublicKey = await getMXEPublicKeyWithRetry(provider as any, program.programId);

    console.log("MXE x25519 pubkey obtained");
    
    // Store globals in app.locals for route access
    app.locals.program = program;
    app.locals.provider = provider;
    app.locals.payerWallet = payerWallet;
    app.locals.mxePublicKey = mxePublicKey;
    app.locals.compDefInitialized = compDefInitialized;
    app.locals.PROGRAM_ADDRESS = PROGRAM_ADDRESS;
    app.locals.initCalculateScoreCompDef = initCalculateScoreCompDef;
    
    return true;
  } catch (error) {
    console.error("Failed to initialize Solana:", error);
    return false;
  }
}

/**
 * Calculate credit score using the actual Solana program
 */
async function calculate_credit_score_on_chain(metrics: WalletMetrics): Promise<CreditScoreResponse> {
  let timeoutId: NodeJS.Timeout | undefined;
  let listenerId: number | undefined;
  
  try {
    console.log("Starting credit score calculation with metrics:", JSON.stringify(metrics, null, 2));
    
    if (!program || !provider || !payerWallet || !mxePublicKey) {
      throw new Error("Solana not initialized. Please restart the server.");
    }
    
    console.log("All required components initialized");

    // Setup encryption
    console.log("Setting up encryption...");
    const privateKey = x25519.utils.randomSecretKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    // Convert metrics to BigInt array
    console.log("Converting metrics to BigInt array...");
    const metricsArray = [
      BigInt(metrics.wallet_age_days),
      BigInt(metrics.transaction_count),
      BigInt(metrics.total_volume_usd),
      BigInt(metrics.unique_protocols),
      BigInt(metrics.defi_positions),
      BigInt(metrics.nft_count),
      BigInt(metrics.failed_txs),
      BigInt(metrics.sol_balance),
    ];

    const nonce = randomBytes(16);
    console.log("Encrypting metrics...");
    const ciphertext = cipher.encrypt(metricsArray, nonce);
    console.log("Metrics encrypted successfully");

    // Use the existing funded wallet instead of creating new ones
    const testWallet = payerWallet;
    console.log("Using existing funded wallet for calculation");

    const [creditAccountPub] = PublicKey.findProgramAddressSync(
      [Buffer.from("credit"), testWallet.publicKey.toBuffer()],
      program.programId
    );

    // Listen for score calculation event
    console.log("Setting up event listener for scoreCalculated...");
    
    const scoreCalculatedPromise = new Promise<any>((resolve, reject) => {
      listenerId = program.addEventListener("scoreCalculated", (event) => {
        console.log("Score calculation event received:", event);
        resolve(event);
      });
      
      console.log(`Event listener registered with ID: ${listenerId}`);

      // Set a reasonable timeout just in case event doesn't arrive
      timeoutId = setTimeout(() => {
        console.log("Score calculation event timed out after 60 seconds");
        reject(new Error("Score calculation event timeout. The MXE computation may have failed."));
      }, 60000);
    });

    const computationOffset = new anchor.BN(randomBytes(8), "hex");
    const arciumEnv = getClusterAccAddress(1078779259);
    console.log("Cluster Account:", arciumEnv.toString());
    
    // Debug all the accounts we're using
    const mxeAccountAddress = getMXEAccAddress(program.programId);
    const mempoolAccountAddress = getMempoolAccAddress(program.programId);
    const executingPoolAddress = getExecutingPoolAccAddress(program.programId);
    const compDefAccountAddress = getCompDefAccAddress(
      program.programId,
      Buffer.from(getCompDefAccOffset("calculate_credit_score")).readUInt32LE()
    );
    
    console.log("MXE Account:", mxeAccountAddress.toString());
    console.log("Mempool Account:", mempoolAccountAddress.toString());
    console.log("Executing Pool:", executingPoolAddress.toString());
    console.log("CompDef Account:", compDefAccountAddress.toString());
    
    // Check if these accounts exist
    try {
      const [mxeExists, mempoolExists, poolExists, compDefExists] = await Promise.all([
        provider.connection.getAccountInfo(mxeAccountAddress).then(a => !!a),
        provider.connection.getAccountInfo(mempoolAccountAddress).then(a => !!a),
        provider.connection.getAccountInfo(executingPoolAddress).then(a => !!a),
        provider.connection.getAccountInfo(compDefAccountAddress).then(a => !!a)
      ]);
      
      console.log("Account existence check:");
      console.log("  - MXE:", mxeExists);
      console.log("  - Mempool:", mempoolExists);
      console.log("  - Executing Pool:", poolExists);
      console.log("  - CompDef:", compDefExists);
    } catch (error) {
      console.log("Error checking account existence:", error);
    }

    // Submit metrics and calculate score
    const queueSig = await program.methods
      .submitAndCalculateScore(
        computationOffset,
        {
          walletAgeDays: Array.from(ciphertext[0] || []),
          transactionCount: Array.from(ciphertext[1] || []),
          totalVolumeUsd: Array.from(ciphertext[2] || []),
          uniqueProtocols: Array.from(ciphertext[3] || []),
          defiPositions: Array.from(ciphertext[4] || []),
          nftCount: Array.from(ciphertext[5] || []),
          failedTxs: Array.from(ciphertext[6] || []),
          solBalance: Array.from(ciphertext[7] || []),
        },
        Array.from(publicKey),
        new anchor.BN(deserializeLE(nonce).toString())
      )
      .accountsPartial({
        payer: payerWallet.publicKey,
        wallet: testWallet.publicKey,
        creditAccount: creditAccountPub,
        computationAccount: getComputationAccAddress(
          program.programId,
          computationOffset
        ),
        clusterAccount: arciumEnv,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(program.programId),
        executingPool: getExecutingPoolAccAddress(program.programId),
        compDefAccount: getCompDefAccAddress(
          program.programId,
          Buffer.from(getCompDefAccOffset("calculate_credit_score")).readUInt32LE()
        ),
      })
      .signers([payerWallet, testWallet])
      .rpc({ commitment: "confirmed" });

    console.log("Transaction submitted (queue):", queueSig);
    
    // Wait for MXE event immediately - don't wait for finalization
    console.log("Waiting for MXE computation event...");
    const scoreEvent = await scoreCalculatedPromise;
    
    // Got the score from MXE event - return immediately
    console.log(`Credit Score Calculated: ${scoreEvent.score}`);
    console.log(`Risk Level: ${JSON.stringify(scoreEvent.riskLevel)}`);

    // Clean up event listener
    if (timeoutId) clearTimeout(timeoutId);
    if (listenerId !== undefined) {
      console.log(`Cleaning up event listener ${listenerId}`);
      await program.removeEventListener(listenerId);
    }

    // Determine risk level string
    let riskLevelString: 'low' | 'medium' | 'high';
    if (scoreEvent.riskLevel.low !== undefined) {
      riskLevelString = 'low';
    } else if (scoreEvent.riskLevel.medium !== undefined) {
      riskLevelString = 'medium';
    } else {
      riskLevelString = 'high';
    }

    // Start finalization in background for logging (don't await)
    awaitComputationFinalization(
      provider,
      computationOffset,
      program.programId,
      "confirmed"
    ).then(finalizeSig => {
      console.log("Computation finalized (background):", finalizeSig);
    }).catch(error => {
      console.log("Background finalization failed:", error);
    });

    return {
      success: true,
      data: {
        wallet: testWallet.publicKey.toString(),
        score: scoreEvent.score,
        risk_level: riskLevelString,
        transaction_signature: queueSig,
        computation_offset: computationOffset.toString(),
      },
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    console.error("Error calculating credit score:", error);

    // Clean up event listener and timeout in case of error
    if (timeoutId) clearTimeout(timeoutId);
    if (listenerId !== undefined) {
      try {
        await program.removeEventListener(listenerId);
        console.log("Event listener cleaned up after error");
      } catch (cleanupError) {
        console.error("Failed to cleanup event listener:", cleanupError);
      }
    }

    // Check for specific error types
    if (error.message?.includes("insufficient funds") ||
      error.message?.includes("0x1")) {
      return {
        success: false,
        error: "Insufficient funds. Please fund the wallet or contact support.",
        timestamp: new Date().toISOString()
      };
    }

    if (error.message?.includes("timeout")) {
      return {
        success: false,
        error: "Computation timeout. The calculation may still be processing on-chain. Please try again later.",
        details: error.message,
        timestamp: new Date().toISOString()
      };
    }

    if (error.message?.includes("AccountNotInitialized")) {
      return {
        success: false,
        error: "Required accounts not initialized. Please call POST /init_comp_def first.",
        timestamp: new Date().toISOString()
      };
    }

    if (error.message?.includes("UpdateTooSoon") || 
        error.message?.includes("Must wait 24 hours between score updates") ||
        (error.error && error.error.errorMessage?.includes("Must wait 24 hours between score updates"))) {
      return {
        success: false,
        error: "Cooldown period active. Must wait 24 hours between score updates for the same wallet.",
        error_code: "UpdateTooSoon",
        cooldown_period_hours: 24,
        suggestion: "Use GET /wallet_status or GET /wallet_status/{wallet_address} to check when you can update again",
        timestamp: new Date().toISOString()
      };
    }

    return {
      success: false,
      error: error.message || "Unknown error occurred",
      timestamp: new Date().toISOString()
    };
  }
}

// Public routes (no auth required)
app.use('/', healthRoutes);
app.use('/auth', userRoutes); // Public signup (deprecated - use wallet auth)
app.use('/wallet-auth', walletAuthRoutes); // Wallet-based authentication

// Admin routes (require admin key)
app.use('/admin', requireAdmin, apiKeyRoutes);

// Frontend user routes (require session token)
app.use('/dashboard/api-keys', userApiKeyRoutes); // API key management for frontend
app.use('/dashboard/profile', userProfileRoutes);

// Protected API routes (require API key)
app.use('/', authenticateAPIKey, walletRoutes);
app.use('/', authenticateAPIKey, walletStatusRoutes);
app.use('/', authenticateAPIKey, adminRoutes);
app.use('/user', authenticateAPIKey, userRoutes); // User profile routes

app.post('/calculate_credit_score', authenticateAPIKey, async (req, res) => {
  try {
    if (!program || !provider || !payerWallet) {
      return res.status(503).json({
        error: "Solana not initialized. Please wait for initialization to complete.",
        timestamp: new Date().toISOString()
      });
    }

    if (!compDefInitialized) {
      return res.status(503).json({
        error: "Computation definitions not initialized. Please call POST /init_comp_def first.",
        timestamp: new Date().toISOString()
      });
    }

    // Wallet-only mode: accept { wallet_address } and fetch on-chain metrics
    let metrics: WalletMetrics | null = null;
    const walletAddress = (req.body?.wallet_address || req.body?.walletAddress) as string | undefined;
    if (walletAddress) {
      try {
        const walletPubkey = new PublicKey(walletAddress);
        console.log(`Wallet-only mode for ${walletPubkey.toBase58()}`);
        metrics = await fetchWalletMetrics(walletPubkey, provider.connection);
      } catch (e: any) {
        return res.status(400).json({
          error: 'Invalid wallet address or failed to fetch on-chain data',
          details: e?.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Manual mode fallback
    if (!metrics) {
      const body = req.body as WalletMetrics;

    // Validate required fields
    const required_fields = [
      'wallet_age_days',
      'transaction_count',
      'total_volume_usd',
      'unique_protocols',
      'defi_positions',
      'nft_count',
      'failed_txs',
      'sol_balance'
    ];

    for (const field of required_fields) {
        if (typeof body[field as keyof WalletMetrics] !== 'number') {
        return res.status(400).json({
          error: `Missing or invalid field: ${field}`,
          expected_type: 'number',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Validate ranges
      if (body.wallet_age_days < 0) {
      return res.status(400).json({
        error: 'wallet_age_days must be non-negative',
        timestamp: new Date().toISOString()
      });
    }
      if (body.transaction_count < 0) {
      return res.status(400).json({
        error: 'transaction_count must be non-negative',
        timestamp: new Date().toISOString()
      });
    }
      if (body.total_volume_usd < 0) {
      return res.status(400).json({
        error: 'total_volume_usd must be non-negative',
        timestamp: new Date().toISOString()
      });
      }

      metrics = body;
    }

    console.log("Starting credit score calculation...");
    const result = await calculate_credit_score_on_chain(metrics);

    // Increment monthly usage ONLY on successful calculation
    if ((result as any)?.success && (req as any)?.apiKey?.user?.id) {
      try {
        await db.prisma.user.update({
          where: { id: (req as any).apiKey.user.id },
          data: { monthlyUsage: { increment: 1 } },
        });
      } catch (e) {
        console.error('Failed to increment monthly usage:', e);
      }
    }

    res.json(result);

  } catch (error: any) {
    console.error('Error in credit score endpoint:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Fetch minimal on-chain metrics for wallet-only mode
async function fetchWalletMetrics(walletPubkey: PublicKey, connection: Connection): Promise<WalletMetrics> {
  const balance = await connection.getBalance(walletPubkey);
  const signatures = await connection.getSignaturesForAddress(walletPubkey, { limit: 100 });
  const transactionCount = signatures.length;

  let walletAgeDays = 0;
  if (signatures.length > 0) {
    const oldestTx = signatures[signatures.length - 1];
    if (oldestTx?.blockTime) {
      const ageMs = Date.now() - oldestTx.blockTime * 1000;
      walletAgeDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    }
  }

  // Lightweight protocol/NFT estimation skipped to avoid rate limits
  const metrics: WalletMetrics = {
    wallet_age_days: walletAgeDays,
    transaction_count: transactionCount,
    total_volume_usd: 0,
    unique_protocols: 0,
    defi_positions: 0,
    nft_count: 0,
    failed_txs: 0,
    sol_balance: balance,
  };
  return metrics;
}

// Helper functions

async function getMXEPublicKeyWithRetry(
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  maxRetries: number = 10,
  retryDelayMs: number = 500
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const mxePublicKey = await getMXEPublicKey(provider, programId);
      console.log("mxe public key", mxePublicKey)
      if (mxePublicKey) {
        return mxePublicKey;
      }
    } catch (error) {
      console.log(`Attempt ${attempt} failed to fetch MXE public key:`, error);
    }

    if (attempt < maxRetries) {
      console.log(
        `Retrying in ${retryDelayMs}ms... (attempt ${attempt}/${maxRetries})`
      );
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(
    `Failed to fetch MXE public key after ${maxRetries} attempts`
  );
}

async function initCalculateScoreCompDef(
  program: Program<CipherScore>,
  owner: anchor.web3.Keypair,
  uploadRawCircuit: boolean
): Promise<string> {
  const baseSeedCompDefAcc = getArciumAccountBaseSeed(
    "ComputationDefinitionAccount"
  );
  const offset = getCompDefAccOffset("calculate_credit_score");

  const compDefPDA = PublicKey.findProgramAddressSync(
    [baseSeedCompDefAcc, program.programId.toBuffer(), offset],
    getArciumProgAddress()
  )[0];

  // console.log("Comp def pda is", compDefPDA);

  const sig = await program.methods
    .initCompDefs()
    .accountsStrict({
      payer: owner.publicKey,
      mxeAccount: getMXEAccAddress(program.programId),
      compDefAccount: getCompDefAccAddress(
        program.programId,
        Buffer.from(getCompDefAccOffset("calculate_credit_score")).readUInt32LE()
      ),
      compDefCalculate: compDefPDA,
      arciumProgram: getArciumProgAddress(),
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([owner])
    .rpc({
      commitment: "confirmed",
    });
  console.log("Init calculate score computation definition transaction", sig);


  return sig;
}

// Initialize Solana when server starts
initializeSolana().then((success) => {
  if (success) {
    app.listen(PORT, () => {
      console.log(`Cipher Score Backend API running on port ${PORT}`);
      console.log(`Initialize CompDef: POST /init_comp_def`);
      console.log(`Credit Score API: POST /calculate_credit_score`);
      console.log(`Wallet Status: GET /wallet_status or /wallet_status/:wallet_address`);
      console.log(`Health Check: GET /health`);
      console.log(`Wallet Info: GET /wallet`);
      console.log(`Sample Data: GET /sample_wallets`);
      console.log(`Payer Wallet: ${payerWallet.publicKey.toString()}`);
      console.log(`CORS origin allowed: ${FRONTEND_ORIGIN}`);
    });
  } else {
    console.error("Failed to start server due to Solana initialization failure");
    process.exit(1);
  }
});

export { app, calculate_credit_score_on_chain }; 
