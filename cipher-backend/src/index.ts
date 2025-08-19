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

const PROGRAM_ADDRESS = IDL.address;

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
}

// Global variables for program state
let program: Program<CipherScore>;
let provider: anchor.AnchorProvider;
let payerWallet: anchor.web3.Keypair;
let mxePublicKey: Uint8Array;
let compDefInitialized = true;

// Initialize Solana connection and program
async function initializeSolana() {
  try {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

    // Load payer wallet from wallet.json
    try {
      const walletPath = "./wallet.json";
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
    console.log("💰 Current balance:", balance / anchor.web3.LAMPORTS_PER_SOL, "SOL");

    if (balance < 0.1 * anchor.web3.LAMPORTS_PER_SOL) {
      console.log("⚠️ Low balance! You may need to fund this wallet for transactions.");
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

    if (!compDefInitialized) {
      try {
        await initCalculateScoreCompDef(program, payerWallet, false);
        compDefInitialized = true;
        console.log("Computation definition initialized");
      } catch (error) {
        console.log("⚠️ CompDef already initialized or error:", error);
        compDefInitialized = true;
      }
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
  try {
    if (!program || !provider || !payerWallet || !mxePublicKey) {
      throw new Error("Solana not initialized. Please restart the server.");
    }

    // Setup encryption
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    // Convert metrics to BigInt array
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
    const ciphertext = cipher.encrypt(metricsArray, nonce);

    // Use the existing funded wallet instead of creating new ones
    const testWallet = payerWallet;
    console.log("💰 Using existing funded wallet for calculation");

    const [creditAccountPub] = PublicKey.findProgramAddressSync(
      [Buffer.from("credit"), testWallet.publicKey.toBuffer()],
      program.programId
    );

    // Listen for score calculation event
    let listenerId: number | undefined;
    const scoreCalculatedPromise = new Promise<any>((resolve, reject) => {
      listenerId = program.addEventListener("scoreCalculated", (event) => {
        resolve(event);
      });

      // Timeout after 60 seconds
      setTimeout(() => {
        reject(new Error("Score calculation timeout"));
      }, 60000);
    });

    const computationOffset = new anchor.BN(randomBytes(8), "hex");
    const arciumEnv = getClusterAccAddress(1116522165);
    console.log("cluster Account", arciumEnv)

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

    // Wait for computation to finalize
    const finalizeSig = await awaitComputationFinalization(
      provider,
      computationOffset,
      program.programId,
      "confirmed"
    );
    console.log("Computation finalized:", finalizeSig);

    // Get the score from the event
    const scoreEvent = await scoreCalculatedPromise;

    // Clean up event listener
    if (listenerId !== undefined) {
      await program.removeEventListener(listenerId);
    }

    console.log(`Credit Score Calculated: ${scoreEvent.score}`);
    console.log(`️Risk Level: ${JSON.stringify(scoreEvent.riskLevel)}`);

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

    // Check for insufficient funds
    if (error.message?.includes("insufficient funds") ||
      error.message?.includes("0x1")) {
      return {
        success: false,
        error: "Insufficient funds. Please fund the wallet or contact support.",
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
      console.log(`Credit Score API: POST /calculate_credit_score`);
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
