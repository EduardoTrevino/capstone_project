"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import SettingsDialog from "@/components/SettingsDialog"
import { OnboardingTour } from "@/components/onboarding-tour"
import { QuestProgressBar } from "@/components/goalProgress"
import { supabase } from "@/lib/supabase"

export default function GoalPage() {
  const [username, setUsername] = useState("")
  const [avatar, setAvatar] = useState("")
  const [currentPage, setCurrentPage] = useState<"business" | "game" | "goal">("goal")
  const [showTour, setShowTour] = useState(false)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)

  const router = useRouter()

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
      .select("avatar_path")
      .eq("name", name)
      .single()

    if (error) {
      console.error("Error fetching user data:", error.message)
      return
    }
    if (!data) return

    setAvatar(data.avatar_path || "")
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

  const handleSettingsSave = (newAvatar: string, newLanguage: string, newSound: boolean) => {
    setAvatar(newAvatar)
    setShowSettingsDialog(false)
  }

  return (
    <main
      className="min-h-screen w-full overflow-x-hidden overflow-y-auto relative flex flex-col"
      style={{
        backgroundImage: "url('/dashboard/background_dashboard.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* ================= HEADER ================= */}
      <header className="p-4 relative">
        {/* Avatar in top right */}
        <div className="absolute top-4 right-4 cursor-pointer" onClick={() => setShowSettingsDialog(true)}>
          <Avatar className="w-10 h-10">
            {avatar ? (
              <AvatarImage src={avatar} alt={username} />
            ) : (
              <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
        </div>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <div className="flex-1 px-4 pb-24">
        {/* Top centered game name image */}
        <div className="flex justify-center mt-8">
          <Image src="/game_name.png" alt="Game Name" width={220} height={60} />
        </div>

        {/* Quest Progress Bar */}
        <div className="mt-8">
          <QuestProgressBar goal="Increase Revenue" progress={50} />
        </div>

        {/* Log image underneath the progress */}
        <div className="flex justify-center mt-8">
          <Image src="/goal/log_temp.png" alt="Log Template" width={400} height={150} />
        </div>
      </div>

      {/* ================= NAVIGATION ================= */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="relative h-[75px] bg-[#82b266] rounded-t-[32px] flex items-center justify-around px-6">
          <button
            onClick={() => {
              setCurrentPage("business")
              router.push("/dashboard")
            }}
            className={`flex flex-col items-center gap-1 pt-2 hover:scale-110 transition-transform ${
              currentPage === "business" ? "text-[#1f105c]" : "text-white"
            }`}
          >
            <div className="relative w-20 h-20">
              <Image src="/dashboard/home_icon.png" alt="Home" fill style={{ objectFit: "contain" }} />
            </div>
          </button>

          <div className="relative -top-8">
            <button
              onClick={() => {
                setCurrentPage("game")
                router.push("/dashboard/game")
              }}
              className="relative w-24 h-24 bg-white rounded-full border-8 border-white flex items-center justify-center text-[#82b266] hover:scale-110 transition-transform"
            >
              <div className="relative w-24 h-24">
                <Image src="/dashboard/game_icon.png" alt="Game" fill style={{ objectFit: "contain" }} />
              </div>
            </button>
          </div>

          <button
            onClick={() => {
              setCurrentPage("goal")
              router.push("/dashboard/goal")
            }}
            className={`flex flex-col items-center gap-1 pt-2 hover:scale-110 transition-transform ${
              currentPage === "goal" ? "text-[#1f105c]" : "text-white"
            }`}
          >
            <div className="relative w-20 h-20">
              <Image src="/dashboard/growth_icon.png" alt="Goal" fill style={{ objectFit: "contain" }} />
            </div>
          </button>
        </div>
      </div>

      {showTour && <OnboardingTour onFinish={handleFinishTour} />}
      {showSettingsDialog && (
        <SettingsDialog
          key={showSettingsDialog ? "open" : "closed"}
          username={username}
          initialAvatar={avatar}
          initialLanguage="english"
          initialSoundEnabled={true}
          onClose={() => setShowSettingsDialog(false)}
          onSave={handleSettingsSave}
        />
      )}
    </main>
  )
}
