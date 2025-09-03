export type CalculateScoreResponse = {
  success: boolean
  data?: {
    wallet: string
    score: number
    risk_level: 'low' | 'medium' | 'high'
    transaction_signature: string
    computation_offset: string
  }
  error?: string
  timestamp: string
}

export interface CipherSDKOptions {
  baseUrl: string
  apiKey: string
  fetch?: typeof fetch
}

export class CipherSDK {
  private baseUrl: string
  private apiKey: string
  private _fetch: typeof fetch

  constructor(opts: CipherSDKOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '')
    this.apiKey = opts.apiKey
    this._fetch = opts.fetch || fetch
  }

  async calculateFromWallet(walletAddress: string): Promise<CalculateScoreResponse> {
    const res = await this._fetch(`${this.baseUrl}/calculate_credit_score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify({ wallet_address: walletAddress })
    })
    return res.json()
  }

  async calculateFromMetrics(metrics: {
    wallet_age_days: number
    transaction_count: number
    total_volume_usd: number
    unique_protocols: number
    defi_positions: number
    nft_count: number
    failed_txs: number
    sol_balance: number
  }): Promise<CalculateScoreResponse> {
    const res = await this._fetch(`${this.baseUrl}/calculate_credit_score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
      },
      body: JSON.stringify(metrics)
    })
    return res.json()
  }

  async walletStatus(walletAddress: string) {
    const res = await this._fetch(`${this.baseUrl}/wallet_status/${walletAddress}`, {
      headers: {
        'X-API-Key': this.apiKey,
      }
    })
    return res.json()
  }
}
