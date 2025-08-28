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
  uploadCircuit,
  buildFinalizeCompDefTx,
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

const PROGRAM_ADDRESS = IDL.address || "EgciEm9Re7kKa4PJ22ApeuBgRR9REPMA8UTv6dwTKAg9";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

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
    const privateKey = x25519.utils.randomPrivateKey();
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

    // Listen for score calculation event with improved timeout and logging
    let listenerId: number | undefined;
    let timeoutId: NodeJS.Timeout | undefined;
    
    console.log("Setting up event listener for scoreCalculated...");
    
    const scoreCalculatedPromise = new Promise<any>((resolve, reject) => {
      listenerId = program.addEventListener("scoreCalculated", (event) => {
        console.log("Score calculation event received:", event);
        if (timeoutId) clearTimeout(timeoutId);
        resolve(event);
      });
      
      console.log(`Event listener registered with ID: ${listenerId}`);

      // Increase timeout to 5 minutes (300 seconds) for blockchain computations
      timeoutId = setTimeout(() => {
        console.log("Score calculation timed out after 5 minutes");
        reject(new Error("Score calculation timeout after 5 minutes. The computation may still be processing on-chain."));
      }, 300000);
    });

    const computationOffset = new anchor.BN(randomBytes(8), "hex");
    const arciumEnv = getClusterAccAddress(1116522165);
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

    console.log("Transaction submitted:", queueSig);
    
    // Add a small delay to ensure event listener is ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    let scoreEvent;
    // Check computation account first
    const computationAccountAddress = getComputationAccAddress(
      program.programId,
      computationOffset
    );
    console.log("Computation account address:", computationAccountAddress.toString());
    
    try {
      const compAccount = await provider.connection.getAccountInfo(computationAccountAddress);
      console.log("Computation account exists:", !!compAccount);
      if (compAccount) {
        console.log("Computation account data length:", compAccount.data.length);
      }
    } catch (error) {
      console.log("Error checking computation account:", error);
    }

    try {
      // Wait for computation to finalize with timeout
      console.log("Waiting for computation to finalize...");
      console.log("Computation offset:", computationOffset.toString());
      console.log("Program ID:", program.programId.toString());
      
      const finalizeSig = await Promise.race([
        awaitComputationFinalization(
          provider,
          computationOffset,
          program.programId,
          "confirmed"
        ),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Computation finalization timeout")), 240000) // 4 minutes
        )
      ]);
      console.log("Computation finalized:", finalizeSig);

      // Get the score from the event
      console.log("Waiting for score calculation event...");
      const scoreEvent = await scoreCalculatedPromise;
    } catch (finalizationError) {
      console.log("Computation finalization failed or timed out:", finalizationError);
      
      // Check what happened to the computation account
      try {
        const compAccountAfter = await provider.connection.getAccountInfo(computationAccountAddress);
        console.log("Computation account after timeout:", !!compAccountAfter);
        if (compAccountAfter) {
          console.log("Computation account data length after timeout:", compAccountAfter.data.length);
        }
        
        // Check transaction status
        const txStatus = await provider.connection.getSignatureStatus(queueSig);
        console.log("Transaction status:", JSON.stringify(txStatus, null, 2));
        
      } catch (checkError) {
        console.log("Error checking status after timeout:", checkError);
      }
      
      // Still try to get the event in case it arrives
      console.log("Still waiting for score event despite finalization timeout...");
      
      // Reduce timeout for event since finalization failed
      const quickEventPromise = new Promise<any>((resolve, reject) => {
        setTimeout(() => {
          reject(new Error("Event timeout after finalization failure"));
        }, 60000); // 1 minute additional wait
      });
      
      scoreEvent = await Promise.race([scoreCalculatedPromise, quickEventPromise]);
    }

    // Clean up event listener and timeout
    if (timeoutId) clearTimeout(timeoutId);
    if (listenerId !== undefined) {
      console.log(`Cleaning up event listener ${listenerId}`);
      await program.removeEventListener(listenerId);
    }

    console.log(`Credit Score Calculated: ${scoreEvent.score}`);
    console.log(`Risk Level: ${JSON.stringify(scoreEvent.riskLevel)}`);

    // Determine risk level string
    let riskLevelString: 'low' | 'medium' | 'high';
    if (scoreEvent.riskLevel.low !== undefined) {
      riskLevelString = 'low';
    } else if (scoreEvent.riskLevel.medium !== undefined) {
      riskLevelString = 'medium';
    } else {
      riskLevelString = 'high';
    }

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

// API Routes

// Initialize computation definitions
app.post('/init_comp_def', async (req, res) => {
  try {
    if (!program || !provider || !payerWallet) {
      return res.status(503).json({
        error: "Solana not initialized. Please wait for initialization to complete.",
        timestamp: new Date().toISOString()
      });
    }

    console.log("Initializing computation definitions...");
    
    const signature = await initCalculateScoreCompDef(program, payerWallet, false);
    
    // Mark as initialized on success
    compDefInitialized = true;
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

// Health check
app.get('/health', (req, res) => {
  const isInitialized = program && provider && payerWallet;
  res.json({
    status: isInitialized ? 'OK' : 'INITIALIZING',
    program_initialized: !!program,
    wallet_loaded: !!payerWallet,
    timestamp: new Date().toISOString()
  });
});

// Helper function for wallet status logic
async function getWalletStatus(walletAddress: PublicKey) {
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
app.get('/wallet_status', async (req, res) => {
  try {
    if (!program || !provider || !payerWallet) {
      return res.status(503).json({
        error: "Solana not initialized"
      });
    }

    const data = await getWalletStatus(payerWallet.publicKey);
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
app.get('/wallet_status/:wallet_address', async (req, res) => {
  try {
    if (!program || !provider || !payerWallet) {
      return res.status(503).json({
        error: "Solana not initialized"
      });
    }

    const walletAddress = new PublicKey(req.params.wallet_address);
    const data = await getWalletStatus(walletAddress);
    
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

// Get wallet info
app.get('/wallet', async (req, res) => {
  try {
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

// Calculate credit score endpoint (using actual Solana program)
app.post('/calculate_credit_score', async (req, res) => {
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

    const metrics: WalletMetrics = req.body;

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
      if (typeof metrics[field as keyof WalletMetrics] !== 'number') {
        return res.status(400).json({
          error: `Missing or invalid field: ${field}`,
          expected_type: 'number',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Validate ranges
    if (metrics.wallet_age_days < 0) {
      return res.status(400).json({
        error: 'wallet_age_days must be non-negative',
        timestamp: new Date().toISOString()
      });
    }
    if (metrics.transaction_count < 0) {
      return res.status(400).json({
        error: 'transaction_count must be non-negative',
        timestamp: new Date().toISOString()
      });
    }
    if (metrics.total_volume_usd < 0) {
      return res.status(400).json({
        error: 'total_volume_usd must be non-negative',
        timestamp: new Date().toISOString()
      });
    }

    console.log("Starting credit score calculation...");
    const result = await calculate_credit_score_on_chain(metrics);

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

// Get sample wallet data for testing
app.get('/sample_wallets', (req, res) => {
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

  if (uploadRawCircuit) {
    const rawCircuit = fs.readFileSync("build/calculate_credit_score.arcis");

    await uploadCircuit(
      provider,
      "calculate_credit_score",
      program.programId,
      rawCircuit,
      true
    );
  } else {
    const finalizeTx = await buildFinalizeCompDefTx(
      provider,
      Buffer.from(offset).readUInt32LE(),
      program.programId
    );

    const latestBlockhash = await provider.connection.getLatestBlockhash();
    finalizeTx.recentBlockhash = latestBlockhash.blockhash;
    finalizeTx.lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;

    finalizeTx.sign(owner);

    await provider.sendAndConfirm(finalizeTx);
  }
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
    });
  } else {
    console.error("Failed to start server due to Solana initialization failure");
    process.exit(1);
  }
});

export { app, calculate_credit_score_on_chain }; 
