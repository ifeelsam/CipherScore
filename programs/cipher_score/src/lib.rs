pub mod errors;

use anchor_lang::prelude::*;
use arcium_anchor::prelude::*;

const COMP_DEF_OFFSET_CALCULATE: u32 = comp_def_offset("calculate_credit_score");
const COMP_DEF_OFFSET_SHARE: u32 = comp_def_offset("calculate_and_share_score");
const UPDATE_COOLDOWN: i64 = 86400; // 24 hours in seconds

declare_id!("4J2kcg1ipXTv8S6ML2Vc4K5L4yXEK7w2ytBSGPHExcdW");

pub use errors::ErrorCode;

#[arcium_program]
pub mod cipher_score {
    use arcium_client::idl::arcium::types::CallbackAccount;

    use super::*;

    /// Initialize computation definitions
    pub fn init_comp_defs(ctx: Context<InitCompDefs>) -> Result<()> {
        // Initialize calculate_credit_score
        init_comp_def(
            ctx.accounts, 
            true,
            0,
            None,
            None,
        )?;
        
        Ok(())
    }

    /// Submit wallet metrics and calculate credit score
    pub fn submit_and_calculate_score(
        ctx: Context<SubmitAndCalculate>,
        computation_offset: u64,
        encrypted_metrics: EncryptedWalletMetrics,
        sender_pubkey: [u8; 32],
        nonce: u128,
    ) -> Result<()> {
        let credit_account = &mut ctx.accounts.credit_account;
        
        // Check cooldown
        let current_time = Clock::get()?.unix_timestamp;
        if credit_account.last_updated > 0 {
            require!(
                current_time - credit_account.last_updated >= UPDATE_COOLDOWN,
                ErrorCode::UpdateTooSoon
            );
        }
        
        // Store encrypted metrics
        credit_account.wallet = ctx.accounts.wallet.key();
        credit_account.encrypted_metrics = encrypted_metrics.clone();
        credit_account.last_updated = current_time;
        
        // Queue computation
        let args = vec![
            Argument::ArcisPubkey(sender_pubkey),
            Argument::PlaintextU128(nonce),
            Argument::EncryptedU32(encrypted_metrics.wallet_age_days),
            Argument::EncryptedU32(encrypted_metrics.transaction_count),
            Argument::EncryptedU64(encrypted_metrics.total_volume_usd),
            Argument::EncryptedU16(encrypted_metrics.unique_protocols),
            Argument::EncryptedU16(encrypted_metrics.defi_positions),
            Argument::EncryptedU16(encrypted_metrics.nft_count),
            Argument::EncryptedU16(encrypted_metrics.failed_txs),
            Argument::EncryptedU64(encrypted_metrics.sol_balance),
        ];
        
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![CallbackAccount {
                pubkey: ctx.accounts.credit_account.key(),
                is_writable: true,
            }],
            None,
        )?;
        
        emit!(ScoreCalculationStarted {
            wallet: ctx.accounts.wallet.key(),
            timestamp: current_time,
        });
        
        Ok(())
    }

    /// Callback to handle calculated credit score
    #[arcium_callback(encrypted_ix = "calculate_credit_score")]
    pub fn calculate_credit_score_callback(
        ctx: Context<ScoreCallback>,
        output: ComputationOutputs<CalculateCreditScoreOutput>,
    ) -> Result<()> {
        let score = match output {
            ComputationOutputs::Success(CalculateCreditScoreOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::CalculationFailed.into()),
        };
        
        let credit_account = &mut ctx.accounts.credit_account;
        credit_account.current_score = score;
        credit_account.score_timestamp = Clock::get()?.unix_timestamp;
        
        // Determine risk level
        credit_account.risk_level = if score >= 700 {
            RiskLevel::Low
        } else if score >= 500 {
            RiskLevel::Medium
        } else {
            RiskLevel::High
        };
        
        emit!(ScoreCalculated {
            wallet: credit_account.wallet,
            score,
            risk_level: credit_account.risk_level.clone(),
        });
        
        Ok(())
    }

    /// Share credit score with a specific party (e.g., lending protocol)
    pub fn share_score_with(
        ctx: Context<ShareScore>,
        computation_offset: u64,
        receiver_pubkey: [u8; 32],
        receiver_nonce: u128,
        sender_pubkey: [u8; 32],
        sender_nonce: u128,
    ) -> Result<()> {
        let credit_account = &ctx.accounts.credit_account;
        
        // Ensure score is recent (within 7 days)
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time - credit_account.score_timestamp < 604800,
            ErrorCode::ScoreExpired
        );
        
        let args = vec![
            // Receiver info
            Argument::ArcisPubkey(receiver_pubkey),
            Argument::PlaintextU128(receiver_nonce),
            // Sender info
            Argument::ArcisPubkey(sender_pubkey),
            Argument::PlaintextU128(sender_nonce),
            // Metrics
            Argument::EncryptedU32(credit_account.encrypted_metrics.wallet_age_days),
            Argument::EncryptedU32(credit_account.encrypted_metrics.transaction_count),
            Argument::EncryptedU64(credit_account.encrypted_metrics.total_volume_usd),
            Argument::EncryptedU16(credit_account.encrypted_metrics.unique_protocols),
            Argument::EncryptedU16(credit_account.encrypted_metrics.defi_positions),
            Argument::EncryptedU16(credit_account.encrypted_metrics.nft_count),
            Argument::EncryptedU16(credit_account.encrypted_metrics.failed_txs),
            Argument::EncryptedU64(credit_account.encrypted_metrics.sol_balance),
        ];
        
        queue_computation(
            ctx.accounts,
            computation_offset,
            args,
            vec![],
            None,
        )?;
        
        emit!(ScoreShared {
            wallet: credit_account.wallet,
            shared_with: ctx.accounts.receiver.key(),
            timestamp: current_time,
        });
        
        Ok(())
    }

    /// Callback for shared score
    #[arcium_callback(encrypted_ix = "calculate_and_share_score")]
    pub fn calculate_and_share_score_callback(
        ctx: Context<ShareCallback>,
        output: ComputationOutputs<CalculateAndShareScoreOutput>,
    ) -> Result<()> {
        let encrypted_report = match output {
            ComputationOutputs::Success(CalculateAndShareScoreOutput { field_0 }) => field_0,
            _ => return Err(ErrorCode::SharingFailed.into()),
        };
        
        emit!(EncryptedScoreShared {
            nonce: encrypted_report.nonce.to_le_bytes(),
            encrypted_score: encrypted_report.ciphertexts[0],
            encrypted_risk_level: encrypted_report.ciphertexts[1],
        });
        
        Ok(())
    }
}

// Account Structures
#[account]
#[derive(InitSpace)]
pub struct CreditAccount {
    pub wallet: Pubkey,
    pub encrypted_metrics: EncryptedWalletMetrics,
    pub current_score: u16,
    pub risk_level: RiskLevel,
    pub score_timestamp: i64,
    pub last_updated: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, InitSpace)]
pub struct EncryptedWalletMetrics {
    pub wallet_age_days: [u8; 32],
    pub transaction_count: [u8; 32],
    pub total_volume_usd: [u8; 32],
    pub unique_protocols: [u8; 32],
    pub defi_positions: [u8; 32],
    pub nft_count: [u8; 32],
    pub failed_txs: [u8; 32],
    pub sol_balance: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, InitSpace)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

// Account Contexts
#[init_computation_definition_accounts("calculate_credit_score", payer)]
#[derive(Accounts)]
pub struct InitCompDefs<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut, address = derive_mxe_pda!())]
    pub mxe_account: Box<Account<'info, MXEAccount>>,
    #[account(mut)]
    /// CHECK: comp_def_account, checked by arcium program.
    /// Can't check it here as it's not initialized yet.
    pub comp_def_account: UncheckedAccount<'info>,
    #[account(mut)]
    /// CHECK: Comp def for calculate
    pub comp_def_calculate: UncheckedAccount<'info>,
    pub arcium_program: Program<'info, Arcium>,
    pub system_program: Program<'info, System>,
}

#[queue_computation_accounts("calculate_credit_score", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct SubmitAndCalculate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub wallet: Signer<'info>,
    
    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + CreditAccount::INIT_SPACE,
        seeds = [b"credit", wallet.key().as_ref()],
        bump,
    )]
    pub credit_account: Account<'info, CreditAccount>,
    
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: Arcium mempool
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: Arcium execution pool
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK: Computation account
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_CALCULATE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("calculate_credit_score", payer)]
#[derive(Accounts)]
pub struct ScoreCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_CALCULATE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Instructions sysvar
    pub instructions_sysvar: AccountInfo<'info>,
    #[account(mut)]
    pub credit_account: Account<'info, CreditAccount>,
}

#[queue_computation_accounts("calculate_and_share_score", payer)]
#[derive(Accounts)]
#[instruction(computation_offset: u64)]
pub struct ShareScore<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub wallet: Signer<'info>,
    #[account(has_one = wallet)]
    pub credit_account: Account<'info, CreditAccount>,
    /// CHECK: Receiver of the shared score
    pub receiver: AccountInfo<'info>,
    
    #[account(address = derive_mxe_pda!())]
    pub mxe_account: Account<'info, MXEAccount>,
    #[account(mut, address = derive_mempool_pda!())]
    /// CHECK: Arcium mempool
    pub mempool_account: UncheckedAccount<'info>,
    #[account(mut, address = derive_execpool_pda!())]
    /// CHECK: Arcium execution pool
    pub executing_pool: UncheckedAccount<'info>,
    #[account(mut, address = derive_comp_pda!(computation_offset))]
    /// CHECK: Computation account
    pub computation_account: UncheckedAccount<'info>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SHARE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(mut, address = derive_cluster_pda!(mxe_account))]
    pub cluster_account: Account<'info, Cluster>,
    #[account(mut, address = ARCIUM_FEE_POOL_ACCOUNT_ADDRESS)]
    pub pool_account: Account<'info, FeePool>,
    #[account(address = ARCIUM_CLOCK_ACCOUNT_ADDRESS)]
    pub clock_account: Account<'info, ClockAccount>,
    pub system_program: Program<'info, System>,
    pub arcium_program: Program<'info, Arcium>,
}

#[callback_accounts("calculate_and_share_score", payer)]
#[derive(Accounts)]
pub struct ShareCallback<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    pub arcium_program: Program<'info, Arcium>,
    #[account(address = derive_comp_def_pda!(COMP_DEF_OFFSET_SHARE))]
    pub comp_def_account: Account<'info, ComputationDefinitionAccount>,
    #[account(address = ::anchor_lang::solana_program::sysvar::instructions::ID)]
    /// CHECK: Instructions sysvar
    pub instructions_sysvar: AccountInfo<'info>,
}

// Events
#[event]
pub struct ScoreCalculationStarted {
    pub wallet: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ScoreCalculated {
    pub wallet: Pubkey,
    pub score: u16,
    pub risk_level: RiskLevel,
}

#[event]
pub struct ScoreShared {
    pub wallet: Pubkey,
    pub shared_with: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct EncryptedScoreShared {
    pub nonce: [u8; 16],
    pub encrypted_score: [u8; 32],
    pub encrypted_risk_level: [u8; 32],
}
