'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { useEffect, useState } from 'react'

interface WalletAuthGuardProps {
  children: React.ReactNode
}

export function WalletAuthGuard({ children }: WalletAuthGuardProps) {
  const { connected, connecting } = useWallet()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ background: "#121212" }}>
        <div className="text-white">Loading...</div>
      </div>
    )
  }

  if (!connected && !connecting) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ background: "#121212" }}>
        <div className="mx-auto max-w-md space-y-8 p-6">
          <div className="text-center">
            <div className="mb-8">
              <div 
                className="mx-auto h-16 w-16 rounded-full flex items-center justify-center mb-6"
                style={{ 
                  background: "linear-gradient(45deg, #8A2BE2 0%, #00FFFF 100%)" 
                }}
              >
                <img src="/favicon.png" alt="CipherScore Icon" className="h-13 w-13" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
              <p className="text-white/70">
                Connect your Solana wallet to access the Cipher app
              </p>
            </div>
            
            <div className="space-y-4">
              <WalletMultiButton 
                className="!w-full !bg-[#8A2BE2] !rounded-2xl !px-6 !py-4 !text-base !font-medium !text-white !shadow-md !transition hover:!shadow-[0_0_24px_rgba(138,43,226,0.4)] !border-none !min-h-[48px]"
              />
              
              <div className="text-xs text-white/50 text-center">
                By connecting your wallet, you agree to our Terms of Service
              </div>
            </div>
          </div>
          
          {/* Features showcase */}
          <div className="space-y-4">
            <div 
              className="rounded-2xl p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ background: "#00FFFF20" }}
                >
                  <div className="h-3 w-3 rounded-full" style={{ background: "#00FFFF" }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Secure Authentication</p>
                  <p className="text-xs text-white/60">Your keys, your crypto</p>
                </div>
              </div>
            </div>
            
            <div 
              className="rounded-2xl p-4"
              style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-center gap-3">
                <div 
                  className="h-8 w-8 rounded-full flex items-center justify-center"
                  style={{ background: "#8A2BE220" }}
                >
                  <div className="h-3 w-3 rounded-full" style={{ background: "#8A2BE2" }} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Fast Transactions</p>
                  <p className="text-xs text-white/60">Lightning fast on Solana</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (connecting) {
    return (
      <div className="flex min-h-dvh items-center justify-center" style={{ background: "#121212" }}>
        <div className="text-center">
          <div 
            className="mx-auto h-12 w-12 rounded-full border-4 border-t-transparent animate-spin mb-4"
            style={{ borderColor: "#8A2BE2", borderTopColor: "transparent" }}
          />
          <div className="text-white">Connecting wallet...</div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}