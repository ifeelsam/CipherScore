"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type NavItemProps = {
  href: string
  label: string
  icon: LucideIcon
  collapsed?: boolean
  badge?: React.ReactNode
}

export function NavItem({ href, label, icon: Icon, collapsed, badge }: NavItemProps) {
  const pathname = usePathname()
  const active = pathname === href

  return (
    <li>
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "group relative flex items-center rounded-xl transition",
          collapsed ? "w-full justify-center px-0 py-2" : "px-3 py-2 gap-3",
          "text-white/70 hover:text-white",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0",
          // ring uses accent teal
          "focus-visible:ring-[#00FFFF]/60",
          active
            ? "bg-white/5 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_0_20px_rgba(138,43,226,0.3)]"
            : "hover:bg-white/5",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0 transition-colors",
            active ? "text-[#8A2BE2]" : "text-white/70 group-hover:text-white",
          )}
          aria-hidden="true"
        />
        <span
          className={cn(
            "text-sm transition-opacity",
            collapsed ? "sr-only" : "opacity-100",
          )}
        >
          {label}
        </span>

        {/* Optional badge (e.g., low credits dot) */}
        {badge ? <span className={cn("ml-auto", collapsed && "hidden")}>{badge}</span> : null}
      </Link>
    </li>
  )
}
