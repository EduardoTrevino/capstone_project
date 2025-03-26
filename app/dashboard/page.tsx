"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  IndianRupee,
  Gamepad2,
  TrendingUp,
  Settings,
  ArrowLeft,
  HelpCircle,
} from "lucide-react"
import { OnboardingTour } from "@/components/onboarding-tour"

export default function Dashboard() {
  const [username, setUsername] = useState("")
  const [currentPage, setCurrentPage] = useState<"business" | "game" | "personal">("business")
  const [showTour, setShowTour] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const storedUsername = localStorage.getItem("username")
    if (storedUsername) {
      setUsername(storedUsername)
    } else {
      router.push("/")
    }

    const hasSeenTour = localStorage.getItem("hasSeenTour")
    if (hasSeenTour) {
      setShowTour(false)
    } else {
      setShowTour(true)
    }
  }, [router])

  const handleFinishTour = () => {
    setShowTour(false)
    localStorage.setItem("hasSeenTour", "true")
  }

  // If user navigates away from 'business'
  if (currentPage == "personal") {
    // Example fallback screen; you can style these pages as you wish.
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#1F105C]">
        <Button
          variant="outline"
          onClick={() => setCurrentPage("business")}
          className="absolute top-4 left-4 bg-white text-[#1F105C]"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="text-white font-bold text-lg">
          {currentPage.toUpperCase()} PAGE
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Business Page Content
  // ---------------------------------------------------------------------------
  return (
    <main className="min-h-screen bg-[#fff8d3] overflow-x-hidden flex flex-col">
      {/* MAIN WRAPPER */}
      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-20">
        <div className="max-w-5xl mx-auto pt-6">
          <div id="revenue">
          {/* Top row: Title, Help bubble, Settings */}
          <div  className="flex items-center justify-between">
            <h2  className="text-[#0d0d0d] text-[22px] font-semibold">
              Revenue &amp; Profit
            </h2>

            <div className="flex items-center gap-4">
              {/* Small “help” bubble */}
              <div className="w-[22px] h-[22px] bg-[#fff8d3] rounded-full flex items-center justify-center">
                <HelpCircle className="w-[18px] h-[18px] text-[#0d0d0d]" />
              </div>

              <Settings className="w-6 h-6 text-[#0d0d0d]" />
            </div>
          </div>

          {/* TOTAL CARD */}
          <Card className="mt-4 w-full max-w-[343px] bg-[#b1c854] rounded-2xl border-none">
            <CardContent className="p-5">
              <p className="text-white text-[17px] font-normal">Total</p>
              <p className="text-white text-[28px] font-black mt-1">
                ₹0.00
              </p>
            </CardContent>
          </Card>
          </div>
          {/* Workforce Management */}
          <div id="workforce" className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[#0d0d0d] text-[22px] font-semibold">
                Workforce Management
              </h2>
              <div className="w-[22px] h-[22px] bg-[#fff8d3] rounded-full flex items-center justify-center">
                <HelpCircle className="w-[18px] h-[18px] text-[#0d0d0d]" />
              </div>
            </div>

            {/* Workforce Cards (horizontal scroller) */}
            {/* I updated the w-32 h-[151px] and the bg-fff8d3 from bg-cover*/}
            <div className="flex gap-3 mt-3 overflow-x-auto pb-2 scrollbar-hide">
              {[1, 2, 3].map((i) => (
                <Card
                  key={i}
                  className="flex-shrink-0 w-32 h-[151px] bg-[url('/vector-2.svg')] bg-fff8d3 border-none"
                >
                  <CardContent className="p-0 relative h-full">
                    {/* Example “goto” bubble in top-right if you want it, note the number of arrows is 1+ # of workforce employees? */}
                    {i < 4 && (
                      <div className="absolute w-[23px] h-[23px] top-[7px] right-[7px] bg-[#1f105c] rounded-full flex items-center justify-center">
                        <img
                          className="w-[8px] h-[8px]"
                          alt="Vector"
                          src="/vector.svg"
                        />
                      </div>
                    )}
                    {/* “Avatar” placeholder */}
                    <div className="absolute w-[29px] h-[29px] top-[19px] left-6 bg-white rounded-full" />
                    <div className="absolute top-[55px] left-6 text-black text-[9px] font-semibold">
                      Nik
                    </div>
                    <div className="absolute top-[68px] left-6 text-[#faf6f5] text-[9px]">
                      Financial Advisor
                    </div>
                    <div className="absolute top-[117px] left-6 text-black text-[9px]">
                      Source
                    </div>
                    <div
                      className="absolute w-[49px] h-[15px] top-[134px] left-6 bg-[#fff8d3]
                                 rounded-full border border-white text-[9px]
                                 flex items-center justify-center text-[#0d0d0d]"
                    >
                      LinkedIn
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Customer Satisfaction */}
          <div id="satisfaction" className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[#0d0d0d] text-[22px] font-semibold">
                Customer Satisfaction
              </h2>
              <div className="w-[22px] h-[22px] bg-[#fff8d3] rounded-full flex items-center justify-center">
                <HelpCircle className="w-[18px] h-[18px] text-[#0d0d0d]" />
              </div>
            </div>

            {/* Chart placeholder */}
            <Card className="mt-3 bg-white rounded-xl border-none">
              <CardContent className="p-4">
                {/* Chart Header */}
                <div className="flex justify-between items-center mb-2">
                  <div className="text-[10px] font-bold text-black">Data</div>
                  <div className="text-[9px] text-[#00000080]">MORE</div>
                </div>
                {/* Image placeholder (fake chart) */}
                <div className="relative h-[150px] w-full">
                  <Image
                    src="/placeholder.svg?height=150&width=350"
                    alt="Customer Satisfaction Graph"
                    fill
                    style={{ objectFit: "contain" }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Reputation & Quality of Service */}
          <div id="reputation" className="mt-8 pb-8">
            <div className="flex items-center justify-between">
              <h2  className="text-[#0d0d0d] text-[22px] font-semibold">
                Reputation &amp; Quality of Service
              </h2>
              <div className="w-[22px] h-[22px] bg-[#fff8d3] rounded-full flex items-center justify-center">
                <HelpCircle className="w-[18px] h-[18px] text-[#0d0d0d]" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="relative h-[75px] bg-[#82b266] rounded-t-[32px] flex items-center justify-around px-6">
          {/* Business Tab */}
          <button
            onClick={() => setCurrentPage("business")}
            className={`
              flex flex-col items-center gap-1 pt-2
              ${currentPage === "business" ? "text-[#1f105c]" : "text-white"}
            `}
          >
            <IndianRupee className="w-5 h-5" />
            <span className="text-xs">Business</span>
          </button>

          {/* Center “Game” Button (no hover animation) */}
          <div className="relative -top-8">
            <button
              onClick={() => router.push("/dashboard/game")}
              className="
                w-32 h-32 bg-[#d7eaac] rounded-full
                border-8 border-white
                flex items-center justify-center
                text-[#82b266]
              "
            >
              <Gamepad2 className="w-12 h-12" />
              {/* Hide label for a11y if you only want the icon visible */}
              <span className="sr-only">Game</span>
            </button>
          </div>

          {/* Personal Tab */}
          <button
            onClick={() => setCurrentPage("personal")}
            className="flex flex-col items-center gap-1 pt-2 text-white"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs">Personal</span>
          </button>
        </div>
      </div>

      {showTour && <OnboardingTour onFinish={handleFinishTour} />}
    </main>
  )
}
