"use client"

import { useState, useEffect, useMemo } from "react"
import { Sidebar } from "@/components/sidebar"
import { WalletAuthGuard } from "@/components/wallet-auth-guard"
import { useWallet } from "@solana/wallet-adapter-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, AlertCircle, TrendingUp, TrendingDown, Wallet, Clock, Shield, Activity } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { CreditScoreCircle } from "@/components/credit-score-circle"

interface CreditScoreResponse {
  success: boolean
  data?: {
    wallet: string
    score: number
    risk_level: "LOW" | "MEDIUM" | "HIGH"
    transaction_signature: string
    computation_offset: number
    metrics?: {
      wallet_age_days: number
      transaction_count: number
      total_volume_usd: number
      unique_protocols: number
      defi_positions: number
      nft_count: number
      failed_txs: number
      sol_balance: number
    }
  }
  error?: string
  message?: string
}

interface WalletStatusResponse {
  success: boolean
  data?: {
    account_exists: boolean
    current_score?: number
    risk_level?: "LOW" | "MEDIUM" | "HIGH"
    cooldown_status: {
      is_on_cooldown: boolean
      cooldown_ends_at?: string
      remaining_requests?: number
    }
  }
  error?: string
}

export default function CreditScoreCalculatorPage() {
  const { publicKey, connected } = useWallet()
  const backendBaseUrl = useMemo(() => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000", [])
  const defaultApiKey = process.env.NEXT_PUBLIC_CIPHERSCORE_API_KEY || "cypher_demo_key_12345"
  
  const [walletAddress, setWalletAddress] = useState("")
  const [isCalculating, setIsCalculating] = useState(false)
  const [result, setResult] = useState<CreditScoreResponse["data"] | null>(null)
  const [walletStatus, setWalletStatus] = useState<WalletStatusResponse["data"] | null>(null)
  const [error, setError] = useState("")

  // Auto-fill wallet address when connected
  useEffect(() => {
    if (connected && publicKey && !walletAddress) {
      setWalletAddress(publicKey.toBase58())
    }
  }, [connected, publicKey, walletAddress])

  const calculateCreditScore = async () => {
    if (!walletAddress.trim()) {
      setError("Please enter a wallet address")
      return
    }

    setIsCalculating(true)
    setError("")
    setResult(null)

    try {
      const response = await fetch(`${backendBaseUrl}/calculate_credit_score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": defaultApiKey
        },
        body: JSON.stringify({
          wallet_address: walletAddress.trim()
        })
      })

      const data: CreditScoreResponse = await response.json()
      
      if (response.ok && data.success && data.data) {
        setResult(data.data)
        toast({
          title: "Credit Score Calculated!",
          description: `Your score is ${data.data.score} (${data.data.risk_level} risk)`
        })
      } else {
        setError(data.error || "Failed to calculate credit score")
        toast({
          title: "Calculation Failed",
          description: data.error || "Please try again",
          variant: "destructive"
        })
      }
    } catch (err) {
      setError("Network error. Please check your connection and try again.")
      toast({
        title: "Network Error",
        description: "Please check your connection and try again",
        variant: "destructive"
      })
    } finally {
      setIsCalculating(false)
    }
  }

  const checkWalletStatus = async () => {
    if (!walletAddress.trim()) return

    try {
      const response = await fetch(`${backendBaseUrl}/wallet_status/${walletAddress.trim()}`, {
        headers: {
          "X-API-Key": defaultApiKey
        }
      })

      const data: WalletStatusResponse = await response.json()
      
      if (response.ok && data.success && data.data) {
        setWalletStatus(data.data)
      }
    } catch (err) {
      console.error("Failed to check wallet status:", err)
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 750) return "text-green-400"
    if (score >= 650) return "text-yellow-400"
    return "text-red-400"
  }

  const getRiskBadgeColor = (risk: string) => {
    switch (risk) {
      case "LOW": return "bg-green-500/20 text-green-400 border-green-500/30"
      case "MEDIUM": return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      case "HIGH": return "bg-red-500/20 text-red-400 border-red-500/30"
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/30"
    }
  }

  const getScorePercentage = (score: number) => {
    return Math.min(100, Math.max(0, (score / 850) * 100))
  }

  return (
    <WalletAuthGuard>
      <main className="flex min-h-dvh" style={{ background: "#121212" }}>
        <Sidebar />
        
        <section className="flex-1 min-w-0">
          <header className="sticky top-0 z-10 border-b border-white/10 bg-[#121212]/80 px-4 md:px-6 py-4 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <div className="pl-16 md:pl-0">
                <h1 className="text-pretty text-base md:text-lg font-semibold text-white">Credit Score Calculator</h1>
                <p className="text-xs md:text-sm text-white/70">Calculate your Solana wallet credit score instantly</p>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6 pb-20 md:pb-6">
            {/* Input Section */}
            <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  Wallet Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="wallet" className="text-white/80">Solana Wallet Address</Label>
                    <Input
                      id="wallet"
                      value={walletAddress}
                      onChange={(e) => setWalletAddress(e.target.value)}
                      placeholder="Enter wallet address or connect wallet"
                      className="text-white placeholder:text-white/40"
                    />
                    {connected && publicKey && (
                      <p className="text-xs text-white/60">
                        Connected: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-4)}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">API Key Status</Label>
                    <div className="flex items-center gap-2">
                      {defaultApiKey && defaultApiKey !== "cypher_demo_key_12345" ? (
                        <>
                          <CheckCircle className="h-4 w-4 text-green-400" />
                          <span className="text-sm text-green-400">API Key Ready</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 text-yellow-400" />
                          <span className="text-sm text-yellow-400">Using Demo Key</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={calculateCreditScore}
                    disabled={isCalculating || !walletAddress.trim()}
                    className="flex-1 bg-[#8A2BE2] hover:bg-[#8A2BE2]/90 text-white shadow-md transition hover:shadow-[0_0_24px_rgba(138,43,226,0.4)]"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Calculating Score...
                      </>
                    ) : (
                      <>
                        <TrendingUp className="mr-2 h-4 w-4" />
                        Calculate Credit Score
                      </>
                    )}
                  </Button>
                  
                  <Button
                    onClick={checkWalletStatus}
                    disabled={!walletAddress.trim()}
                    variant="outline"
                    className="border-[#00FFFF]/30 text-[#00FFFF] hover:bg-[#00FFFF]/10"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Check Status
                  </Button>
                </div>

                {error && (
                  <div className="rounded-lg p-3 bg-red-500/10 border border-red-500/20">
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Wallet Status */}
            {walletStatus && (
              <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Wallet Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-sm text-white/60">Account Status</p>
                      <Badge className={walletStatus.account_exists ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                        {walletStatus.account_exists ? "Active" : "Not Found"}
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm text-white/60">Cooldown Status</p>
                      <Badge className={walletStatus.cooldown_status.is_on_cooldown ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}>
                        {walletStatus.cooldown_status.is_on_cooldown ? "On Cooldown" : "Available"}
                      </Badge>
                    </div>
                  </div>
                  {walletStatus.cooldown_status.is_on_cooldown && walletStatus.cooldown_status.cooldown_ends_at && (
                    <div className="mt-4 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                      <p className="text-sm text-yellow-400">
                        Cooldown ends: {new Date(walletStatus.cooldown_status.cooldown_ends_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Results Section */}
            {result && (
              <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    Credit Score Results
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Score Display */}
                  <div className="text-center">
                    <CreditScoreCircle 
                      score={result.score} 
                      size="xl" 
                      showLabels={true}
                      className="mb-6"
                    />
                    
                    <Badge className={`${getRiskBadgeColor(result.risk_level)} px-4 py-2 text-sm font-medium`}>
                      {result.risk_level} Risk
                    </Badge>
                  </div>

                  {/* Metrics Breakdown */}
                  {result.metrics && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold text-white">Score Breakdown</h3>
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                            <span className="text-sm text-white/70">Wallet Age</span>
                            <span className="text-sm font-medium text-white">{result.metrics.wallet_age_days} days</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                            <span className="text-sm text-white/70">Transaction Count</span>
                            <span className="text-sm font-medium text-white">{result.metrics.transaction_count.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                            <span className="text-sm text-white/70">Total Volume</span>
                            <span className="text-sm font-medium text-white">${result.metrics.total_volume_usd.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                            <span className="text-sm text-white/70">Unique Protocols</span>
                            <span className="text-sm font-medium text-white">{result.metrics.unique_protocols}</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                            <span className="text-sm text-white/70">DeFi Positions</span>
                            <span className="text-sm font-medium text-white">{result.metrics.defi_positions}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                            <span className="text-sm text-white/70">NFT Count</span>
                            <span className="text-sm font-medium text-white">{result.metrics.nft_count}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                            <span className="text-sm text-white/70">Failed Transactions</span>
                            <span className="text-sm font-medium text-white">{result.metrics.failed_txs}</span>
                          </div>
                          <div className="flex justify-between items-center p-3 rounded-lg bg-white/5">
                            <span className="text-sm text-white/70">SOL Balance</span>
                            <span className="text-sm font-medium text-white">{(result.metrics.sol_balance / 1e9).toFixed(2)} SOL</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Transaction Info */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-white">Transaction Details</h3>
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-sm text-white/70">Transaction Signature:</p>
                      <p className="text-xs text-white/50 font-mono break-all">{result.transaction_signature}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/5">
                      <p className="text-sm text-white/70">Computation Offset:</p>
                      <p className="text-sm text-white">{result.computation_offset}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info Section */}
            <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  How It Works
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm text-white/70">
                  <p>
                    Our credit score algorithm analyzes your Solana wallet's on-chain activity to generate a comprehensive credit score ranging from 300 to 850.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <h4 className="text-white font-medium mb-2">Factors Considered:</h4>
                      <ul className="space-y-1 text-xs">
                        <li>• Wallet age and activity history</li>
                        <li>• Transaction volume and frequency</li>
                        <li>• DeFi protocol interactions</li>
                        <li>• NFT holdings and trading</li>
                        <li>• Failed transaction rate</li>
                        <li>• SOL balance stability</li>
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-white font-medium mb-2">Score Ranges:</h4>
                      <ul className="space-y-1 text-xs">
                        <li>• <span className="text-green-400">750-850:</span> Excellent</li>
                        <li>• <span className="text-yellow-400">650-749:</span> Good</li>
                        <li>• <span className="text-orange-400">550-649:</span> Fair</li>
                        <li>• <span className="text-red-400">300-549:</span> Poor</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
    </WalletAuthGuard>
  )
}
