'use client'

import { Sidebar } from "@/components/sidebar"
import { WalletAuthGuard } from "@/components/wallet-auth-guard"

export default function DocsPage() {
  return (
    <WalletAuthGuard>
      <main className="flex min-h-dvh" style={{ background: "#121212" }}>
        <Sidebar />
        <section className="flex-1">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-6 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <div>
                <h1 className="text-pretty text-lg font-semibold text-white">API Documentation</h1>
                <p className="text-sm text-white/70">Create an API key in Settings, then call these endpoints</p>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl space-y-6 p-6">
            {/* API Keys Location */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h2 className="text-xl font-semibold text-white">API Keys</h2>
              <p className="mt-2 text-sm text-white/70">
                Manage your API keys in <span className="text-white/85">Settings → API Keys</span>. Copy your key and use it in the
                <code className="ml-1 mr-1 text-white">X-API-Key</code> header.
              </p>
            </div>

            {/* Calculate Credit Score */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-lg font-medium text-white">Calculate Credit Score</h3>
              <p className="mt-2 text-sm text-white/70">Wallet-only mode: just send a wallet address. Use your API key.</p>
              <pre className="mt-3 overflow-x-auto rounded-2xl p-4 text-xs" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.06)", color: "#EDEDED" }}>
{`POST /calculate_credit_score
X-API-Key: <YOUR_API_KEY>
Content-Type: application/json

{
  "wallet_address": "<SOLANA_WALLET_ADDRESS>"
}

# Response: { success, data: { wallet, score, risk_level, transaction_signature, computation_offset }, ... }`}
              </pre>
              <p className="mt-4 text-sm text-white/50">Optional manual mode (send metrics yourself):</p>
              <pre className="mt-2 overflow-x-auto rounded-2xl p-4 text-xs" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.06)", color: "#EDEDED" }}>
{`{
  "wallet_age_days": 365,
  "transaction_count": 120,
  "total_volume_usd": 50000,
  "unique_protocols": 10,
  "defi_positions": 3,
  "nft_count": 4,
  "failed_txs": 2,
  "sol_balance": 100000000
}`}
              </pre>
            </div>

            {/* Wallet Status */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-lg font-medium text-white">Wallet Status</h3>
              <p className="mt-2 text-sm text-white/70">Check current score and cooldown for any wallet.</p>
              <pre className="mt-3 overflow-x-auto rounded-2xl p-4 text-xs" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.06)", color: "#EDEDED" }}>
{`GET /wallet_status/<WALLET_ADDRESS>
X-API-Key: <YOUR_API_KEY>

# Response includes: account_exists, current_score, risk_level, cooldown_status`}
              </pre>
            </div>

            {/* Usage */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-lg font-medium text-white">Usage & Limits</h3>
              <p className="mt-2 text-sm text-white/70">Track your monthly usage from your dashboard.</p>
              <pre className="mt-3 overflow-x-auto rounded-2xl p-4 text-xs" style={{ background: "#0F0F0F", border: "1px solid rgba(255,255,255,0.06)", color: "#EDEDED" }}>
{`GET /dashboard/api-keys/stats/usage
X-Session-Token: <SESSION_TOKEN>

# Response includes: totalRequests, endpointStats, monthlyUsage { used, limit, remaining, resetDate }`}
              </pre>
            </div>

            {/* Notes */}
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-lg font-medium text-white">Notes</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-white/70">
                <li><span className="text-white/80">API Key management</span>: Go to Settings → API Keys.</li>
                <li><span className="text-white/80">Headers</span>: use <code className="text-white">X-API-Key</code> for protected APIs.</li>
                <li><span className="text-white/80">Limits</span>: NORMAL: 5/mo, PREMIUM: 15/mo. Exceeding returns 429.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </WalletAuthGuard>
  )
} 