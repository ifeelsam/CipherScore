"use client"

import { useRef } from "react"
import { motion } from "framer-motion"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Wallet, Shield, Cpu, Award } from "lucide-react"

gsap.registerPlugin(ScrollTrigger)

export function HowItWorks() {
  const container = useRef(null)

  useGSAP(
    () => {
      const steps = gsap.utils.toArray(".step-card")
      const connectors = gsap.utils.toArray(".step-connector")

      steps.forEach((step: any, i) => {
        gsap.fromTo(
          step,
          { scale: 0.8, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.6,
            delay: i * 0.3,
            ease: "back.out(1.7)",
            scrollTrigger: {
              trigger: step,
              start: "top 80%",
              end: "bottom 20%",
              toggleActions: "play none none reverse",
            },
          },
        )
      })

      connectors.forEach((connector: any, i) => {
        gsap.fromTo(
          connector,
          { scaleX: 0 },
          {
            scaleX: 1,
            duration: 0.8,
            delay: (i + 1) * 0.3,
            ease: "power2.out",
            scrollTrigger: {
              trigger: connector,
              start: "top 80%",
              end: "bottom 20%",
              toggleActions: "play none none reverse",
            },
          },
        )
      })
    },
    { scope: container },
  )

  const steps = [
    {
      icon: Wallet,
      title: "Connect Wallet & Consent",
      description: "User connects their Web3 wallet and provides consent for privacy-preserving analysis.",
      color: "from-blue-500 to-cyan-600",
    },
    {
      icon: Shield,
      title: "Client-side Encryption",
      description: "Financial data is encrypted locally using advanced cryptographic protocols.",
      color: "from-emerald-500 to-teal-600",
    },
    {
      icon: Cpu,
      title: "Arcium MPC Compute",
      description: "Multi-party computation processes encrypted data without ever decrypting it.",
      color: "from-purple-500 to-indigo-600",
    },
    {
      icon: Award,
      title: "Receive Score via API",
      description: "Your application receives the computed credit score through our secure API.",
      color: "from-orange-500 to-red-600",
    },
  ]

  return (
    <section ref={container} id="how-it-works" className="py-20 px-4 bg-black/10">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">How CipherScore Works</h2>
          <p className="text-xl text-neutral-300 max-w-3xl mx-auto">
            A seamless four-step process that maintains complete privacy while delivering accurate credit scores.
          </p>
        </motion.div>

        <div className="relative">
          {/* Desktop Layout */}
          <div className="hidden lg:flex items-center justify-between">
            {steps.map((step, index) => (
              <div key={index} className="flex items-center">
                <div className="step-card flex flex-col items-center text-center max-w-xs">
                  <div
                    className={`w-20 h-20 bg-gradient-to-br ${step.color} rounded-2xl flex items-center justify-center mb-4 shadow-lg`}
                  >
                    <step.icon size={32} className="text-white" />
                  </div>
                  <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
                    <p className="text-neutral-300 text-sm leading-relaxed">{step.description}</p>
                  </div>
                </div>

                {index < steps.length - 1 && (
                  <div className="step-connector mx-8 flex-1 h-0.5 bg-gradient-to-r from-cyan-500 to-blue-600 origin-left" />
                )}
              </div>
            ))}
          </div>

          {/* Mobile Layout */}
          <div className="lg:hidden space-y-8">
            {steps.map((step, index) => (
              <div key={index} className="step-card">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-16 h-16 bg-gradient-to-br ${step.color} rounded-xl flex items-center justify-center flex-shrink-0`}
                  >
                    <step.icon size={24} className="text-white" />
                  </div>
                  <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-6 flex-1">
                    <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
                    <p className="text-neutral-300 leading-relaxed">{step.description}</p>
                  </div>
                </div>

                {index < steps.length - 1 && (
                  <div className="step-connector w-0.5 h-8 bg-gradient-to-b from-cyan-500 to-blue-600 ml-8 mt-4 origin-top" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
