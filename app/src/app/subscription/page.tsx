'use client'

import { Sidebar } from "@/components/sidebar"
import { WalletAuthGuard } from "@/components/wallet-auth-guard"

export default function SubscriptionPage() {
  return (
    <WalletAuthGuard>
      <main className="flex min-h-dvh" style={{ background: "#121212" }}>
        <Sidebar />
        <section className="flex-1">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-6 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <div>
                <h1 className="text-pretty text-lg font-semibold text-white">Subscription</h1>
                <p className="text-sm text-white/70">Manage your plan and billing</p>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl space-y-6 p-6">
            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h2 className="text-2xl font-semibold text-white">Premium Status</h2>
              <p className="mt-2 text-base text-white/70">
                Premium is temporarily paused. Premium will be active again once Arcium’s Testnet V2 is live.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <a
                  href="/docs"
                  className="rounded-full px-4 py-2 text-sm font-medium transition"
                  style={{ color: "#00FFFF", border: "1px solid #00FFFF80", background: "transparent" }}
                >
                  View API Docs
                </a>
                <a
                  href="/settings"
                  className="rounded-full bg-[#8A2BE2] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:shadow-[0_0_24px_rgba(138,43,226,0.4)]"
                >
                  Go to Settings
                </a>
              </div>
            </div>

            <div
              className="rounded-2xl p-6"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="text-lg font-medium text-white">What to expect</h3>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-white/70">
                <li>All free features remain available during this period.</li>
                <li>Premium limits and perks will resume automatically when Testnet V2 is live.</li>
                <li>No action is required on your end; we’ll announce the switch.</li>
              </ul>
            </div>
          </div>
        </section>
      </main>
    </WalletAuthGuard>
  )
} 