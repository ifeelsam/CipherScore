'use client'

import { Sidebar } from '@/components/sidebar'
import { WalletAuthGuard } from '@/components/wallet-auth-guard'
import { useEffect, useMemo, useState } from 'react'

interface ApiKeyItem {
  id: string
  name: string
  createdAt: string
  lastUsed?: string | null
  isActive: boolean
  usageCount: number
  keyPreview: string
  recentUsage?: Array<{
    id: string
    endpoint: string
    timestamp: string
  }>
}

export default function UsagePage() {
  const backendBaseUrl = useMemo(() => process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3000', [])
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [keys, setKeys] = useState<ApiKeyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedKeyId, setSelectedKeyId] = useState<string | 'all'>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? window.localStorage.getItem('cipher_session') : null
      if (stored) {
        const parsed = JSON.parse(stored) as { token: string; expiresAt: string; walletAddress: string }
        if (new Date(parsed.expiresAt).getTime() > Date.now()) setSessionToken(parsed.token)
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (!sessionToken) { setLoading(false); return }
    let cancelled = false

    async function fetchKeysWithUsage() {
      setLoading(true)
      try {
        const listRes = await fetch(`${backendBaseUrl}/dashboard/api-keys/list`, {
          headers: { 'X-Session-Token': sessionToken as string }
        })
        const listJson = await listRes.json()
        if (!listRes.ok || !listJson.success) { setLoading(false); return }
        const baseKeys: ApiKeyItem[] = (listJson.data as any[]).filter(k => k.isActive)

        // Fetch recent usage per key in parallel (limit to 20 per key)
        const details = await Promise.all(baseKeys.map(async (k) => {
          const res = await fetch(`${backendBaseUrl}/dashboard/api-keys/${k.id}`, {
            headers: { 'X-Session-Token': sessionToken as string }
          })
          const json = await res.json()
          if (res.ok && json.success) {
            return { ...k, recentUsage: (json.data?.recentUsage || []) as ApiKeyItem['recentUsage'] }
          }
          return k
        }))

        if (!cancelled) setKeys(details)
      } catch {
        if (!cancelled) setKeys([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchKeysWithUsage()
    return () => { cancelled = true }
  }, [sessionToken, backendBaseUrl])

  const filtered = useMemo(() => {
    const byKey = selectedKeyId === 'all' ? keys : keys.filter(k => k.id === selectedKeyId)
    if (!search.trim()) return byKey
    const q = search.toLowerCase()
    return byKey.map(k => ({
      ...k,
      recentUsage: (k.recentUsage || []).filter(u => u.endpoint.toLowerCase().includes(q))
    }))
  }, [keys, selectedKeyId, search])

  return (
    <WalletAuthGuard>
      <main className="flex min-h-dvh" style={{ background: '#121212' }}>
        <Sidebar />
        <section className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-4 md:px-6 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <div className="pl-16 md:pl-0">
                <h1 className="text-pretty text-base md:text-lg font-semibold text-white">Usage</h1>
                <p className="text-xs md:text-sm text-white/70">See which key was used, where, and when</p>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-6xl space-y-4 md:space-y-6 p-4 md:p-6 pb-20 md:pb-6">
            <div className="grid gap-3 md:grid-cols-3">
              <div>
                <label className="block text-xs text-white/60 mb-1">Filter by key</label>
                <select
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyId(e.target.value as any)}
                  className="w-full rounded-md bg-transparent px-3 py-2 text-sm text-white"
                  style={{ border: '1px solid rgba(255,255,255,0.16)' }}
                >
                  <option value="all" className="bg-[#1A1A1A]">All keys</option>
                  {keys.map(k => (
                    <option key={k.id} value={k.id} className="bg-[#1A1A1A]">{k.name}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-white/60 mb-1">Search endpoint</label>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. POST /calculate_credit_score"
                  className="w-full rounded-md bg-transparent px-3 py-2 text-sm text-white placeholder:text-white/40"
                  style={{ border: '1px solid rgba(255,255,255,0.16)' }}
                />
              </div>
            </div>

            {loading ? (
              <div className="rounded-lg md:rounded-xl p-4 text-sm text-white/70" style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.06)' }}>
                Loading usage...
              </div>
            ) : (
              <div className="space-y-4 md:space-y-6">
                {filtered.map(k => (
                  <div key={k.id} className="rounded-xl md:rounded-2xl p-4 md:p-6" style={{ background: '#1A1A1A', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm text-white/60">API Key</p>
                        <h2 className="text-lg md:text-xl font-semibold text-white truncate">{k.name}</h2>
                        <p className="text-xs text-white/50 mt-1 truncate">{k.keyPreview}</p>
                      </div>
                      <div className="text-left sm:text-right flex-shrink-0">
                        <p className="text-xs text-white/60">Total requests</p>
                        <p className="text-base md:text-lg font-semibold text-white">{k.usageCount}</p>
                      </div>
                    </div>
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <p className="text-xs text-white/60 mb-2">Recent usage</p>
                      {(k.recentUsage && k.recentUsage.length > 0) ? (
                        <ul className="divide-y divide-white/5">
                          {k.recentUsage!.map(u => (
                            <li key={u.id} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 gap-1 text-sm">
                              <span className="text-white/80 break-all">{u.endpoint}</span>
                              <span className="text-xs sm:text-sm text-white/50 flex-shrink-0">{new Date(u.timestamp).toLocaleString()}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-sm text-white/60">No recent usage</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
    </WalletAuthGuard>
  )
}

