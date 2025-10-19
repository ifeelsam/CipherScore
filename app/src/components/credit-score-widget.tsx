"use client"

import { useState, useEffect, useMemo } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle, AlertCircle, TrendingUp, Wallet, Calculator } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import Link from "next/link"
import { CreditScoreCircle } from "@/components/credit-score-circle"

interface CreditScoreResponse {
  success: boolean
  data?: {
    wallet: string
    score: number
    risk_level: "LOW" | "MEDIUM" | "HIGH"
    transaction_signature: string
    computation_offset: number
  }
  error?: string
}

export function CreditScoreWidget() {
  const { publicKey, connected } = useWallet()
  const backendBaseUrl = useMemo(() => process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000", [])
  const defaultApiKey = process.env.NEXT_PUBLIC_CIPHERSCORE_API_KEY || "cypher_demo_key_12345"
  
  const [walletAddress, setWalletAddress] = useState("")
  const [isCalculating, setIsCalculating] = useState(false)
  const [result, setResult] = useState<CreditScoreResponse["data"] | null>(null)
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
    <Card style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}>
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Credit Score Calculator
          </div>
          <Link 
            href="/calculator"
            className="text-xs text-[#00FFFF] hover:text-[#00FFFF]/80 transition"
          >
            Full Calculator →
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isCalculating ? (
          <div className="text-center py-8">
            <CreditScoreCircle 
              score={0} 
              isLoading={true}
              size="md" 
              className="mb-4"
            />
            <p className="text-sm text-white/70">Analyzing wallet data...</p>
          </div>
        ) : !result ? (
          <>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="widget-wallet" className="text-white/80 text-sm">Wallet Address</Label>
                <Input
                  id="widget-wallet"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="Enter wallet address"
                  className="text-white placeholder:text-white/40 text-sm"
                />
                {connected && publicKey && (
                  <p className="text-xs text-white/60">
                    Connected: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-4)}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-2 text-xs">
                {defaultApiKey && defaultApiKey !== "cypher_demo_key_12345" ? (
                  <>
                    <CheckCircle className="h-3 w-3 text-green-400" />
                    <span className="text-green-400">API Key Ready</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-3 w-3 text-yellow-400" />
                    <span className="text-yellow-400">Using Demo Key</span>
                  </>
                )}
              </div>
            </div>

            <Button
              onClick={calculateCreditScore}
              disabled={isCalculating || !walletAddress.trim()}
              className="w-full bg-[#8A2BE2] hover:bg-[#8A2BE2]/90 text-white shadow-md transition hover:shadow-[0_0_24px_rgba(138,43,226,0.4)]"
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Calculate Score
            </Button>

            {error && (
              <div className="rounded-lg p-2 bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {/* Score Display */}
            <div className="text-center">
              <CreditScoreCircle 
                score={result.score} 
                size="md" 
                className="mb-3"
              />
              
              <Badge className={`${getRiskBadgeColor(result.risk_level)} px-3 py-1 text-xs font-medium`}>
                {result.risk_level} Risk
              </Badge>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => {
                  setResult(null)
                  setError("")
                }}
                variant="outline"
                className="flex-1 border-[#00FFFF]/30 text-[#00FFFF] hover:bg-[#00FFFF]/10 text-xs"
              >
                Calculate Another
              </Button>
              <Link href="/calculator">
                <Button
                  variant="outline"
                  className="flex-1 border-[#00FFFF]/30 text-[#00FFFF] hover:bg-[#00FFFF]/10 text-xs"
                >
                  View Details
                </Button>
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
