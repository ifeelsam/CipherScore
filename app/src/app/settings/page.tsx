"use client"

import { useEffect, useMemo, useState } from "react"
import { Sidebar } from "@/components/sidebar"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useWallet } from "@solana/wallet-adapter-react"
import bs58 from "bs58"
import { Dialog } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"

export default function SettingsPage() {
  return (
    <main className="flex min-h-dvh" style={{ background: "#121212" }}>
      {/* Sidebar */}
      <Sidebar />

      {/* Content */}
      <section className="flex-1">
        <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-6 py-4 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between">
            <div>
              <h1 className="text-pretty text-lg font-semibold text-white">Settings</h1>
              <p className="text-sm text-white/70">Manage your account and preferences</p>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {/* Account */}
          <ProfileCard />

          {/* API Keys */}
          <ApiKeysManager />

          {/* Preferences */}
          <PreferencesCard />
        </div>
      </section>
    </main>
  )
}

function ProfileCard() {
  const backendBaseUrl = useMemo(() => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000", [])
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [profileName, setProfileName] = useState("")
  const [profileEmail, setProfileEmail] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("cipher_session") : null
      if (stored) {
        const parsed = JSON.parse(stored) as { token: string; expiresAt: string; walletAddress: string }
        if (new Date(parsed.expiresAt).getTime() > Date.now()) {
          setSessionToken(parsed.token)
        }
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!sessionToken) { setLoading(false); return }
    let cancelled = false
    async function fetchProfile() {
      setLoading(true)
      try {
        const res = await fetch(`${backendBaseUrl}/dashboard/profile`, { headers: { "X-Session-Token": sessionToken as string } })
        const json = await res.json()
        if (res.ok && json.success && !cancelled) {
          setProfileName(json.data.name || "")
          setProfileEmail(json.data.email || "")
        }
      } catch {}
      finally { if (!cancelled) setLoading(false) }
    }
    fetchProfile()
    return () => { cancelled = true }
  }, [sessionToken, backendBaseUrl])

  return (
    <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
      <CardHeader>
        <CardTitle className="text-white">Account</CardTitle>
        <CardDescription className="text-white/70">Basic profile information</CardDescription>
      </CardHeader>
      <CardContent>
        {!sessionToken ? (
          <div className="rounded-xl p-4 text-sm" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)", color: "#FFFFFFB2" }}>
            Connect your wallet to edit profile.
          </div>
        ) : loading ? (
          <div className="rounded-xl p-4 text-sm" style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)", color: "#FFFFFFB2" }}>
            Loading profile...
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="name" className="text-white/80">Name</Label>
                <Input id="name" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Developer Name" className="text-white placeholder:text-white/40" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-white/80">Email</Label>
                <Input id="email" type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)} placeholder="developer@cipherscore.dev" className="text-white placeholder:text-white/40" />
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                className="rounded-full bg-[#8A2BE2] px-4 text-white shadow-sm transition hover:shadow-[0_0_24px_rgba(138,43,226,0.45)] hover:-translate-y-[1px]"
                onClick={async () => {
                  if (!sessionToken) return
                  try {
                    const res = await fetch(`${backendBaseUrl}/dashboard/profile`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', 'X-Session-Token': sessionToken },
                      body: JSON.stringify({ name: profileName || null, email: profileEmail || null })
                    })
                    const json = await res.json()
                    if (res.ok && json.success) {
                      try { toast({ title: 'Profile updated' }) } catch {}
                    } else {
                      try { toast({ title: 'Update failed', description: json.error || 'Try again later' }) } catch {}
                    }
                  } catch {
                    try { toast({ title: 'Update failed', description: 'Network error' }) } catch {}
                  }
                }}
              >
                Save changes
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function ApiKeysManager() {
  type SanitizedKey = {
    id: string
    name: string
    createdAt: string
    lastUsed?: string | null
    isActive: boolean
    usageCount: number
    totalUsageRecords?: number
    keyPreview: string
  }

  const backendBaseUrl = useMemo(() => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000", [])
  const { connected, publicKey, signMessage } = useWallet()
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [authenticating, setAuthenticating] = useState(false)
  const [keys, setKeys] = useState<SanitizedKey[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyPlain, setNewKeyPlain] = useState<string | null>(null)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Ensure a session token when wallet is connected
  useEffect(() => {
    let cancelled = false

    async function ensureSession() {
      if (!connected || !publicKey) return

      // Try reuse
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

      // Create fresh session via signed nonce
      try {
        setAuthenticating(true)
        const nonceRes = await fetch(`${backendBaseUrl}/wallet-auth/request-nonce`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
        })
        const nonceJson = await nonceRes.json()
        if (!nonceRes.ok || !nonceJson?.data?.message) throw new Error(nonceJson?.error || "Failed to get nonce")

        if (!signMessage) throw new Error("Wallet does not support message signing")
        const messageBytes = new TextEncoder().encode(nonceJson.data.message as string)
        const sigBytes = await signMessage(messageBytes)
        const signature = bs58.encode(sigBytes)

        const verifyRes = await fetch(`${backendBaseUrl}/wallet-auth/verify-signature`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: publicKey.toBase58(),
            signature,
            message: nonceJson.data.message,
          }),
        })
        const verifyJson = await verifyRes.json()
        if (!verifyRes.ok || !verifyJson?.success || !verifyJson?.data?.sessionToken) {
          throw new Error(verifyJson?.error || "Auth failed")
        }

        const token = verifyJson.data.sessionToken as string
        const expiresAt = verifyJson.data.expiresAt as string
        if (!cancelled) {
          setSessionToken(token)
          window.localStorage.setItem(
            "cipher_session",
            JSON.stringify({ token, expiresAt, walletAddress: publicKey.toBase58() })
          )
        }
      } catch (e) {
        // Silent fail; UI will still show connect/auth prompt
      } finally {
        if (!cancelled) setAuthenticating(false)
      }
    }

    ensureSession()
    return () => { cancelled = true }
  }, [connected, publicKey, signMessage, backendBaseUrl])

  // Fetch keys when session ready
  useEffect(() => {
    if (!sessionToken) return
    let cancelled = false

    async function fetchKeys(token: string) {
      setLoading(true)
      try {
        const res = await fetch(`${backendBaseUrl}/dashboard/api-keys/list`, {
          headers: { "X-Session-Token": token },
        })
        const json = await res.json()
        if (res.ok && json.success) {
          if (!cancelled) setKeys((json.data as any[]).filter((k) => k.isActive))
        }
      } catch (e) {
        // ignore
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchKeys(sessionToken)
    return () => {
      cancelled = true
    }
  }, [sessionToken, backendBaseUrl])

  async function createKey() {
    if (!sessionToken || !newKeyName.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`${backendBaseUrl}/dashboard/api-keys/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken },
        body: JSON.stringify({ name: newKeyName.trim() }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setNewKeyPlain(json.data.key as string)
        setNewKeyName("")
        // refresh list
        const list = await fetch(`${backendBaseUrl}/dashboard/api-keys/list`, {
          headers: { "X-Session-Token": sessionToken as string },
        })
        const listJson = await list.json()
        if (list.ok && listJson.success) setKeys((listJson.data as any[]).filter((k: any) => k.isActive))
      }
    } catch {}
    finally {
      setCreating(false)
    }
  }

  async function deactivateKey(id: string) {
    if (!sessionToken) return
    try {
      const res = await fetch(`${backendBaseUrl}/dashboard/api-keys/${id}`, {
        method: "DELETE",
        headers: { "X-Session-Token": sessionToken as string },
      })
      if (res.ok) {
        setKeys((prev) => prev.filter(k => k.id !== id))
      }
    } catch {}
  }

  async function submitRename() {
    if (!sessionToken || !renameId || !renameValue.trim()) return
    try {
      const res = await fetch(`${backendBaseUrl}/dashboard/api-keys/${renameId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Session-Token": sessionToken as string },
        body: JSON.stringify({ name: renameValue.trim() }),
      })
      const json = await res.json()
      if (res.ok && json.success) {
        setKeys((prev) => prev.map(k => k.id === renameId ? { ...k, name: renameValue.trim() } : k))
        setRenameId(null)
        setRenameValue("")
      }
    } catch {}
  }

  return (
    <>
      <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
        <CardHeader>
          <CardTitle className="text-white">API Keys</CardTitle>
          <CardDescription className="text-white/70">Create and manage your API keys</CardDescription>
        </CardHeader>
        <CardContent>
          {!connected ? (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)", color: "#FFFFFFB2" }}
            >
              Connect your wallet to manage API keys.
            </div>
          ) : authenticating || !sessionToken ? (
            <div
              className="rounded-xl p-4 text-sm"
              style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)", color: "#FFFFFFB2" }}
            >
              Preparing your session...
            </div>
          ) : (
            <div className="space-y-6">
              {newKeyPlain && (
                <div
                  className="rounded-xl p-4"
                  style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <p className="text-sm text-white/80">New API key (shown once):</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      readOnly
                      value={newKeyPlain}
                      className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none md:text-sm text-white"
                      style={{ borderColor: "rgba(255,255,255,0.16)" }}
                    />
                    <button
                      type="button"
                      className="rounded-full px-4 text-sm font-medium transition"
                      style={{ color: "#00FFFF", border: "1px solid #00FFFF80", background: "transparent", height: "36px" }}
                      onClick={async () => {
                        try { await navigator.clipboard.writeText(newKeyPlain) } catch {}
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Create */}
              <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-end">
                <div className="grid gap-2">
                  <Label htmlFor="keyName" className="text-white/80">New key name</Label>
                  <Input id="keyName" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="Default API Key" className="text-white placeholder:text-white/40" />
                </div>
                <Button
                  className="rounded-full bg-[#8A2BE2] px-4 text-white shadow-sm transition hover:shadow-[0_0_24px_rgba(138,43,226,0.45)] hover:-translate-y-[1px]"
                  disabled={creating || !newKeyName.trim()}
                  onClick={async () => {
                    await createKey();
                    try { toast({ title: 'Key created', description: 'Copy it now, it will be shown once.' }) } catch {}
                  }}
                >
                  {creating ? "Creating..." : "Create Key"}
                </Button>
              </div>

              {/* List */}
              <div
                className="rounded-xl"
                style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <div className="grid grid-cols-12 gap-3 border-b border-white/5 px-3 py-2 text-xs text-white/50">
                  <div className="col-span-4">Name</div>
                  <div className="col-span-3">Key</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Usage</div>
                  <div className="col-span-1 text-right">Actions</div>
                </div>
                <div className="divide-y divide-white/5">
                  {loading ? (
                    <div className="px-3 py-3 text-sm text-white/60">Loading...</div>
                  ) : keys.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-white/60">No keys yet. Create your first key using the form above.</div>
                  ) : (
                    keys.map((k) => (
                      <div key={k.id} className="grid grid-cols-12 items-center gap-3 px-3 py-3 text-sm">
                        <div className="col-span-4">
                          {renameId === k.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                className="h-8 text-white"
                              />
                              <button
                                className="rounded-full px-3 text-xs font-medium transition"
                                style={{ color: "#00FFFF", border: "1px solid #00FFFF80", background: "transparent", height: "32px" }}
                                onClick={submitRename}
                              >
                                Save
                              </button>
                              <button
                                className="rounded-full px-3 text-xs font-medium transition"
                                style={{ color: "#00FFFF", border: "1px solid #00FFFF80", background: "transparent", height: "32px" }}
                                onClick={() => { setRenameId(null); setRenameValue("") }}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-white/85">{k.name}</span>
                              <button
                                className="rounded-full px-3 text-xs font-medium transition"
                                style={{ color: "#00FFFF", border: "1px solid #00FFFF80", background: "transparent", height: "28px" }}
                                onClick={() => { setRenameId(k.id); setRenameValue(k.name) }}
                              >
                                Rename
                              </button>
                            </div>
                          )}
                          <div className="mt-1 text-xs text-white/50">Created {new Date(k.createdAt).toLocaleDateString()}</div>
                        </div>
                        <div className="col-span-3">
                          <div className="truncate text-white/80">{k.keyPreview}</div>
                          <div className="text-xs text-white/50">Full key is shown only once when created</div>
                        </div>
                        <div className="col-span-2">
                          <span className="text-white/80">{k.isActive ? "Active" : "Inactive"}</span>
                        </div>
                        <div className="col-span-2 text-white/80">{k.usageCount}</div>
                        <div className="col-span-1 text-right">
                          <button
                            className="rounded-full px-3 text-xs font-medium transition disabled:opacity-50 hover:-translate-y-[1px] hover:shadow-[0_0_16px_rgba(0,255,255,0.25)]"
                            style={{ color: "#00FFFF", border: "1px solid #00FFFF80", background: "transparent", height: "28px" }}
                            onClick={() => { setPendingDeleteId(k.id); setConfirmOpen(true) }}
                            disabled={!k.isActive}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      {confirmOpen && (
        <Dialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Deactivate API key?"
          description="This action cannot be undone. You will no longer be able to use this key."
          confirmText="Deactivate"
          cancelText="Cancel"
          onConfirm={async () => {
            if (!pendingDeleteId) return
            await deactivateKey(pendingDeleteId)
            setPendingDeleteId(null)
            try { toast({ title: 'Key deactivated' }) } catch {}
          }}
        />
      )}
    </>
  )
}

/* Client bits for interactivity */
function PreferencesCard() {
  return (
    <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
      <CardHeader>
        <CardTitle className="text-white">Preferences</CardTitle>
        <CardDescription className="text-white/70">Customize notifications and behavior</CardDescription>
      </CardHeader>
      <CardContent>
        <div
          className="flex items-center justify-between gap-4 rounded-lg px-3 py-2"
          style={{ background: "#121212", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <p className="text-sm font-medium text_WHITE">Email alerts</p>
            <p className="text-xs text-white/60">Receive usage alerts and updates</p>
          </div>
          <ClientSwitch />
        </div>
      </CardContent>
    </Card>
  )
}
function ClientSwitch() {
  const [enabled, setEnabled] = useState(true)
  return <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Toggle email alerts" />
}
