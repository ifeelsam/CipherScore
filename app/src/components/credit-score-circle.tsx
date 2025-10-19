"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface CreditScoreCircleProps {
  score: number
  isLoading?: boolean
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeConfig = {
  sm: { size: 120, strokeWidth: 6, fontSize: "text-lg", labelSize: "text-xs" },
  md: { size: 160, strokeWidth: 8, fontSize: "text-2xl", labelSize: "text-sm" },
  lg: { size: 200, strokeWidth: 10, fontSize: "text-3xl", labelSize: "text-base" },
  xl: { size: 240, strokeWidth: 12, fontSize: "text-4xl", labelSize: "text-lg" }
}

export function CreditScoreCircle({ 
  score, 
  isLoading = false, 
  size = "lg", 
  className 
}: CreditScoreCircleProps) {
  const [animatedScore, setAnimatedScore] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  
  const config = sizeConfig[size]
  const radius = (config.size - config.strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  
  // Score ranges and colors (similar to CIBIL/Experian)
  const getScoreRange = (score: number) => {
    if (score >= 750) return { range: "Excellent", color: "#10B981", bgColor: "bg-green-500/10", textColor: "text-green-400" }
    if (score >= 700) return { range: "Very Good", color: "#34D399", bgColor: "bg-green-400/10", textColor: "text-green-300" }
    if (score >= 650) return { range: "Good", color: "#FBBF24", bgColor: "bg-yellow-500/10", textColor: "text-yellow-400" }
    if (score >= 600) return { range: "Fair", color: "#F59E0B", bgColor: "bg-orange-500/10", textColor: "text-orange-400" }
    if (score >= 550) return { range: "Poor", color: "#EF4444", bgColor: "bg-red-500/10", textColor: "text-red-400" }
    return { range: "Very Poor", color: "#DC2626", bgColor: "bg-red-600/10", textColor: "text-red-500" }
  }
  
  const scoreRange = getScoreRange(score)
  const percentage = Math.min(100, Math.max(0, (score / 850) * 100))
  const animatedPercentage = Math.min(100, Math.max(0, (animatedScore / 850) * 100))
  const strokeDashoffset = circumference - (animatedPercentage / 100) * circumference
  
  // Animate score on load
  useEffect(() => {
    if (isLoading) {
      setAnimatedScore(0)
      setIsAnimating(false)
      return
    }
    
    setIsAnimating(true)
    const duration = 2000 // 2 seconds
    const steps = 60
    const stepDuration = duration / steps
    const scoreStep = score / steps
    
    let currentStep = 0
    const interval = setInterval(() => {
      currentStep++
      setAnimatedScore(Math.min(score, scoreStep * currentStep))
      
      if (currentStep >= steps) {
        clearInterval(interval)
        setIsAnimating(false)
      }
    }, stepDuration)
    
    return () => clearInterval(interval)
  }, [score, isLoading])
  
  if (isLoading) {
    return (
      <div className={cn("relative flex items-center justify-center", className)}>
        <div className="relative" style={{ width: config.size, height: config.size }}>
          {/* Background circle */}
          <svg 
            className="w-full h-full transform -rotate-90" 
            viewBox={`0 0 ${config.size} ${config.size}`}
          >
            <circle
              cx={config.size / 2}
              cy={config.size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={config.strokeWidth}
            />
            {/* Animated loading circle - fill and unfill */}
            <circle
              cx={config.size / 2}
              cy={config.size / 2}
              r={radius}
              fill="none"
              stroke="url(#loadingGradient)"
              strokeWidth={config.strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={circumference}
              strokeLinecap="round"
              style={{
                animation: 'fillUnfill 2s ease-in-out infinite'
              }}
            />
            <defs>
              <linearGradient id="loadingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#8A2BE2" />
                <stop offset="50%" stopColor="#00FFFF" />
                <stop offset="100%" stopColor="#8A2BE2" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Loading text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="animate-pulse">
              <div className={cn("text-white/60", config.labelSize)}>Calculating...</div>
            </div>
          </div>
          
          {/* Add keyframe animation */}
          <style jsx>{`
            @keyframes fillUnfill {
              0% {
                stroke-dashoffset: ${circumference};
              }
              50% {
                stroke-dashoffset: 0;
              }
              100% {
                stroke-dashoffset: ${circumference};
              }
            }
          `}</style>
        </div>
      </div>
    )
  }
  
  return (
    <div className={cn("relative flex items-center justify-center", className)}>
      <div className="relative" style={{ width: config.size, height: config.size }}>
        {/* Background circle */}
        <svg 
          className="w-full h-full transform -rotate-90" 
          viewBox={`0 0 ${config.size} ${config.size}`}
        >
          {/* Background track */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={config.strokeWidth}
          />
          
          {/* Main progress circle */}
          <circle
            cx={config.size / 2}
            cy={config.size / 2}
            r={radius}
            fill="none"
            stroke={scoreRange.color}
            strokeWidth={config.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className={cn(
              "transition-all duration-1000 ease-out"
            )}
            style={{
              filter: `drop-shadow(0 0 8px ${scoreRange.color}40)`
            }}
          />
        </svg>
        
        {/* Score display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className={cn("font-bold text-white transition-all duration-1000", config.fontSize)}>
            {Math.round(animatedScore)}
          </div>
          <div className={cn("text-white/60 transition-all duration-1000", config.labelSize)}>
            Credit Score
          </div>
          <div className={cn(
            "mt-2 px-3 py-1 rounded-full text-xs font-medium transition-all duration-1000",
            scoreRange.bgColor,
            scoreRange.textColor
          )}>
            {scoreRange.range}
          </div>
        </div>
      </div>
    </div>
  )
}
