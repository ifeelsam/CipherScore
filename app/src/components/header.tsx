"use client"

import { TransitionLink } from "./transition-link"
import { motion } from "framer-motion"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { useRef } from "react"
import { FileText, LogIn } from "lucide-react"

export function Header() {
  const headerRef = useRef(null)

  useGSAP(() => {
    gsap.from(headerRef.current, {
      y: -100,
      opacity: 0,
      duration: 1,
      ease: "power3.out",
      delay: 2,
    })
  }, [])

  return (
    <motion.header ref={headerRef} className="fixed top-0 left-0 right-0 z-50 p-4">
      <div className="container mx-auto flex justify-between items-center bg-black/20 backdrop-blur-md border border-white/10 p-4 rounded-full">
        <TransitionLink href="/" className="text-white font-bold text-xl flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">CS</span>
          </div>
          CipherScore
        </TransitionLink>

        <nav className="hidden md:flex items-center gap-6 text-white">
          <TransitionLink href="/#features" className="hover:text-cyan-400 transition-colors">
            Features
          </TransitionLink>
          <TransitionLink href="/#how-it-works" className="hover:text-cyan-400 transition-colors">
            How It Works
          </TransitionLink>
          <TransitionLink href="/#api" className="hover:text-cyan-400 transition-colors">
            API
          </TransitionLink>
          <TransitionLink href="/#use-cases" className="hover:text-cyan-400 transition-colors">
            Use Cases
          </TransitionLink>
        </nav>

        <div className="flex items-center gap-3">
          <TransitionLink href="/docs">
            <motion.button
              className="hidden sm:flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium py-2 px-4 rounded-full hover:bg-white/20 transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <FileText size={16} />
              Docs
            </motion.button>
          </TransitionLink>

          <TransitionLink href="/login">
            <motion.button
              className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-2 px-5 rounded-full hover:shadow-lg hover:shadow-cyan-500/25 transition-all duration-300"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <LogIn size={16} className="sm:hidden" />
              <span className="hidden sm:inline">Login</span>
            </motion.button>
          </TransitionLink>
        </div>
      </div>
    </motion.header>
  )
}
