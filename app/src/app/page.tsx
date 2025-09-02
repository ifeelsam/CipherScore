import { Sidebar } from "@/components/sidebar"
import { WalletAuthGuard } from "@/components/wallet-auth-guard"
import { WalletConnect } from "@/components/wallet-connect"

export default function Page() {
  return (
    <WalletAuthGuard>
      <main className="flex min-h-dvh" style={{ background: "#121212" }}>
        {/* Sidebar */}
        <Sidebar />

        {/* Content */}
        <section className="flex-1">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-6 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <div>
                <h1 className="text-pretty text-lg font-semibold text-white">Welcome back, Developer</h1>
                <p className="text-sm text-white/70">Your API is performing well today</p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/docs"
                  className="rounded-full px-4 py-2 text-sm font-medium transition"
                  style={{
                    color: "#00FFFF",
                    border: "1px solid #00FFFF80",
                    background: "transparent",
                  }}
                >
                  View API Docs
                </a>
                <a
                  href="/settings"
                  className="rounded-full bg-[#8A2BE2] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:shadow-[0_0_24px_rgba(138,43,226,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]/60"
                >
                  Account Settings
                </a>
                <WalletConnect />
              </div>
            </div>
          </header>

        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {/* Placeholder cards to show palette and radius */}
          <div className="grid gap-6 md:grid-cols-2">
            <div
              className="rounded-2xl p-6 shadow-sm transition hover:-translate-y-[1px] hover:shadow-[0_0_24px_rgba(138,43,226,0.25)]"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-sm text-white/70">Free Credits</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">847 left</h2>
              {/* Progress rail */}
              <div className="mt-4 h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: "85%",
                    background: "linear-gradient(90deg, #8A2BE2 0%, #00FFFF 100%)",
                  }}
                  aria-label="Free credits usage 85%"
                  role="progressbar"
                  aria-valuenow={85}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/60">Resets in 12 days</span>
                <a
                  href="/subscription"
                  className="rounded-full bg-[#8A2BE2] px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:shadow-[0_0_16px_rgba(138,43,226,0.35)]"
                >
                  Get More Credits
                </a>
              </div>
            </div>

            <div
              className="rounded-2xl p-6 shadow-sm transition hover:-translate-y-[1px] hover:shadow-[0_0_24px_rgba(138,43,226,0.25)]"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-sm text-white/70">Premium Credits</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">Unlimited</h2>
              <div className="mt-4 h-2 w-full rounded-full bg-white/10">
                <div
                  className="h-2 w-[6%] rounded-full"
                  style={{
                    background: "linear-gradient(90deg, #8A2BE2 0%, #00FFFF 100%)",
                  }}
                  aria-label="Premium credits usage 6%"
                  role="progressbar"
                  aria-valuenow={6}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-white/60">Next billing: Feb 15</span>
                <a
                  href="/subscription"
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                  style={{
                    color: "#00FFFF",
                    border: "1px solid #00FFFF80",
                    background: "transparent",
                  }}
                >
                  Manage Plan
                </a>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div
              className="rounded-xl p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-white/60">API Calls This Month</p>
              <p className="mt-1 text-xl font-semibold text-white">1,247</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-white/60">Last Request</p>
              <p className="mt-1 text-xl font-semibold text-white">2 mins ago</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-white/60">Success Rate</p>
              <p className="mt-1 text-xl font-semibold text-white">99.6%</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    </WalletAuthGuard>
  )
}
