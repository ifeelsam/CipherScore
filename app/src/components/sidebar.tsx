"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { Home, BarChart3, CreditCard, BookOpen, Settings, LogOut, Menu, X } from "lucide-react"
import { NavItem } from "./nav-item"
import { useWallet } from "@solana/wallet-adapter-react"
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui"
import { useIsMobile } from "@/hooks/use-mobile"

export function Sidebar() {
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem("cipher_sidebar_collapsed")
        return stored === "true"
      }
    } catch {}
    return false
  })
  const { connected, publicKey, disconnect } = useWallet()
  const [displayName, setDisplayName] = useState<string>("User")

  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? window.localStorage.getItem("cipher_session") : null
      if (!stored) return
      const parsed = JSON.parse(stored) as { token: string; expiresAt: string; walletAddress: string }
      if (new Date(parsed.expiresAt).getTime() <= Date.now()) return
      const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000"
      fetch(`${baseUrl}/dashboard/profile`, { headers: { "X-Session-Token": parsed.token } })
        .then(r => r.json())
        .then(json => {
          if (json?.success) {
            setDisplayName(json.data?.name || "User")
          }
        })
        .catch(() => { })
    } catch { }
  }, [])

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cipher_sidebar_collapsed", collapsed ? "true" : "false")
      }
    } catch {}
  }, [collapsed])

  // Close mobile menu when clicking outside
  useEffect(() => {
    if (!isMobile || !mobileMenuOpen) return
    
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-sidebar]')) {
        setMobileMenuOpen(false)
      }
    }
    
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isMobile, mobileMenuOpen])

  // Mobile menu toggle button (only shown on mobile)
  if (isMobile && !mobileMenuOpen) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation()
          setMobileMenuOpen(true)
        }}
        className="fixed top-6 left-6 z-50 rounded-lg bg-[#1A1A1A] p-2 text-white shadow-lg border border-white/10"
        aria-label="Open menu"
      >
        <Menu className="h-6 w-6" />
      </button>
    )
  }

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <aside
        data-sidebar
        aria-label="Primary"
        className={cn(
          "flex h-dvh flex-col border-r border-white/10 transition-all",
          isMobile 
            ? "fixed top-0 left-0 z-50 w-[280px]" 
            : cn("sticky top-0 transition-[width]", collapsed ? "w-[72px]" : "w-[240px]")
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
      <div className={cn("relative flex items-center py-3", isMobile ? "px-3 justify-between" : (collapsed ? "px-1" : "px-3 justify-between"))}> 
        <Link
          href="/"
          className={cn(
            "group flex items-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]/60",
            isMobile ? "gap-2 px-2 py-1 hover:bg-white/5" : (collapsed ? "w-full justify-center gap-0 px-0 py-1" : "gap-2 px-2 py-1 hover:bg-white/5"),
          )}
          onClick={() => isMobile && setMobileMenuOpen(false)}
        >
          {/* Logo */}
          <img src="/favicon.png" alt="CipherScore Logo" className="h-6 w-6 rounded-md" />
          <span
            className={cn(
              "text-sm font-medium text-white/90 transition-opacity",
              isMobile ? "opacity-100" : (collapsed ? "sr-only" : "opacity-100"),
            )}
          >
            CipherScore
          </span>
        </Link>

        {isMobile ? (
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
            className="rounded-lg p-2 text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]/60"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "rounded-lg text-white/70 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FFFF]/60",
              collapsed ? "absolute right-1 top-1/2 -translate-y-1/2 p-1" : "p-2",
            )}
          >
            <div
              className={cn("transition", collapsed ? "h-3 w-3 rotate-180" : "h-4 w-4 rotate-0")}
              style={{
                borderTop: "2px solid #FFFFFFB3",
                borderRight: "2px solid #FFFFFFB3",
                transform: collapsed ? "rotate(-135deg)" : "rotate(45deg)",
              }}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="mt-2 px-2">
        <ul className="space-y-1">
          <div onClick={() => isMobile && setMobileMenuOpen(false)}>
            <NavItem href="/" label="Dashboard" icon={Home} collapsed={!isMobile && collapsed} />
          </div>
          <div onClick={() => isMobile && setMobileMenuOpen(false)}>
            <NavItem href="/usage" label="Usage" icon={BarChart3} collapsed={!isMobile && collapsed} />
          </div>
          <div onClick={() => isMobile && setMobileMenuOpen(false)}>
            <NavItem href="/subscription" label="Subscription" icon={CreditCard} collapsed={!isMobile && collapsed} />
          </div>
          <div onClick={() => isMobile && setMobileMenuOpen(false)}>
            <NavItem href="/docs" label="API Docs" icon={BookOpen} collapsed={!isMobile && collapsed} />
          </div>
          <div onClick={() => isMobile && setMobileMenuOpen(false)}>
            <NavItem href="/settings" label="Settings" icon={Settings} collapsed={!isMobile && collapsed} />
          </div>
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
          onClick={() => isMobile && setMobileMenuOpen(false)}
        >
          <Avatar className="h-8 w-8 ring-1 ring-white/10">
            <AvatarImage src={`https://api.dicebear.com/9.x/glass/svg?seed=${publicKey ? publicKey.toBase58() : 'user'}`} alt="" />
          </Avatar>
          <div
            className={cn(
              "min-w-0 transition-opacity",
              isMobile ? "opacity-100" : (collapsed ? "opacity-0 pointer-events-none select-none" : "opacity-100"),
            )}
          >
            <p className="truncate text-sm font-medium text-white/90">{displayName}</p>
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
            <span className={cn(isMobile ? "" : (collapsed ? "sr-only" : ""))}>Disconnect Wallet</span>
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
    </>
  )
}
