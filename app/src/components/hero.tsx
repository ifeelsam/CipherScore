"use client"

import { Suspense, useRef } from "react"
import { Canvas } from "@react-three/fiber"
import { motion } from "framer-motion"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { Scene } from "@/components/scene"
import { TransitionLink } from "@/components/transition-link"
import { FileText, LogIn, Shield, Lock, Zap } from "lucide-react"

export function Hero() {
  const container = useRef(null)

  useGSAP(
    () => {
      const tl = gsap.timeline()
      tl.fromTo(
        ".hero-title span",
        { y: 100, opacity: 0 },
        { y: 0, opacity: 1, stagger: 0.1, duration: 1, ease: "power3.out" },
      )
        .fromTo(
          ".hero-subtitle",
          { y: 50, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.8, ease: "power3.out" },
          "-=0.6",
        )
        .fromTo(
          ".hero-buttons",
          { scale: 0.8, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.8, ease: "elastic.out(1, 0.5)" },
          "-=0.5",
        )
        .fromTo(".trust-chips", { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: "power2.out" }, "-=0.3")
        .fromTo(
          ".holo-panel",
          { scale: 0.9, opacity: 0 },
          { scale: 1, opacity: 1, duration: 1, ease: "power3.out" },
          "-=0.4",
        )
    },
    { scope: container },
  )

  const title = "Encrypted Credit Scores for Web3 Builders"
  const splitTitle = title.split(" ").map((word, i) => (
    <span key={i} className="inline-block overflow-hidden">
      <span className="inline-block">{word}&nbsp;</span>
    </span>
  ))

  return (
    <div ref={container} className="relative w-full min-h-screen overflow-hidden">
      <div className="absolute inset-0 z-0">
        <Canvas>
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      <div className="absolute inset-0 z-5 bg-gradient-to-b from-black/20 via-transparent to-black/40" />

      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen text-white text-center px-4 py-20">
        <h1 className="hero-title font-bold text-4xl md:text-6xl lg:text-7xl mb-6 max-w-5xl leading-tight">
          {splitTitle}
        </h1>

        <motion.p
          className="hero-subtitle text-lg md:text-xl lg:text-2xl max-w-3xl mb-8 text-neutral-300"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
        >
          Compute privacy-first scores via MPC—no raw data ever leaves the wallet.
        </motion.p>

        <div className="hero-buttons flex flex-col sm:flex-row gap-4 mb-12">
          <TransitionLink href="/login">
            <motion.button
              className="flex items-center gap-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold py-4 px-8 rounded-full transition-all duration-300 hover:shadow-lg hover:shadow-cyan-500/25"
              whileHover={{ scale: 1.05, transition: { type: "spring", stiffness: 300 } }}
              whileTap={{ scale: 0.95 }}
            >
              <LogIn size={20} />
              Login
            </motion.button>
          </TransitionLink>

          <TransitionLink href="/docs">
            <motion.button
              className="flex items-center gap-3 bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold py-4 px-8 rounded-full transition-all duration-300 hover:bg-white/20 hover:shadow-lg hover:shadow-white/10"
              whileHover={{ scale: 1.05, transition: { type: "spring", stiffness: 300 } }}
              whileTap={{ scale: 0.95 }}
            >
              <FileText size={20} />
              Docs
            </motion.button>
          </TransitionLink>
        </div>

        <div className="trust-chips flex flex-wrap justify-center gap-3 mb-12">
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm border border-emerald-500/30 text-emerald-400 px-4 py-2 rounded-full text-sm">
            <Shield size={16} />
            Client-side encrypted
          </div>
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm border border-purple-500/30 text-purple-400 px-4 py-2 rounded-full text-sm">
            <Zap size={16} />
            Arcium MXE Powered
          </div>
          <div className="flex items-center gap-2 bg-black/30 backdrop-blur-sm border border-cyan-500/30 text-cyan-400 px-4 py-2 rounded-full text-sm">
            <Lock size={16} />
            Zero data exposure
          </div>
        </div>

        <div className="holo-panel bg-black/20 backdrop-blur-md border border-white/10 rounded-3xl p-8 max-w-4xl w-full">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="text-left">
              <div className="bg-black/40 backdrop-blur-sm border border-cyan-500/30 rounded-2xl p-6 font-mono text-sm">
                <div className="text-cyan-400 mb-2">// Privacy-first credit scoring</div>
                <div className="text-white">
                  <span className="text-purple-400">const</span> score = <span className="text-yellow-400">await</span>{" "}
                  <span className="text-cyan-400">cipherScore</span>.<span className="text-green-400">compute</span>(
                  {"{"}
                </div>
                <div className="text-white ml-4">
                  wallet: <span className="text-orange-400">"0x..."</span>,
                </div>
                <div className="text-white ml-4">
                  encrypted: <span className="text-green-400">true</span>
                </div>
                <div className="text-white">{"}"});</div>
              </div>
            </div>

            <div className="flex justify-center">
              <div className="relative w-48 h-48">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="url(#scoreGradient)"
                    strokeWidth="3"
                    strokeDasharray="283"
                    strokeDashoffset="85"
                    className="transition-all duration-2000"
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="100%" stopColor="#3b82f6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="text-4xl font-bold text-white">750</div>
                  <div className="text-sm text-neutral-400">Credit Score</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
