"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { motion, AnimatePresence } from "framer-motion"

interface OnboardingTourProps {
  onFinish: () => void
}

export function OnboardingTour({ onFinish }: OnboardingTourProps) {
  const [step, setStep] = useState(0)
  const [spotlightPosition, setSpotlightPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  })
  const [tooltipPosition, setTooltipPosition] = useState({
    top: 0,
    left: 0,
  })
  const tooltipRef = useRef<HTMLDivElement>(null)

  const tourSteps = [
    {
      target: "#revenue",
      content:
        "Here in the Business section, you can track your money matters—Revenue & Profit—to see how well your drone-leasing model is performing.",
    },
    {
      target: "#workforce",
      content:
        "You'll also keep an eye on Workforce Management. Make sure your team is well-trained and happy, so your service runs smoothly.",
    },
    {
      target: "#satisfaction",
      content:
        "Next, check Customer Satisfaction graphs. Satisfied farmers mean repeat customers and great word-of-mouth!",
    },
    // {
    //   target: "#reputation",
    //   content:
    //     "Finally, there's Quality of Service—your business's face in the community. High reputation makes you trusted and sought after!",
    // },
  ]

  // Memoize the update function to prevent recreation on each render
  const updatePositions = useCallback(() => {
    const targetElement = document.querySelector(tourSteps[step].target) as HTMLElement
    if (!targetElement) return
  
    const rect = targetElement.getBoundingClientRect()
  
    const padding = 10
    const newSpotlightPosition = {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    }
  
    // Check if any position actually changed before setting state
    setSpotlightPosition(prev => {
      if (
        Math.abs(prev.top - newSpotlightPosition.top) < 1 &&
        Math.abs(prev.left - newSpotlightPosition.left) < 1 &&
        Math.abs(prev.width - newSpotlightPosition.width) < 1 &&
        Math.abs(prev.height - newSpotlightPosition.height) < 1
      ) {
        return prev
      }
      return newSpotlightPosition
    })
  
    const tooltipHeight = tooltipRef.current?.offsetHeight || 200
    let tooltipTop = rect.top + rect.height + padding + 20
  
    if (tooltipTop + tooltipHeight > window.innerHeight - 100) {
      tooltipTop = Math.max(20, rect.top - tooltipHeight - 20)
    }
  
    setTooltipPosition(prev => {
      const newTooltipPosition = {
        top: tooltipTop,
        left: Math.max(20, rect.left + rect.width / 2 - 150),
      }
      if (
        Math.abs(prev.top - newTooltipPosition.top) < 1 &&
        Math.abs(prev.left - newTooltipPosition.left) < 1
      ) {
        return prev
      }
      return newTooltipPosition
    })
  
    targetElement.scrollIntoView({ behavior: "smooth", block: "center" })
  }, [step, tourSteps])
  
  // Run once when step changes
  useEffect(() => {
    updatePositions()

    // Update positions on window resize
    window.addEventListener("resize", updatePositions)
    return () => window.removeEventListener("resize", updatePositions)
  }, [step, updatePositions])

  const handleNext = () => {
    if (step < tourSteps.length - 1) {
      setStep(step + 1)
    } else {
      onFinish()
    }
  }

  const currentStep = tourSteps[step]

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      {/* Semi-transparent overlay */}
      <div className="absolute inset-0 bg-black/70 pointer-events-auto" />

      {/* Spotlight "hole" */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute rounded-lg pointer-events-auto"
        style={{
          top: spotlightPosition.top,
          left: spotlightPosition.left,
          width: spotlightPosition.width,
          height: spotlightPosition.height,
          boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
          transition: "all 0.3s ease",
        }}
      />

      {/* Tooltip */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          ref={tooltipRef}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="absolute pointer-events-auto"
          style={{
            top: tooltipPosition.top,
            left: tooltipPosition.left,
            width: "300px",
            maxWidth: "calc(100vw - 40px)",
          }}
        >
          <Card className="shadow-lg border-green-500 border-2">
            <CardContent className="pt-6">
              <p className="text-sm text-gray-600 mb-2">
                Step {step + 1} of {tourSteps.length}
              </p>
              <p>{currentStep.content}</p>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="outline" onClick={onFinish} size="sm">
                Skip
              </Button>
              <Button onClick={handleNext} size="sm">
                {step < tourSteps.length - 1 ? "Next" : "Finish"}
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

