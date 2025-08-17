"use client"

import { useRef } from "react"
import { motion } from "framer-motion"
import { useGSAP } from "@gsap/react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Shield, Zap, Lock, Globe } from "lucide-react"

gsap.registerPlugin(ScrollTrigger)

export function Features() {
  const container = useRef(null)

  useGSAP(
    () => {
      const cards = gsap.utils.toArray(".feature-card")

      cards.forEach((card: any, i) => {
        gsap.fromTo(
          card,
          { y: 100, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            delay: i * 0.2,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
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

  const features = [
    {
      icon: Shield,
      title: "Privacy-First Architecture",
      description: "Multi-party computation ensures your financial data never leaves your wallet in plaintext.",
      gradient: "from-emerald-500 to-teal-600",
    },
    {
      icon: Zap,
      title: "Lightning Fast Scoring",
      description: "Get credit scores in seconds with our optimized MPC protocols and edge computing.",
      gradient: "from-yellow-500 to-orange-600",
    },
    {
      icon: Lock,
      title: "Zero Knowledge Proofs",
      description: "Prove creditworthiness without revealing sensitive transaction history or balances.",
      gradient: "from-purple-500 to-indigo-600",
    },
    {
      icon: Globe,
      title: "Web3 Native Integration",
      description: "Built for DeFi protocols, DAOs, and Web3 applications with simple API integration.",
      gradient: "from-cyan-500 to-blue-600",
    },
  ]

  return (
    <section ref={container} id="features" className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Privacy-Preserving Credit Infrastructure</h2>
          <p className="text-xl text-neutral-300 max-w-3xl mx-auto">
            Revolutionary credit scoring that protects user privacy while enabling Web3 financial innovation.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              className="feature-card bg-black/20 backdrop-blur-md border border-white/10 rounded-2xl p-6 hover:bg-black/30 transition-all duration-300 group"
              whileHover={{ y: -5, transition: { type: "spring", stiffness: 300 } }}
            >
              <div
                className={`w-12 h-12 bg-gradient-to-br ${feature.gradient} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}
              >
                <feature.icon size={24} className="text-white" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
              <p className="text-neutral-300 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
