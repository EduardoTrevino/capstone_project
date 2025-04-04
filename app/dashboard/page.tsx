"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { OnboardingTour } from "@/components/onboarding-tour"
import { supabase } from "@/lib/supabase"
import { MyLineChart } from "@/components/ui/my-line-chart" // The ShadCN/Recharts line chart

export default function Dashboard() {
  const [username, setUsername] = useState("")
  const [currentPage, setCurrentPage] = useState<"business" | "game" | "personal">("business")
  const [showTour, setShowTour] = useState(false)

  // DB fields
  const [cash, setCash] = useState<number>(0)
  const [workforceManagement, setWorkforceManagement] = useState<number>(0)
  const [customerSatisfaction, setCustomerSatisfaction] = useState<number>(0)

  const router = useRouter()

  // On mount, load user & fetch data
  useEffect(() => {
    const storedUsername = localStorage.getItem("username")
    if (!storedUsername) {
      router.push("/")
      return
    }
    setUsername(storedUsername)
    fetchTourStatus(storedUsername)
    fetchUserData(storedUsername)
  }, [router])

  async function fetchUserData(name: string) {
    const { data, error } = await supabase
      .from("users")
      .select("cash, workforce_management_score, customer_satisfaction_score")
      .eq("name", name)
      .single()

    if (error) {
      console.error("Error fetching user data:", error.message)
      return
    }
    if (!data) return

    setCash(data.cash || 0)
    setWorkforceManagement(data.workforce_management_score || 0)
    setCustomerSatisfaction(data.customer_satisfaction_score || 0)
  }

  async function fetchTourStatus(name: string) {
    const { data, error } = await supabase
      .from("users")
      .select("dashboard_tour_done")
      .eq("name", name)
      .single()

    if (error) {
      console.error("Error fetching dashboard_tour_done:", error.message)
      return
    }
    if (!data) return

    setShowTour(!data.dashboard_tour_done)
  }

  const handleFinishTour = async () => {
    setShowTour(false)
    const { error } = await supabase
      .from("users")
      .update({ dashboard_tour_done: true })
      .eq("name", username)

    if (error) {
      console.error("Error marking tour done:", error.message)
    }
  }

  // Chart data: first week = user’s satisfaction, rest = 0
  const chartData = Array.from({ length: 7 }, (_, i) => {
    const val = (i === 0) ? customerSatisfaction : 0
    // If val is 0, set score to null so Recharts won't draw it
    return {
      week: i + 1,
      score: val === 0 ? null : val,
    }
  })

  return (
    <main
      className="min-h-screen w-full overflow-x-hidden overflow-y-auto relative flex flex-col"
      style={{
        backgroundImage: "url('/dashboard/background_dashboard.png')", // your background
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* ================= HEADER ================= */}
      <header className="p-4" id="revenue">
        {/* 
          1) revenue_and_profit.svg 
          - Adjust width/height as needed to make it bigger. 
          - For instance, w-[220px] h-auto or an inline style.
        */}
        <div className="mb-4" >
          <Image
            src="/dashboard/revenue_and_profit_tight.png"
            alt="Revenue & Profit"
            width={220}  // <--- Increase to 300, 400, etc. to make it bigger
            height={60}
          />
        </div>

        {/* ========== WIDE GREEN BEVELED CONTAINER ========== */}
        <div className="relative w-full max-w-[600px] bg-green-700 text-white px-4 py-3 
                        rounded-3xl border-b-4 border-r-4 border-green-900 shadow-lg">
          {/* 
            “Total” on one line and then the cash on the next line 
            with a larger bold style. 
          */}
          <p className="text-md mb-1 font-semibold">Total</p>
          <p className="text-2xl font-bold">₹{cash}</p>

          {/* ========== CHEST ICON (absolute) ========== */}
          <div
            className="absolute hover:scale-110 transition-transform"
            style={{
              top: "30%",    // <--- Move it up/down
              right: "10px", // <--- Move it left/right
              transform: "translateY(-50%)",
              width: "150px", // <--- Make the icon bigger or smaller
              height: "550px",
            }}
          >
            <Image
              src="/dashboard/chest_icon.svg"
              alt="Chest Icon"
              fill
              style={{ objectFit: "contain" }}
            />
          </div>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <div className="flex-1 px-4 pb-24">
        {/* ---------- WORKFORCE MANAGEMENT ---------- */}
        <section className="mb-6" id="workforce">
          <h2>
            <div className="mb-4">
            <Image
            src="/dashboard/workforce_mgmt.png"
            alt="Revenue & Profit"
            width={220}  // <--- Increase to 300, 400, etc. to make it bigger
            height={60}
            />
        </div>
          </h2>

          {workforceManagement <= 0 ? (
            // ========== “No Employees” YELLOW-WHITE CONTAINER ==========
            <div className="relative w-full max-w-[600px] 
                            bg-[rgba(255,255,224,0.7)] text-black px-4 py-3 
                            rounded-xl border-b-4 border-r-4 border-yellow-300 shadow-lg"
            >
              <p className="text-sm font-semibold">
                No Employees at the moment.
                <br />
                Hire employees to help you!
              </p>
            </div>
          ) : (
            // If we have employees, a scrollable row of robots
            <div className="flex gap-3 overflow-x-auto scrollbar-hide py-2">
              {Array.from({ length: workforceManagement }, (_, i) => (
                <div
                  key={i}
                  className="relative w-24 h-24 flex-shrink-0 hover:scale-105 transition-transform"
                >
                  <Image
                    src="/dashboard/robot.png"
                    alt="Robot Employee"
                    fill
                    style={{ objectFit: "contain" }}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ---------- CUSTOMER SATISFACTION ---------- */}
        <section id="satisfaction">
          <h2 >
            <div className="mb-4">
          <Image
            src="/dashboard/customer_sats.png"
            alt="Revenue & Profit"
            width={220}  // <--- Increase to 300, 400, etc. to make it bigger
            height={60}
          />
        </div>
          </h2>

          {/* ========== TRANSPARENT YELLOW-WHITE CONTAINER for the chart ========== */}
          <div
            className="relative w-full max-w-[600px] 
                       bg-[rgba(255,255,224,0.7)] px-4 py-3 
                       rounded-md border-b-4 border-r-4 border-yellow-300 shadow-lg"
          >
            {/* 
              Horizontal scroll if needed 
            */}
            <div className="overflow-x-auto scrollbar-hide">
              <MyLineChart data={chartData} />
            </div>
          </div>
        </section>
      </div>

      {/* ================= BOTTOM NAV (UNTOUCHED) ================= */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="relative h-[75px] bg-[#82b266] rounded-t-[32px] flex items-center justify-around px-6">
          {/* Home (Business) Tab */}
          <button
            onClick={() => {
              setCurrentPage("business")
              router.push("/dashboard")
            }}
            className={`
              flex flex-col items-center gap-1 pt-2
              hover:scale-110 transition-transform
              ${currentPage === "business" ? "text-[#1f105c]" : "text-white"}
            `}
          >
            <div className="relative w-20 h-20">
              <Image
                src="/dashboard/home_icon.png"
                alt="Home"
                fill
                style={{ objectFit: "contain" }}
              />
            </div>
          </button>

          {/* Center Game Button (white circle) */}
          <div className="relative -top-8">
            <button
              onClick={() => {
                setCurrentPage("game")
                router.push("/dashboard/game")
              }}
              className="relative w-24 h-24 bg-white rounded-full
                border-8 border-white flex items-center justify-center
                text-[#82b266]
                hover:scale-110 transition-transform
              "
            >
              <div className="relative w-24 h-24">
                <Image
                  src="/dashboard/game_icon.png"
                  alt="Game"
                  fill
                  style={{ objectFit: "contain" }}
                />
              </div>
            </button>
          </div>

          {/* Growth (Personal) Tab */}
          <button
            onClick={() => {
              setCurrentPage("personal")
              router.push("/dashboard/growth")
            }}
            className={`
              flex flex-col items-center gap-1 pt-2
              hover:scale-110 transition-transform
              ${currentPage === "personal" ? "text-[#1f105c]" : "text-white"}
            `}
          >
            <div className="relative w-20 h-20">
              <Image
                src="/dashboard/growth_icon.png"
                alt="Growth"
                fill
                style={{ objectFit: "contain" }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* Onboarding Tour */}
      {showTour && <OnboardingTour onFinish={handleFinishTour} />}
    </main>
  )
}
