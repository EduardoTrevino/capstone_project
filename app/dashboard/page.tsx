"use client";

/* ============================================================================
   Dashboard (v2) – unified business & goal view (mobile‑first)
   ---------------------------------------------------------------------------
   • Avatar → **top‑left** (opens settings)
   • New **Log** button (top‑right) → /dashboard/log
   • Cash counter now sits INSIDE the decorative Revenue&Profits frame and
     auto‑shrinks font size as the number grows.
   • Three KPI widgets have been factored out into separate, reusable
     components:
        ▸ MonetaryGrowthWidget
        ▸ CustomerSatisfactionWidget
        ▸ QualityReputationWidget
   ============================================================================ */

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GoalDialog, { UserGoal } from "@/components/GoalDialog";
import SettingsDialog from "@/components/SettingsDialog";

// KPI widgets
import MonetaryGrowthWidget from "@/components/widgets/MonetaryGrowthWidget";
import CustomerSatisfactionWidget from "@/components/widgets/CustomerSatisfactionWidget";
import QualityReputationWidget from "@/components/widgets/QualityReputationWidget";

export default function DashboardPage() {
  /* --------------------------------------------------------------------- */
  const router   = useRouter();
  const pathname = usePathname();

  const [username, setUsername] = useState("");
  const [avatar,   setAvatar]   = useState("");
  const [cash,     setCash]     = useState(0);

  const [focusedGoal, setFocusedGoal] = useState<UserGoal | null>(null);
  const [showGoalDialog, setShowGoalDialog]         = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  /* ------------------------ bootstrap demo data ------------------------ */
  const demoGrowth = [10, 20, 35, 5, 25, 45, 55, 60];
  const demoSatisfaction = 37; // 0‑100

  useEffect(() => {
    // !! replace with Supabase
    setUsername(localStorage.getItem("username") ?? "Eddie");
    setAvatar(localStorage.getItem("avatar") ?? "");
    setCash(Number(localStorage.getItem("cash") ?? 4568));
  }, []);

  /* ---------------------- derived / helper values ---------------------- */
  const goalProgress = focusedGoal?.progress ?? 0;
  const cashFontClass = useMemo(() => {
    if (cash < 1e5)       return "text-4xl"; // < 100 000
    if (cash < 1e7)       return "text-3xl"; // < 10 000 000
    if (cash < 1e9)       return "text-2xl";
    return "text-xl";
  }, [cash]);

  /* --------------------------- callbacks -------------------------------- */
  function handleGoalSelect(goal: UserGoal) {
    setFocusedGoal(goal);
    setShowGoalDialog(false);
  }

  /* ===================================================================== */
  return (
    <main
      className="min-h-screen w-full overflow-x-hidden overflow-y-auto relative flex flex-col pb-24"
      style={{
        backgroundImage: "url('/assets/Background/PNG/Fixed Background.png')",
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* ============================ HEADER ============================ */}
      <header className="relative py-4 px-4">
        {/* Settings (avatar) – TOP‑LEFT */}
        <button onClick={() => setShowSettingsDialog(true)} className="absolute top-4 left-4 z-20">
          <Avatar className="w-10 h-10 border-2 border-white/60 shadow">
            {avatar ? <AvatarImage src={avatar} alt={username} /> : <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>}
          </Avatar>
        </button>

        {/* Log button – TOP‑RIGHT */}
        <button onClick={() => router.push("/dashboard/log")} className="absolute top-4 right-4 z-20 w-10 h-10 hover:scale-110 transition-transform">
          <Image src="/assets/Log/Log_Icon/Log_Icon.png" alt="Log" fill style={{ objectFit: "contain" }} />
        </button>

        {/* Revenue & Profit frame */}
        <div className="relative mx-auto w-[260px] h-[110px] flex items-center justify-center">
          <Image src="/assets/Revenue&Profits/Revenue&Profits.svg" alt="Revenue frame" fill priority />
          <div className="relative z-10 flex items-center gap-2">
            <span className={`${cashFontClass} font-extrabold text-[#1F105C] drop-shadow-sm`}>₹{cash.toLocaleString()}</span>
            <Image src="/assets/Revenue&Profits/Revenue&Profits_Coin/Revenue&Profits_Coin.svg" alt="Coin" width={32} height={32} />
          </div>
        </div>

        {/* Goal banner */}
        <div className="mt-3 mx-auto flex items-center gap-2 bg-[#F8D660] px-4 py-2 rounded-xl border-b-4 border-yellow-600 shadow-md w-fit">
          <span className="text-sm font-semibold text-[#1f105c]">Goal</span>
          <div className="flex-1 h-3 w-40 bg-white/40 rounded-full overflow-hidden">
            <div className="h-full bg-[#CF7F00]" style={{ width: `${goalProgress}%` }} />
          </div>
          <button onClick={() => setShowGoalDialog(true)} className="shrink-0">
            <Image src="/assets/Goals/Goals_Progress Bar/Editpen.svg" alt="Edit Goal" width={20} height={20} />
          </button>
        </div>
      </header>

      {/* ========================= KPI WIDGETS ========================= */}
      <div className="flex-1 px-4 space-y-8 mt-4">
        <MonetaryGrowthWidget data={demoGrowth} />
        <CustomerSatisfactionWidget score={demoSatisfaction} />
        <QualityReputationWidget />
      </div>

      {/* ========================= NAV BAR ============================ */}
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="relative h-[75px] bg-[#FFFFFF] rounded-t-[32px] flex items-center justify-around px-6">
          <button onClick={() => router.push("/dashboard")} className="hover:scale-110 transition-transform">
            <Image src="/assets/Navbar/Navbar_Personal Icons/Navbar_Personal Icons_Clicked/Navbar_Personal Icons_Clicked.png" alt="Home" width={48} height={48} />
          </button>
          <div className="relative -top-4">
            <button onClick={() => router.push("/dashboard/game")} className="relative w-24 h-24 bg-white rounded-full border-8 border-white flex items-center justify-center hover:scale-110 transition-transform">
              <Image src="/assets/Navbar/Navbar_GameButton/Navbar_GameButton.png" alt="Game" fill style={{ objectFit: "contain" }} />
            </button>
          </div>
          <button onClick={() => router.push("/dashboard/business")} className="hover:scale-110 transition-transform">
            <Image src="/assets/Navbar/Navbar_Business Icons/Navbar_Business Icons_Clicked/Navbar_Business Icons_Clicked.png" alt="Business" width={48} height={48} />
          </button>
        </div>
      </nav>

      {/* ======================== DIALOGS ============================= */}
      {showGoalDialog && (
        <GoalDialog userId="" onClose={() => setShowGoalDialog(false)} onGoalSelect={handleGoalSelect} />
      )}
      {showSettingsDialog && (
        <SettingsDialog key="settings" username={username} initialAvatar={avatar} initialLanguage="english" initialSoundEnabled={true} onClose={() => setShowSettingsDialog(false)} onSave={setAvatar} />
      )}
    </main>
  );
}
