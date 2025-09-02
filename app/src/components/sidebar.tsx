"use client"

import { useState } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Home, BarChart3, CreditCard, BookOpen, Settings, LogOut } from "lucide-react"
import { NavItem } from "./nav-item"
import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { connected, publicKey, disconnect } = useWallet()

  return (
    <aside
      aria-label="Primary"
      className={cn(
        "relative flex h-dvh flex-col border-r border-white/10 transition-[width]",
        collapsed ? "w-[72px]" : "w-[240px]",
      )}
      style={{
        // Theme palette (5 colors total)
        // Background, Card Surface, Text, Primary Purple, Accent Teal
        // Using inline style to ensure strict palette without global overrides
        backgroundColor: "#121212",
        color: "#FFFFFF",
      }}
    >
      {/* Top: Logo and collapse toggle */}
      <div className="flex items-center justify-between px-3 py-3">
        <Link
          href="/"
          className={cn(
            "group flex items-center gap-2 rounded-lg px-2 py-1 transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]/60",
          )}
        >
          {/* Logo placeholder */}
          <div aria-hidden="true" className="h-6 w-6 rounded-md" style={{ background: "#8A2BE2" }} />
          <span
            className={cn(
              "text-sm font-medium text-white/90 transition-opacity",
              collapsed ? "opacity-0 pointer-events-none select-none" : "opacity-100",
            )}
          >
            CipherScore
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="rounded-lg p-2 text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]/60"
        >
          <div
            className={cn("h-4 w-4 transition", collapsed ? "rotate-180" : "rotate-0")}
            // Simple chevron-like shape using CSS borders to avoid extra icons
            style={{
              borderTop: "2px solid #FFFFFFB3",
              borderRight: "2px solid #FFFFFFB3",
              transform: collapsed ? "rotate(-135deg)" : "rotate(45deg)",
              marginLeft: "2px",
            }}
            aria-hidden="true"
          />
        </button>
      </div>

      {/* Nav */}
      <nav className="mt-2 px-2">
        <ul className="space-y-1">
          <NavItem href="/" label="Dashboard" icon={Home} collapsed={collapsed} />
          {/* Example "low credits" indicator dot (kept within palette: use purple) */}
          <NavItem
            href="/usage"
            label="Usage"
            icon={BarChart3}
            collapsed={collapsed}
            badge={
              <span
                aria-label="Low credits"
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: "#8A2BE2" }}
              />
            }
          />
          <NavItem href="/subscription" label="Subscription" icon={CreditCard} collapsed={collapsed} />
          <NavItem href="/docs" label="API Docs" icon={BookOpen} collapsed={collapsed} />
          <NavItem href="/settings" label="Settings" icon={Settings} collapsed={collapsed} />
        </ul>
      </nav>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom: user and wallet connect/disconnect */}
      <div className="border-t border-white/10 px-3 py-3">
        <Link
          href="/account"
          className={cn(
            "flex items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]/60",
          )}
        >
          <Avatar className="h-8 w-8 ring-1 ring-white/10">
            <AvatarImage src="/developer-avatar-placeholder.png" alt="" />
            <AvatarFallback className="bg-white/10 text-white">DV</AvatarFallback>
          </Avatar>
          <div
            className={cn(
              "min-w-0 transition-opacity",
              collapsed ? "opacity-0 pointer-events-none select-none" : "opacity-100",
            )}
          >
            <p className="truncate text-sm font-medium text-white/90">Developer Name</p>
            <p className="truncate text-xs text-white/60">{connected && publicKey ? `${publicKey.toBase58().slice(0, 8)}...${publicKey.toBase58().slice(-4)}` : "Not connected"}</p>
          </div>
        </Link>

        {/* Wallet control replaces Logout */}
        {connected ? (
          <button
            onClick={() => disconnect()}
            className="mt-2 inline-flex w-full items-center justify-center rounded-full px-3 py-2 text-sm font-medium transition"
            style={{
              color: "#00FFFF",
              border: "1px solid #00FFFF80",
              background: "transparent",
            }}
          >
            <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
            <span className={cn(collapsed ? "sr-only" : "")}>Disconnect Wallet</span>
          </button>
        ) : (
          <WalletMultiButton
            className={cn(
              "mt-2 !w-full !justify-center !rounded-full !px-3 !py-2 !text-sm !font-medium !transition",
              "!bg-[#8A2BE2] !text-white !shadow-md hover:!shadow-[0_0_24px_rgba(138,43,226,0.4)] !border-none",
            )}
          />
        )}
      </div>

      {/* Glow edges for a subtle neon vibe on interactive elements */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-none"
        style={{
          boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.04), 0 0 40px rgba(138,43,226,0.07)",
        }}
      />
    </aside>
  )
}
