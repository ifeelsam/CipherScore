"use client"

import { Sidebar } from "@/components/sidebar"
import { WalletAuthGuard } from "@/components/wallet-auth-guard"
import { WalletConnect } from "@/components/wallet-connect"
import { useEffect, useMemo, useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import bs58 from "bs58"

interface SessionData {
  user: {
    id: string
    walletAddress: string
    name?: string | null
    tier: "NORMAL" | "PREMIUM"
    monthlyLimit: number
    monthlyUsage: number
    createdAt?: string
  }
}

interface SessionResponse {
  success: boolean
  data?: SessionData
  error?: string
  message?: string
  timestamp?: string
}

interface UsageStatsResponse {
  success: boolean
  data?: {
    totalRequests: number
    endpointStats: Array<{ endpoint: string; count: number }>
    monthlyUsage: {
      used: number
      limit: number
      remaining: number
      resetDate: string
      tier: "NORMAL" | "PREMIUM"
    }
    activeApiKeys: number
    totalApiKeys: number
  }
  error?: string
  message?: string
  timestamp?: string
}

export default function Page() {
  const { publicKey, connected, signMessage } = useWallet()

  const backendBaseUrl = useMemo(() => {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000"
  }, [])

  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [usage, setUsage] = useState<{
    used: number
    limit: number
    remaining: number
    resetDate?: string
    tier?: "NORMAL" | "PREMIUM"
  }>({ used: 0, limit: 0, remaining: 0 })
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [displayName, setDisplayName] = useState<string>("User")

  // Session bootstrap using wallet signature
  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
      if (!connected || !publicKey) return

      // Try to reuse existing session if valid and for same wallet
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("cipher_session") : null
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as { token: string; expiresAt: string; walletAddress: string }
          const notExpired = new Date(parsed.expiresAt).getTime() > Date.now()
          const sameWallet = parsed.walletAddress === publicKey.toBase58()
          if (notExpired && sameWallet) {
            setSessionToken(parsed.token)
            return
          }
        } catch {}
      }

      // Fresh auth flow
      try {
        // 1) Request nonce + message
        const nonceRes = await fetch(`${backendBaseUrl}/wallet-auth/request-nonce`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
        })
        const nonceJson = await nonceRes.json()
        if (!nonceRes.ok || !nonceJson?.data?.message) throw new Error(nonceJson?.error || "Failed to get nonce")

        // 2) Sign message
        if (!signMessage) throw new Error("Wallet does not support message signing")
        const message = new TextEncoder().encode(nonceJson.data.message as string)
        const signatureBytes = await signMessage(message)
        const signature = bs58.encode(signatureBytes)

        // 3) Verify signature to obtain session token
        const verifyRes = await fetch(`${backendBaseUrl}/wallet-auth/verify-signature`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: publicKey.toBase58(),
            signature,
            message: nonceJson.data.message,
          }),
        })
        const verifyJson: SessionResponse = await verifyRes.json()
        if (!verifyRes.ok || !verifyJson.success || !verifyJson.data) throw new Error(verifyJson?.error || "Auth failed")

        const token = (verifyJson as any).data.sessionToken as string
        const expiresAt = (verifyJson as any).data.expiresAt as string
        if (!token) throw new Error("Missing session token")

        if (!cancelled) {
          setSessionToken(token)
          // Persist session for this wallet
          window.localStorage.setItem(
            "cipher_session",
            JSON.stringify({ token, expiresAt, walletAddress: publicKey.toBase58() })
          )
        }
      } catch (e) {
        console.error("Wallet auth failed:", e)
      }
    }

    ensureSession()
    return () => {
      cancelled = true
    }
  }, [connected, publicKey, signMessage, backendBaseUrl])

  // Fetch usage with session token
  useEffect(() => {
    let cancelled = false
    async function fetchUsage() {
      if (!sessionToken) return
      setLoadingUsage(true)
      try {
        const res = await fetch(`${backendBaseUrl}/dashboard/api-keys/stats/usage`, {
          headers: { "X-Session-Token": sessionToken },
        })
        const json: UsageStatsResponse = await res.json()
        if (res.ok && json.success && json.data) {
          const m = json.data.monthlyUsage
          if (!cancelled) {
            setUsage({
              used: m.used,
              limit: m.limit,
              remaining: m.remaining,
              resetDate: m.resetDate,
              tier: m.tier,
            })
          }
        }
      } catch (e) {
        console.error("Failed to fetch usage:", e)
      } finally {
        if (!cancelled) setLoadingUsage(false)
      }
    }
    fetchUsage()
    return () => {
      cancelled = true
    }
  }, [sessionToken, backendBaseUrl])

  // Fetch profile display name
  useEffect(() => {
    let cancelled = false
    async function fetchProfile() {
      if (!sessionToken) return
      try {
        const res = await fetch(`${backendBaseUrl}/dashboard/profile`, {
          headers: { "X-Session-Token": sessionToken },
        })
        const json = await res.json()
        if (!cancelled && res.ok && json.success) {
          setDisplayName(json.data?.name || "User")
        }
      } catch {}
    }
    fetchProfile()
    return () => { cancelled = true }
  }, [sessionToken, backendBaseUrl])

  const percentUsed = useMemo(() => {
    if (!usage.limit || usage.limit <= 0) return 0
    const p = Math.round((usage.used / usage.limit) * 100)
    return Math.min(100, Math.max(0, p))
  }, [usage.used, usage.limit])

  const daysUntilReset = useMemo(() => {
    if (!usage.resetDate) return null
    const diffMs = new Date(usage.resetDate).getTime() - Date.now()
    const days = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))
    return days
  }, [usage.resetDate])

  return (
    <WalletAuthGuard>
      <main className="flex min-h-dvh" style={{ background: "#121212" }}>
        {/* Sidebar */}
        <Sidebar />

        {/* Content */}
        <section className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-4 md:px-6 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
              <div className="min-w-0 pl-16 md:pl-0">
                <h1 className="text-pretty text-base md:text-lg font-semibold text-white truncate">Welcome back, {displayName}</h1>
                <p className="text-xs md:text-sm text-white/70">Your API is performing well today</p>
              </div>
              <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                <a
                  href="/docs"
                  className="hidden sm:block rounded-full px-3 md:px-4 py-2 text-xs md:text-sm font-medium transition whitespace-nowrap"
                  style={{
                    color: "#00FFFF",
                    border: "1px solid #00FFFF80",
                    background: "transparent",
                  }}
                >
                  API Docs
                </a>
                <a
                  href="/settings"
                  className="rounded-full bg-[#8A2BE2] px-3 md:px-4 py-2 text-xs md:text-sm font-medium text-white shadow-md transition hover:shadow-[0_0_24px_rgba(138,43,226,0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]/60 whitespace-nowrap"
                >
                  Settings
                </a>
              </div>
            </div>
          </header>

        <div className="mx-auto max-w-6xl space-y-4 md:space-y-6 p-4 md:p-6 pb-20 md:pb-6">
          {/* Placeholder cards to show palette and radius */}
          <div className="grid gap-4 md:gap-6 md:grid-cols-2">
            <div
              className="rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm transition hover:-translate-y-[1px] hover:shadow-[0_0_24px_rgba(138,43,226,0.25)]"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs md:text-sm text-white/70">Free Credits</p>
              <h2 className="mt-2 text-2xl md:text-3xl font-semibold text-white">
                {loadingUsage ? "—" : `${usage.remaining} left`}
              </h2>
              {/* Progress rail */}
              <div className="mt-4 h-2 w-full rounded-full bg_white/10">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${percentUsed}%`,
                    background: "linear-gradient(90deg, #8A2BE2 0%, #00FFFF 100%)",
                  }}
                  aria-label={`Free credits used ${percentUsed}%`}
                  role="progressbar"
                  aria-valuenow={percentUsed}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xs text-white/60">
                  {daysUntilReset === null ? "" : `Resets in ${daysUntilReset} day${daysUntilReset === 1 ? "" : "s"}`}
                </span>
                <a
                  href="/subscription"
                  className="rounded-full bg-[#8A2BE2] px-4 md:px-5 py-1.5 text-xs md:text-sm font-semibold text-white shadow-sm transition hover:shadow-[0_0_16px_rgba(138,43,226,0.35)] whitespace-nowrap"
                >
                  Get More Credits
                </a>
              </div>
            </div>

            <div
              className="rounded-xl md:rounded-2xl p-4 md:p-6 shadow-sm transition hover:-translate-y-[1px] hover:shadow-[0_0_24px_rgba(138,43,226,0.25)]"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs md:text-sm text-white/70">Premium Credits</p>
              <h2 className="mt-2 text-2xl md:text-3xl font-semibold text-white">Unlimited</h2>
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
              <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <span className="text-xs text-white/60">Next billing: Feb 15</span>
                <a
                  href="/subscription"
                  className="rounded-full px-4 md:px-5 py-1.5 text-xs md:text-sm font-semibold transition whitespace-nowrap"
                  style={{
                    color: "#00FFFF",
                    border: "1px solid #00FFFF80",
                    background: "transparent",
                  }}
                >
                  {usage.tier === "PREMIUM" ? "Manage Plan" : "Upgrade Plan"}
                </a>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:gap-4 grid-cols-1 sm:grid-cols-3">
            <div
              className="rounded-lg md:rounded-xl p-3 md:p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-white/60">API Calls This Month</p>
              <p className="mt-1 text-lg md:text-xl font-semibold text-white">{usage.used}</p>
            </div>
            <div
              className="rounded-lg md:rounded-xl p-3 md:p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-white/60">Last Request</p>
              <p className="mt-1 text-lg md:text-xl font-semibold text_white">—</p>
            </div>
            <div
              className="rounded-lg md:rounded-xl p-3 md:p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="text-xs text-white/60">Success Rate</p>
              <p className="mt-1 text-lg md:text-xl font-semibold text-white">—</p>
            </div>
          </div>
        </div>
      </section>
    </main>
    </WalletAuthGuard>
  )
}
