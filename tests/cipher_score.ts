import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { CipherScore } from "../target/types/cipher_score";
import { randomBytes } from "crypto";
import {
  awaitComputationFinalization,
  getArciumEnv,
  getCompDefAccOffset,
  getArciumAccountBaseSeed,
  getArciumProgAddress,
  uploadCircuit,
  buildFinalizeCompDefTx,
  RescueCipher,
  deserializeLE,
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
import { expect } from "chai";

describe("CipherScore", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace
    .CipherScore as Program<CipherScore>;
  const provider = anchor.getProvider();

  type Event = anchor.IdlEvents<(typeof program)["idl"]>;
  const awaitEvent = async <E extends keyof Event>(
    eventName: E
  ): Promise<Event[E]> => {
    let listenerId: number;
    const event = await new Promise<Event[E]>((res) => {
      listenerId = program.addEventListener(eventName, (event) => {
        res(event);
      });
    });
    await program.removeEventListener(listenerId);

    return event;
  };

  const arciumEnv = getArciumEnv();
  let mxePublicKey: Uint8Array;
  let compDefInitialized = false;
  before(async () => {
    const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);
    
    // Get MXE public key
    mxePublicKey = await getMXEPublicKeyWithRetry(
      provider as anchor.AnchorProvider,
      program.programId
    );
    console.log("MXE x25519 pubkey is", mxePublicKey);

    // Initialize computation definition only once
    if (!compDefInitialized) {
      console.log("Initializing calculate_credit_score computation definition");
      const initSig = await initCalculateScoreCompDef(program, owner, false);
      console.log(
        "Calculate credit score computation definition initialized with signature",
        initSig
      );
      compDefInitialized = true;
    }
  });

  it("calculates credit score for high-quality wallet", async () => {
    const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);

    // Setup encryption
    const privateKey = x25519.utils.randomSecretKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    // High-quality wallet metrics
    const walletMetrics = {
      wallet_age_days: BigInt(400),        // Over 1 year
      transaction_count: BigInt(150),      // High activity
      total_volume_usd: BigInt(15_000_000), // $15k volume (scaled by 1000)
      unique_protocols: BigInt(12),        // Diverse protocol usage
      defi_positions: BigInt(5),           // Active DeFi user
      nft_count: BigInt(10),               // NFT holder
      failed_txs: BigInt(2),               // Very few failures
      sol_balance: BigInt(100_000_000_000), // 100 SOL in lamports
    };

    const metricsArray = [
      walletMetrics.wallet_age_days,
      walletMetrics.transaction_count,
      walletMetrics.total_volume_usd,
      walletMetrics.unique_protocols,
      walletMetrics.defi_positions,
      walletMetrics.nft_count,
      walletMetrics.failed_txs,
      walletMetrics.sol_balance,
    ];

    const nonce = randomBytes(16);
    const ciphertext = cipher.encrypt(metricsArray, nonce);

    // Listen for score calculation event
    const scoreCalculatedPromise = awaitEvent("scoreCalculated");

    const computationOffset = new anchor.BN(randomBytes(8), "hex");

    // Create a unique test wallet for this test
    const testWallet = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to test wallet
    const airdropSig = await provider.connection.requestAirdrop(
      testWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const [creditAccountpub] = PublicKey.findProgramAddressSync(
        [Buffer.from("credit"), testWallet.publicKey.toBuffer()],
        program.programId
      );

      
    // Submit metrics and calculate score
    const queueSig = await program.methods
      .submitAndCalculateScore(
        computationOffset,
        {
          walletAgeDays: Array.from(ciphertext[0]),
          transactionCount: Array.from(ciphertext[1]),
          totalVolumeUsd: Array.from(ciphertext[2]),
          uniqueProtocols: Array.from(ciphertext[3]),
          defiPositions: Array.from(ciphertext[4]),
          nftCount: Array.from(ciphertext[5]),
          failedTxs: Array.from(ciphertext[6]),
          solBalance: Array.from(ciphertext[7]),
        },
        Array.from(publicKey),
        new anchor.BN(deserializeLE(nonce).toString())
      )
      .accountsStrict({
        payer: owner.publicKey,
        wallet: testWallet.publicKey,
        creditAccount: creditAccountpub,
        computationAccount: getComputationAccAddress(
          program.programId,
          computationOffset
        ),
        clusterAccount: arciumEnv.arciumClusterPubkey,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(program.programId),
        executingPool: getExecutingPoolAccAddress(program.programId),
        compDefAccount: getCompDefAccAddress(
          program.programId,
          Buffer.from(getCompDefAccOffset("calculate_credit_score")).readUInt32LE()
        ),
        poolAccount: new PublicKey("7MGSS4iKNM4sVib7bDZDJhVqB6EcchPwVnTKenCY1jt3"),
        clockAccount: new PublicKey("FHriyvoZotYiFnbUzKFjzRSb2NiaC8RPWY7jtKuKhg65"),
        systemProgram: anchor.web3.SystemProgram.programId,
        arciumProgram: getArciumProgAddress(),
      })
      .signers([owner, testWallet])
      .rpc({ commitment: "confirmed" });
    
    console.log("Queue sig is", queueSig);

    // Wait for computation to finalize
    const finalizeSig = await awaitComputationFinalization(
      provider as anchor.AnchorProvider,
      computationOffset,
      program.programId,
      "confirmed"
    );
    console.log("Finalize sig is", finalizeSig);

    // Get the score from the event
    const scoreEvent = await scoreCalculatedPromise;
    console.log(`Credit Score Calculated: ${scoreEvent.score}`);
    console.log(`Risk Level: ${JSON.stringify(scoreEvent.riskLevel)}`);

    // Verify the score is in expected range for high-quality wallet
    expect(scoreEvent.score).to.be.at.least(700);
    expect(scoreEvent.score).to.be.at.most(850);
    expect(scoreEvent.riskLevel).to.deep.equal({ low: {} });

    // Calculate expected score manually
    const expectedScore = calculateExpectedScore(walletMetrics);
    console.log(`Expected score: ${expectedScore}, Actual score: ${scoreEvent.score}`);
    
    // Allow some variance due to potential rounding
    expect(Math.abs(scoreEvent.score - expectedScore)).to.be.at.most(10);
  });

  it("calculates credit score for low-quality wallet", async () => {
    const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);

    const privateKey = x25519.utils.randomSecretKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    // Low-quality wallet metrics
    const walletMetrics = {
      wallet_age_days: BigInt(30),         // Only 1 month old
      transaction_count: BigInt(5),        // Very few transactions
      total_volume_usd: BigInt(100_000),   // $100 volume (scaled by 1000)
      unique_protocols: BigInt(1),         // Only used 1 protocol
      defi_positions: BigInt(0),           // No DeFi activity
      nft_count: BigInt(0),                // No NFTs
      failed_txs: BigInt(3),                // Several failures
      sol_balance: BigInt(1_000_000),      // Very low balance
    };

    const metricsArray = [
      walletMetrics.wallet_age_days,
      walletMetrics.transaction_count,
      walletMetrics.total_volume_usd,
      walletMetrics.unique_protocols,
      walletMetrics.defi_positions,
      walletMetrics.nft_count,
      walletMetrics.failed_txs,
      walletMetrics.sol_balance,
    ];

    const nonce = randomBytes(16);
    const ciphertext = cipher.encrypt(metricsArray, nonce);

    const scoreCalculatedPromise = awaitEvent("scoreCalculated");
    const computationOffset = new anchor.BN(randomBytes(8), "hex");

    // Create unique wallet for this test
    const testWallet = anchor.web3.Keypair.generate();
    
    // Airdrop SOL to test wallet
    const airdropSig = await provider.connection.requestAirdrop(
      testWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const queueSig = await program.methods
      .submitAndCalculateScore(
        computationOffset,
        {
          walletAgeDays: Array.from(ciphertext[0]),
          transactionCount: Array.from(ciphertext[1]),
          totalVolumeUsd: Array.from(ciphertext[2]),
          uniqueProtocols: Array.from(ciphertext[3]),
          defiPositions: Array.from(ciphertext[4]),
          nftCount: Array.from(ciphertext[5]),
          failedTxs: Array.from(ciphertext[6]),
          solBalance: Array.from(ciphertext[7]),
        },
        Array.from(publicKey),
        new anchor.BN(deserializeLE(nonce).toString())
      )
      .accountsPartial({
        payer: owner.publicKey,
        wallet: testWallet.publicKey,
        creditAccount: PublicKey.findProgramAddressSync(
          [Buffer.from("credit"), testWallet.publicKey.toBuffer()],
          program.programId
        )[0],
        computationAccount: getComputationAccAddress(
          program.programId,
          computationOffset
        ),
        clusterAccount: arciumEnv.arciumClusterPubkey,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(program.programId),
        executingPool: getExecutingPoolAccAddress(program.programId),
        compDefAccount: getCompDefAccAddress(
          program.programId,
          Buffer.from(getCompDefAccOffset("calculate_credit_score")).readUInt32LE()
        ),
      })
      .signers([owner, testWallet])
      .rpc({ commitment: "confirmed" });

    console.log("Queue sig is", queueSig);

    const finalizeSig = await awaitComputationFinalization(
      provider as anchor.AnchorProvider,
      computationOffset,
      program.programId,
      "confirmed"
    );
    console.log("Finalize sig is", finalizeSig);

    const scoreEvent = await scoreCalculatedPromise;
    console.log(`Low-quality wallet Credit Score: ${scoreEvent.score}`);
    console.log(`Risk Level: ${JSON.stringify(scoreEvent.riskLevel)}`);

    // Verify the score is in expected range for low-quality wallet
    expect(scoreEvent.score).to.be.at.least(250);
    expect(scoreEvent.score).to.be.at.most(500);
    expect(scoreEvent.riskLevel).to.deep.equal({ high: {} });
  });

  it("calculates credit score for medium-quality wallet", async () => {
    const owner = readKpJson(`${os.homedir()}/.config/solana/id.json`);

    const privateKey = x25519.utils.randomSecretKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const sharedSecret = x25519.getSharedSecret(privateKey, mxePublicKey);
    const cipher = new RescueCipher(sharedSecret);

    // Medium-quality wallet metrics
    const walletMetrics = {
      wallet_age_days: BigInt(180),        // 6 months
      transaction_count: BigInt(50),       // Moderate activity
      total_volume_usd: BigInt(5_000_000), // $5k volume
      unique_protocols: BigInt(5),         // Some diversity
      defi_positions: BigInt(2),           // Some DeFi
      nft_count: BigInt(3),                // Few NFTs
      failed_txs: BigInt(1),               // Minimal failures
      sol_balance: BigInt(10_000_000_000), // 10 SOL
    };

    const metricsArray = [
      walletMetrics.wallet_age_days,
      walletMetrics.transaction_count,
      walletMetrics.total_volume_usd,
      walletMetrics.unique_protocols,
      walletMetrics.defi_positions,
      walletMetrics.nft_count,
      walletMetrics.failed_txs,
      walletMetrics.sol_balance,
    ];

    const nonce = randomBytes(16);
    const ciphertext = cipher.encrypt(metricsArray, nonce);

    const scoreCalculatedPromise = awaitEvent("scoreCalculated");
    const computationOffset = new anchor.BN(randomBytes(8), "hex");

    const testWallet = anchor.web3.Keypair.generate();
    const airdropSig = await provider.connection.requestAirdrop(
      testWallet.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(airdropSig);

    const queueSig = await program.methods
      .submitAndCalculateScore(
        computationOffset,
        {
          walletAgeDays: Array.from(ciphertext[0]),
          transactionCount: Array.from(ciphertext[1]),
          totalVolumeUsd: Array.from(ciphertext[2]),
          uniqueProtocols: Array.from(ciphertext[3]),
          defiPositions: Array.from(ciphertext[4]),
          nftCount: Array.from(ciphertext[5]),
          failedTxs: Array.from(ciphertext[6]),
          solBalance: Array.from(ciphertext[7]),
        },
        Array.from(publicKey),
        new anchor.BN(deserializeLE(nonce).toString())
      )
      .accountsPartial({
        payer: owner.publicKey,
        wallet: testWallet.publicKey,
        creditAccount: PublicKey.findProgramAddressSync(
          [Buffer.from("credit"), testWallet.publicKey.toBuffer()],
          program.programId
        )[0],
        computationAccount: getComputationAccAddress(
          program.programId,
          computationOffset
        ),
        clusterAccount: arciumEnv.arciumClusterPubkey,
        mxeAccount: getMXEAccAddress(program.programId),
        mempoolAccount: getMempoolAccAddress(program.programId),
        executingPool: getExecutingPoolAccAddress(program.programId),
        compDefAccount: getCompDefAccAddress(
          program.programId,
          Buffer.from(getCompDefAccOffset("calculate_credit_score")).readUInt32LE()
        ),
      })
      .signers([owner, testWallet])
      .rpc({ commitment: "confirmed" });

    console.log("Queue sig is", queueSig);

    const finalizeSig = await awaitComputationFinalization(
      provider as anchor.AnchorProvider,
      computationOffset,
      program.programId,
      "confirmed"
    );
    console.log("Finalize sig is", finalizeSig);

    const scoreEvent = await scoreCalculatedPromise;
    console.log(`Medium-quality wallet Credit Score: ${scoreEvent.score}`);
    console.log(`Risk Level: ${JSON.stringify(scoreEvent.riskLevel)}`);

    // Verify the score is in expected range for medium-quality wallet
    expect(scoreEvent.score).to.be.at.least(500);
    expect(scoreEvent.score).to.be.at.most(700);
    expect(scoreEvent.riskLevel).to.deep.equal({ medium: {} });
  });

  // Helper function to calculate expected score
  function calculateExpectedScore(metrics: any): number {
    let score = 300;

    // Age score
    const ageScore = metrics.wallet_age_days >= 365 
      ? 150 
      : Math.min(Math.floor(Number(metrics.wallet_age_days) * 150 / 365), 150);
    score += ageScore;

    // Transaction score
    const txScore = metrics.transaction_count >= 100 
      ? 200 
      : Number(metrics.transaction_count) * 2;
    score += txScore;

    // Volume score
    const volumeScore = metrics.total_volume_usd >= 10_000_000
      ? 200
      : Math.min(Math.floor(Number(metrics.total_volume_usd) / 50_000), 200);
    score += volumeScore;

    // Protocol score
    const protocolScore = metrics.unique_protocols >= 10
      ? 100
      : Number(metrics.unique_protocols) * 10;
    score += protocolScore;

    // DeFi score
    const defiScore = Math.min(Number(metrics.defi_positions) * 10, 50);
    score += defiScore;

    // Failure penalty
    const failurePenalty = Math.min(Number(metrics.failed_txs) * 5, 50);
    score = score > failurePenalty ? score - failurePenalty : 250;

    return Math.min(score, 850);
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

    console.log("Comp def pda is", compDefPDA);

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
        provider as anchor.AnchorProvider,
        "calculate_credit_score",
        program.programId,
        rawCircuit,
        true
      );
    } else {
      const finalizeTx = await buildFinalizeCompDefTx(
        provider as anchor.AnchorProvider,
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
});

async function getMXEPublicKeyWithRetry(
  provider: anchor.AnchorProvider,
  programId: PublicKey,
  maxRetries: number = 10,
  retryDelayMs: number = 500
): Promise<Uint8Array> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const mxePublicKey = await getMXEPublicKey(provider, programId);
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

function readKpJson(path: string): anchor.web3.Keypair {
  const file = fs.readFileSync(path);
  return anchor.web3.Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(file.toString()))
  );
}
