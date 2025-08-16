use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Must wait 24 hours between score updates")]
    UpdateTooSoon,
    #[msg("Score calculation failed")]
    CalculationFailed,
    #[msg("Score is older than 7 days")]
    ScoreExpired,
    #[msg("Failed to share score")]
    SharingFailed,
    #[msg("cluster not found")]
    ClusterNotSet,
}