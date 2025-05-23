"use client";

/*  DASHBOARD v2.1  – re-adds full-width goal banner, heading assets,
    restores larger nav bar, etc.  */

import { useState, useEffect, useMemo } from "react";
import Image                     from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GoalDialog,  { UserGoal }   from "@/components/GoalDialog";
import SettingsDialog              from "@/components/SettingsDialog";

import MonetaryGrowthWidget        from "@/components/widgets/MonetaryGrowthWidget";
import CustomerSatisfactionWidget  from "@/components/widgets/CustomerSatisfactionWidget";
import QualityReputationWidget     from "@/components/widgets/QualityReputationWidget";

/* ---------------------------------------------------------------------- */

export default function DashboardPage() {
  const router   = useRouter();
  const pathname = usePathname();

  /* ---------- demo state (swap for Supabase queries later) ------------ */
  const [username, setUsername] = useState("E");
  const [avatar,   setAvatar]   = useState("");
  const [cash,     setCash]     = useState(4654);        // ₹ demo
  const [goal,     setGoal]     = useState<UserGoal | null>(null);

  const [showGoalDialog,     setShowGoalDialog]     = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  /* ------------------------- derived styles --------------------------- */
  const cashFont   = useMemo(() => {
    if (cash < 100000) return "text-3xl";
    if (cash < 1e6) return "text-2xl";
    return "text-xl";
  }, [cash]);

  const goalPct = goal?.progress ?? 0;

  /* ------------------------------------------------------------------- */
  function handleGoalSelect(g: UserGoal) {
    setGoal(g);
    setShowGoalDialog(false);
    /* TODO - POST focused_goal_id to Supabase */
  }

  /* ------------------------------------------------------------------- */
  return (
    <main
      className="min-h-screen w-full overflow-x-hidden overflow-y-auto pb-[120px] flex flex-col"
      style={{
        background: "url('/assets/Background/PNG/Fixed Background.png') center / cover",
      }}
    >
      {/* =========================== HEADER ============================ */}
      <header className="relative pt-4 pb-2 px-4">
        {/* Avatar – top-left */}
        <button onClick={() => setShowSettingsDialog(true)}
                className="absolute top-4 left-4 z-20">
          <Avatar className="w-10 h-10 border-2 border-white/60 shadow">
            {avatar ? <AvatarImage src={avatar} alt={username} />
                    : <AvatarFallback>{username}</AvatarFallback>}
          </Avatar>
        </button>

        {/* Log - top-right */}
        <button onClick={() => router.push("/dashboard/log")}
                className="absolute top-4 right-4 z-20 w-10 h-10 hover:scale-110 transition">
          <Image src="/assets/Log/Log_Icon/Log_Icon.png" alt="Log" fill
                 style={{ objectFit:"contain" }}/>
        </button>

        {/* Revenue & Profit frame + value */}
        <div className="relative mx-auto mt-2 w-fit h-fit px-6 py-2 bg-[#1D2557]
                        rounded-xl border border-[#FFC709] shadow-lg flex items-center justify-center z-0">
          <div className="flex items-center gap-1">
            <span className={`${cashFont} font-bold text-[#FFC709] tracking-tight`}>
              {cash.toLocaleString()}
            </span>
            <Image src="/assets/Revenue&Profits/Revenue&Profits_Coin/Revenue&Profits_Coin.svg"
                   alt="coin" width={32} height={32}/>
          </div>
        </div>

        {/* GOAL banner */}
        <div className="mx-auto mt-[-10px] w-full max-w-[600px] px-4 py-2 bg-[#F8D660]
                        rounded-xl border-b-4 border-[#CFBB3A] shadow flex items-center gap-3 relative z-10">
          <span className="text-sm font-semibold text-[#1F105C]">Goal</span>
          <div className="flex-1 h-3 bg-white/40 rounded-full overflow-hidden">
            <div className="h-full bg-[#CF7F00] transition-all duration-500"
                 style={{ width:`${goalPct}%` }}/>
          </div>
          <button onClick={() => setShowGoalDialog(true)}>
            <Image src="/assets/Goals/Goals_Progress Bar/Editpen.svg"
                   alt="edit" width={20} height={20}/>
          </button>
        </div>
      </header>

      {/* ====================== KPI WIDGET BLOCKS ====================== */}
      {/* Added mt-10 and increased space-y-10 to create space for the widget titles */}
      <div className="flex-1 px-4 mt-10 space-y-10 mx-auto w-full max-w-[600px]">
        <MonetaryGrowthWidget
          data={[35,10,5,30,45,60, 90, 100, 110, 120, 130, 140, 90, 64, 83, 95, 100, 98, 35,10,5,30,45,60]}
        />
        <CustomerSatisfactionWidget score={17}/>
        <QualityReputationWidget/>
      </div>

      {/* ======================= NAVIGATION BAR ======================== */}
      <nav className="fixed bottom-0 inset-x-0 z-50">
        <div className="relative h-[95px] bg-white rounded-t-[32px]
                        flex items-center justify-around px-6">
          {/* Home / Personal */}
          <button onClick={() => router.push("/dashboard")}
                  className="hover:scale-110 transition">
            <Image src="/assets/Navbar/Navbar_Personal Icons/Navbar_Personal Icons_Clicked/Navbar_Personal Icons_Clicked.png"
                   alt="home" width={48} height={48}/>
          </button>

          {/* Game (big middle button) */}
          <div className="relative -top-5">
            <button onClick={() => router.push("/dashboard/game")}
                    className="w-[100px] h-[100px] bg-white rounded-full border-8 border-white
                               flex items-center justify-center hover:scale-110 transition">
              <Image src="/assets/Navbar/Navbar_GameButton/Navbar_GameButton.png"
                     alt="game" fill style={{ objectFit:"contain" }}/>
            </button>
          </div>

          {/* Business */}
          <button onClick={() => router.push("/dashboard/business")}
                  className="hover:scale-110 transition">
            <Image src="/assets/Navbar/Navbar_Business Icons/Navbar_Business Icons_Clicked/Navbar_Business Icons_Clicked.png"
                   alt="biz" width={48} height={48}/>
          </button>
        </div>
      </nav>

      {/* ========================= DIALOGS ============================ */}
      {showGoalDialog && (
        <GoalDialog userId=""
                    onClose={() => setShowGoalDialog(false)}
                    onGoalSelect={handleGoalSelect}/>
      )}
      {showSettingsDialog && (
        <SettingsDialog key="settings"
                        username={username}
                        initialAvatar={avatar}
                        initialLanguage="english"
                        initialSoundEnabled
                        onClose={() => setShowSettingsDialog(false)}
                        onSave={setAvatar}/>
      )}
    </main>
  );
}