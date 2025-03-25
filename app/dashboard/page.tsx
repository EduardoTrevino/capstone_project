"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { IndianRupee, Gamepad2, TrendingUp, Settings, ArrowLeft } from "lucide-react"
import { OnboardingTour } from "@/components/onboarding-tour"

export default function Dashboard() {
  const [username, setUsername] = useState("")
  const [currentPage, setCurrentPage] = useState("business")
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
    console.log("hasSeenTour value:", hasSeenTour);
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

  if (currentPage !== "business") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black">
        <Button variant="outline" onClick={() => setCurrentPage("business")} className="absolute top-4 left-4 bg-white">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>
    )
  }

  return (
    <main className="flex min-h-screen flex-col bg-white">
      <div className="flex justify-between items-center p-4 border-b">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <Button variant="ghost" size="icon">
          <Settings className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6">
        <section id="revenue" className="space-y-2">
          <h2 className="text-lg font-medium">Revenue & Profit</h2>
          <Card className="bg-gray-300">
            <CardContent className="p-4">
              <div className="text-sm">Total</div>
              <div className="text-2xl font-bold flex items-center">
                <IndianRupee className="h-5 w-5 mr-1" />
                20,560.00
              </div>
            </CardContent>
          </Card>
        </section>

        <section id="workforce" className="space-y-2">
          <h2 className="text-lg font-medium">Workforce Management</h2>
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="bg-gray-300">
                <CardContent className="p-3 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-gray-400 mb-2 flex items-center justify-center text-xs">
                    Nil
                  </div>
                  <div className="text-xs">Financial Advisor</div>
                  <div className="text-xs mt-2">Source:</div>
                  <div className="text-xs bg-gray-200 px-2 py-0.5 rounded">LinkedIn</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section id="satisfaction" className="space-y-2">
          <h2 className="text-lg font-medium">Customer Satisfaction</h2>
          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <div className="text-sm">Data</div>
                <div className="text-xs text-gray-500">MORE</div>
              </div>
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
        </section>

        <section id="reputation" className="space-y-2">
          <h2 className="text-lg font-medium">Reputation & Quality of Service</h2>
        </section>
      </div>

      <div className="border-t p-2">
        <div className="flex justify-around">
          <Button
            variant="ghost"
            className="flex flex-col items-center text-xs h-auto py-2 text-green-800"
            onClick={() => setCurrentPage("business")}
          >
            <IndianRupee className="h-5 w-5 mb-1" />
            Business
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center text-xs h-auto py-2"
            onClick={() => setCurrentPage("game")}
          >
            <Gamepad2 className="h-5 w-5 mb-1" />
            Game
          </Button>
          <Button
            variant="ghost"
            className="flex flex-col items-center text-xs h-auto py-2"
            onClick={() => setCurrentPage("personal")}
          >
            <TrendingUp className="h-5 w-5 mb-1" />
            Personal
          </Button>
        </div>
      </div>

      {showTour && <OnboardingTour onFinish={handleFinishTour} />}
    </main>
  )
}

