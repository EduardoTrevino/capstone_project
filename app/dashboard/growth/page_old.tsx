"use client"

import { CircularProgressbar, buildStyles } from "react-circular-progressbar"
import "react-circular-progressbar/dist/styles.css"
import { BarChart3, MessageSquare, CircleDot, IndianRupee, Gamepad2, TrendingUp } from "lucide-react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

// Custom CSS for better text centering in CircularProgressbar
const customStyles = `
  .CircularProgressbar-text {
    dominant-baseline: middle !important;
    text-anchor: middle !important;
  }
`

export default function PersonalGrowth() {
  const router = useRouter()

  // Add custom styles to the document
  useEffect(() => {
    const styleElement = document.createElement("style")
    styleElement.innerHTML = customStyles
    document.head.appendChild(styleElement)

    return () => {
      document.head.removeChild(styleElement)
    }
  }, [])

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-pink-400 text-white p-4 text-center">
        <h1 className="text-xl font-semibold">Personal Growth</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 space-y-6">
        {/* Ethical Decision-Making Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <CircleDot className="text-gray-700" size={20} />
            <h2 className="text-lg font-medium text-gray-800">
              Ethical Decision-Making
            </h2>
          </div>
          {/* ... replaced placeholder data ... */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Areas:</p>
              <p className="text-gray-800">Integrity &amp; Honesty</p>
              <p className="text-gray-800">Social Responsibility</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-gray-500">Rating:</p>
              <div className="w-16 h-16">
                <CircularProgressbar
                  value={80}
                  text={`80`}
                  styles={buildStyles({
                    textSize: "28px",
                    pathColor: "#d1d5db",
                    textColor: "#374151",
                    trailColor: "#f3f4f6",
                    strokeLinecap: "round",
                  })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Risk-Taking Ability Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <MessageSquare className="text-gray-700" size={20} />
            <h2 className="text-lg font-medium text-gray-800">
              Risk-Taking Ability
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Areas:</p>
              <p className="text-gray-800">Ventures</p>
              <p className="text-gray-800">Strategic Investments</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-gray-500">Rating:</p>
              <div className="w-16 h-16">
                <CircularProgressbar
                  value={66}
                  text={`66`}
                  styles={buildStyles({
                    textSize: "28px",
                    pathColor: "#d1d5db",
                    textColor: "#374151",
                    trailColor: "#f3f4f6",
                    strokeLinecap: "round",
                  })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Aspirational Index Section */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="text-gray-700" size={20} />
            <h2 className="text-lg font-medium text-gray-800">
              Aspirational Index
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Areas:</p>
              <p className="text-gray-800">Long-Term Goals</p>
              <p className="text-gray-800">Personal Development</p>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-gray-500">Rating:</p>
              <div className="w-16 h-16">
                <CircularProgressbar
                  value={72}
                  text={`72`}
                  styles={buildStyles({
                    textSize: "28px",
                    pathColor: "#d1d5db",
                    textColor: "#374151",
                    trailColor: "#f3f4f6",
                    strokeLinecap: "round",
                  })}
                />
              </div>
            </div>
          </div>

          {/* Large Circular Progress */}
          <div className="bg-green-100 p-6 rounded-lg flex justify-center items-center">
            <div className="w-24 h-24">
              <CircularProgressbar
                value={63}
                text={`63`}
                styles={buildStyles({
                  textSize: "28px",
                  pathColor: "#84cc16",
                  textColor: "#374151",
                  trailColor: "#f3f4f6",
                  strokeLinecap: "round",
                })}
              />
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Navigation (copied from dashboard/page.tsx, with 'Personal' highlighted) */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="relative h-[75px] bg-[#82b266] rounded-t-[32px] flex items-center justify-around px-6">
          {/* Business Tab */}
          <button
            onClick={() => router.push("/dashboard")}
            className="flex flex-col items-center gap-1 pt-2 text-white"
          >
            <IndianRupee className="w-5 h-5" />
            <span className="text-xs">Business</span>
          </button>

          {/* Center “Game” Button */}
          <div className="relative -top-8">
            <button
              onClick={() => router.push("/dashboard/game")}
              className="w-32 h-32 bg-[#d7eaac] rounded-full border-8 border-white flex items-center justify-center text-[#82b266]"
            >
              <Gamepad2 className="w-12 h-12" />
              <span className="sr-only">Game</span>
            </button>
          </div>

          {/* Personal Growth Tab (this page) */}
          <button
            onClick={() => router.push("/dashboard/growth")}
            className="flex flex-col items-center gap-1 pt-2 text-[#1f105c]"
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-xs">Personal</span>
          </button>
        </div>
      </div>
    </div>
  )
}
