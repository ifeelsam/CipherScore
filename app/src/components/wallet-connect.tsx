'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { Button } from './ui/button'

export function WalletConnect() {
  const { connected, publicKey } = useWallet()

  if (connected && publicKey) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-sm text-white/70">
          Connected: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-4)}
        </div>
        <WalletMultiButton 
          className="!bg-[#8A2BE2] !rounded-full !px-4 !py-2 !text-sm !font-medium !text-white !shadow-md !transition hover:!shadow-[0_0_24px_rgba(138,43,226,0.4)] !border-none"
        />
      </div>
    )
  }

  return (
    <WalletMultiButton 
      className="!bg-[#8A2BE2] !rounded-full !px-4 !py-2 !text-sm !font-medium !text-white !shadow-md !transition hover:!shadow-[0_0_24px_rgba(138,43,226,0.4)] !border-none"
    />
  )
}