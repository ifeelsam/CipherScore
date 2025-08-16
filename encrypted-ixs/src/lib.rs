use arcis_imports::*;

#[encrypted]
mod circuits {
    use arcis_imports::*;

    /// Wallet activity metrics for credit scoring
    pub struct WalletMetrics {
        pub wallet_age_days: u32,      // Days since first transaction
        pub transaction_count: u32,     // Total number of transactions
        pub total_volume_usd: u64,     // Total transaction volume in USD (scaled by 1000)
        pub unique_protocols: u16,      // Number of unique protocols interacted with
        pub defi_positions: u16,        // Active DeFi positions
        pub nft_count: u16,            // NFTs owned
        pub failed_txs: u16,           // Failed transaction count
        pub sol_balance: u64,          // Current SOL balance (in lamports)
    }

    /// Calculate credit score based on encrypted wallet metrics
    #[instruction]
    pub fn calculate_credit_score(
        metrics: Enc<Shared, WalletMetrics>,
    ) -> u16 {
        let m = metrics.to_arcis();
        
        let mut score = 300u32; // Base score
        
        // Wallet Age Score (max 150 points)
        // 1 year+ = full points
        let age_score = if m.wallet_age_days >= 365 {
            150
        } else {
            (m.wallet_age_days * 150 / 365).min(150)
        };
        score += age_score;
        
        // Transaction Activity Score (max 200 points)
        // 100+ transactions = full points
        let tx_score = if m.transaction_count >= 100 {
            200
        } else {
            m.transaction_count * 2
        };
        score += tx_score;
        
        // Volume Score (max 200 points)
        // $10,000+ volume = full points (volume is scaled by 1000)
        let volume_score = if m.total_volume_usd >= 10_000_000 {
            200
        } else {
            ((m.total_volume_usd / 50_000) as u32).min(200)
        };
        score += volume_score;
        
        // Protocol Diversity Score (max 100 points)
        // 10+ protocols = full points
        let protocol_score = if m.unique_protocols >= 10 {
            100
        } else {
            (m.unique_protocols as u32) * 10
        };
        score += protocol_score;
        
        // DeFi Engagement Score (max 50 points)
        let defi_score = (m.defi_positions as u32 * 10).min(50);
        score += defi_score;
        
        // Penalty for failed transactions (minus up to 50 points)
        let failure_penalty = (m.failed_txs as u32 * 5).min(50);
        
        // Manual saturating subtraction
        if score > failure_penalty {
            score = score - failure_penalty;
        } else {
            score = 250; // Minimum score
        }
        
        // Cap at 850
        (score.min(850) as u16).reveal()
    }

    /// Calculate and share credit score with a specific party
    #[instruction]
    pub fn calculate_and_share_score(
        receiver: Shared,
        metrics: Enc<Shared, WalletMetrics>,
    ) -> Enc<Shared, CreditReport> {
        let m = metrics.to_arcis();
        
        // Same scoring logic as above
        let mut score = 300u32;
        
        let age_score = if m.wallet_age_days >= 365 {
            150
        } else {
            (m.wallet_age_days * 150 / 365).min(150)
        };
        score += age_score;
        
        let tx_score = if m.transaction_count >= 100 {
            200
        } else {
            m.transaction_count * 2
        };
        score += tx_score;
        
        let volume_score = if m.total_volume_usd >= 10_000_000 {
            200
        } else {
            ((m.total_volume_usd / 50_000) as u32).min(200)
        };
        score += volume_score;
        
        let protocol_score = if m.unique_protocols >= 10 {
            100
        } else {
            (m.unique_protocols as u32) * 10
        };
        score += protocol_score;
        
        let defi_score = (m.defi_positions as u32 * 10).min(50);
        score += defi_score;
        
        let failure_penalty = (m.failed_txs as u32 * 5).min(50);
        
        // Manual saturating subtraction
        if score > failure_penalty {
            score = score - failure_penalty;
        } else {
            score = 250; // Minimum score
        }
        
        let final_score = score.min(850) as u16;
        
        // Create credit report
        let report = CreditReport {
            score: final_score,
            risk_level: if final_score >= 700 {
                0 // Low risk
            } else if final_score >= 500 {
                1 // Medium risk
            } else {
                2 // High risk
            },
            timestamp: 0, // Would be set by contract
        };
        
        receiver.from_arcis(report)
    }

    pub struct CreditReport {
        pub score: u16,
        pub risk_level: u8,
        pub timestamp: u64,
    }
}
