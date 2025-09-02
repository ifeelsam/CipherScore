import { Sidebar } from "@/components/sidebar"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export default function UsagePage() {
  return (
    <main className="flex min-h-dvh" style={{ background: "#121212" }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Content */}
      <section className="flex-1">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div>
              <h1 className="text-pretty text-lg font-semibold text-white">Usage</h1>
              <p className="text-sm text-white/70">Monitor your credits and API traffic</p>
            </div>
            <div className="flex items-center gap-3">
              <a
                href="/subscription"
                className="rounded-full bg-[#8A2BE2] px-4 py-2 text-sm font-medium text-white shadow-md transition hover:shadow-[0_0_24px_rgba(138,43,226,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]/60"
              >
                Upgrade Plan
              </a>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {/* Credits */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
              <CardHeader>
                <CardTitle className="text-white">Free Credits</CardTitle>
                <CardDescription className="text-white/70">Resets in 12 days</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-white">847 left</p>
                <div className="mt-4">
                  <Progress value={85} className="h-2 bg-white/10" aria-label="Free credits used" />
                  <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                    <span>Used 85%</span>
                    <span>Remaining 15%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
              <CardHeader>
                <CardTitle className="text-white">Premium Credits</CardTitle>
                <CardDescription className="text-white/70">Next billing: Feb 15</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold text-white">Unlimited</p>
                <div className="mt-4">
                  <Progress value={6} className="h-2 bg-white/10" aria-label="Premium credits used" />
                  <div className="mt-2 flex items-center justify-between text-xs text-white/60">
                    <span>Used 6%</span>
                    <span>Remaining 94%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Simple stats */}
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
              <p className="text-xs text-white/60">Success Rate</p>
              <p className="mt-1 text-xl font-semibold text-white">99.6%</p>
            </div>
            <div
              className="rounded-xl p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-white/60">Avg Latency</p>
              <p className="mt-1 text-xl font-semibold text-white">142 ms</p>
            </div>
          </div>

          {/* Minimal endpoint breakdown */}
          <div className="grid gap-4">
            <div
              className="rounded-xl p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-white">Top Endpoints</p>
                <a
                  href="/docs"
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition"
                  style={{ color: "#00FFFF", border: "1px solid #00FFFF80", background: "transparent" }}
                >
                  View API Docs
                </a>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                <li className="flex items-center justify-between text-white/80">
                  <span className="truncate">POST /v1/scores</span>
                  <span className="tabular-nums text-white/60">532 calls</span>
                </li>
                <li className="flex items-center justify-between text-white/80">
                  <span className="truncate">GET /v1/scores/:id</span>
                  <span className="tabular-nums text-white/60">418 calls</span>
                </li>
                <li className="flex items-center justify-between text-white/80">
                  <span className="truncate">POST /v1/batch</span>
                  <span className="tabular-nums text-white/60">297 calls</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

