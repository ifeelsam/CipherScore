'use client'

import { Sidebar } from "@/components/sidebar"
import { WalletAuthGuard } from "@/components/wallet-auth-guard"
import { CodeBlock } from "@/components/code-block"

export default function DocsPage() {
  const backendBaseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000'
  return (
    <WalletAuthGuard>
      <main className="flex min-h-dvh" style={{ background: "#121212" }}>
        <Sidebar />
        <section className="flex-1">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-6 py-6 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <div>
                <h1 className="text-pretty text-3xl font-semibold text-white">API Documentation</h1>
                <p className="text-lg text-white/70">Create an API key in Settings, then call these endpoints</p>
                <p className="text-xs text-white/50">Base URL: {backendBaseUrl}</p>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* SDK */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-2xl font-medium text-white">SDK</h3>
              <p className="mt-2 text-lg text-white/70">Use the local TypeScript SDK for a simple client integration.</p>
              <div className="mt-3 space-y-4">
                <p className="text-base text-white/80">1) Add environment variables</p>
                <CodeBlock
                  language="bash"
                  code={`# .env\nCIPHERSCORE_API_KEY=cypher_...\n# Optional (defaults to https://api.cipherscore.xyz)\n# CIPHERSCORE_BASE_URL=https://api.cipherscore.xyz`}
                />
                <p className="text-base text-white/80">2) Create an instance (no overrides)</p>
                <CodeBlock
                  language="ts"
                  code={`import { CipherSDK } from 'cipherscore-sdk'\n\nconst sdk = new CipherSDK()`}
                />
                <p className="text-base text-white/80">3) (Optional) Override baseUrl or apiKey</p>
                <CodeBlock
                  language="ts"
                  code={`const sdk = new CipherSDK({\n  baseUrl: 'https://api.cipherscore.xyz',\n  apiKey: 'cypher_...'\n})`}
                />
                <p className="text-base text-white/80">Usage</p>
                <CodeBlock
                  language="ts"
                  code={`await sdk.calculateFromWallet('<SOLANA_WALLET_ADDRESS>')`}
                />
              </div>
            </div>

            {/* Modes */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-2xl font-medium text-white">Modes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-lg text-white/70">
                <li><span className="text-white/80">Wallet-only</span>: send <code className="text-white">wallet_address</code> only; backend fetches on-chain data. Recommended for most use cases.</li>
                <li><span className="text-white/80">Manual</span>: send metrics yourself; useful if you already computed or want full control.</li>
                <li><span className="text-white/80">Usage counting</span>: increments only on successful credit score calculation.</li>
              </ul>
            </div>

            {/* Notes */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-2xl font-medium text-white">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-lg text-white/70">
                <li><span className="text-white/80">API Key management</span>: Go to Settings → API Keys.</li>
                <li><span className="text-white/80">Headers</span>: use <code className="text-white">X-API-Key</code> for protected APIs.</li>
                <li><span className="text-white/80">Limits</span>: NORMAL: 5/mo, PREMIUM: 15/mo. Exceeding returns 429.</li>
              </ul>
            </div>

            {/* API Keys Location */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h2 className="text-3xl font-semibold text-white">API Keys</h2>
              <p className="mt-2 text-lg text-white/70">
                Manage your API keys in <span className="text-white/85">Settings → API Keys</span>. Copy your key and use it in the
                <code className="ml-1 mr-1 text-white">X-API-Key</code> header.
              </p>
            </div>

            {/* Calculate Credit Score */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-2xl font-medium text-white">Calculate Credit Score</h3>
              <p className="mt-2 text-lg text-white/70">Wallet-only mode: just send a wallet address. Use your API key.</p>
              <CodeBlock
                language="bash"
                code={`POST ${backendBaseUrl}/calculate_credit_score\nX-API-Key: <YOUR_API_KEY>\nContent-Type: application/json\n\n{\n  "wallet_address": "<SOLANA_WALLET_ADDRESS>"\n}\n\n# Response: { success, data: { wallet, score, risk_level, transaction_signature, computation_offset }, ... }`}
              />
              <p className="mt-4 text-sm text-white/50">Optional manual mode (send metrics yourself):</p>
              <CodeBlock
                language="json"
                code={`{\n  "wallet_age_days": 365,\n  "transaction_count": 120,\n  "total_volume_usd": 50000,\n  "unique_protocols": 10,\n  "defi_positions": 3,\n  "nft_count": 4,\n  "failed_txs": 2,\n  "sol_balance": 100000000\n}`}
              />
            </div>

            {/* Wallet Status */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-2xl font-medium text-white">Wallet Status</h3>
              <p className="mt-2 text-lg text-white/70">Check current score and cooldown for any wallet.</p>
              <CodeBlock
                language="bash"
                code={`GET ${backendBaseUrl}/wallet_status/<WALLET_ADDRESS>\nX-API-Key: <YOUR_API_KEY>\n\n# Response includes: account_exists, current_score, risk_level, cooldown_status`}
              />
            </div>

            {/* Usage */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-2xl font-medium text-white">Usage & Limits</h3>
              <p className="mt-2 text-lg text-white/70">Track your monthly usage from your dashboard.</p>
              <CodeBlock
                language="bash"
                code={`GET ${backendBaseUrl}/dashboard/api-keys/stats/usage\nX-Session-Token: <SESSION_TOKEN>\n\n# Response includes: totalRequests, endpointStats, monthlyUsage { used, limit, remaining, resetDate }`}
              />
            </div>
          </div>
        </section>
      </main>
    </WalletAuthGuard>
  )
} 