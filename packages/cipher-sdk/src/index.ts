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
  baseUrl?: string
  apiKey?: string
  fetch?: typeof fetch
}

function getEnv(name: string): string | undefined {
  try {
    // Works in Node/Next; bundlers may inline process.env
    // @ts-ignore
    return typeof process !== 'undefined' ? process.env?.[name] : undefined
  } catch {
    return undefined
  }
}

export class CipherSDK {
  private baseUrl: string
  private apiKey: string | undefined
  private _fetch: typeof fetch

  constructor(opts: CipherSDKOptions = {}) {
    const defaultBase = getEnv('CIPHERSCORE_BASE_URL') || 'https://api.cipherscore.xyz'
    this.baseUrl = (opts.baseUrl ?? defaultBase).replace(/\/$/, '')
    this.apiKey = opts.apiKey ?? getEnv('CIPHERSCORE_API_KEY')
    this._fetch = opts.fetch || fetch
  }

  private requireApiKey() {
    if (!this.apiKey) {
      throw new Error('CipherSDK: API key is required. Set CIPHERSCORE_API_KEY or pass apiKey in the constructor.')
    }
  }

  async calculateFromWallet(walletAddress: string): Promise<CalculateScoreResponse> {
    this.requireApiKey()
    const res = await this._fetch(`${this.baseUrl}/calculate_credit_score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey as string,
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
    this.requireApiKey()
    const res = await this._fetch(`${this.baseUrl}/calculate_credit_score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey as string,
      },
      body: JSON.stringify(metrics)
    })
    return res.json()
  }

  async walletStatus(walletAddress: string) {
    this.requireApiKey()
    const res = await this._fetch(`${this.baseUrl}/wallet_status/${walletAddress}`, {
      headers: {
        'X-API-Key': this.apiKey as string,
      }
    })
    return res.json()
  }
}
