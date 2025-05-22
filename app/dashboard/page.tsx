"use client";

/*
  ============================================================================
  New unified **Dashboard** page (mobile‑first)
  ----------------------------------------------------------------------------
  ‣ Combines the old Dashboard & Goal pages.
  ‣ Follows the new Figma layout where the focused‑goal progress sits directly
    underneath the cash counter with an edit‑pencil button that opens the
    existing <GoalDialog /> component.
  ‣ All business KPI widgets (Monetary Growth, Customer Satisfaction, Quality
    & Reputation) use static asset placeholders for now – just swap them for
    live components when ready.
  ‣ Numeric values (cash, charts, progress, etc.) are hard‑coded to 0/placeholder
    until backend wiring is complete.
  ============================================================================
*/

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GoalDialog, { UserGoal } from "@/components/GoalDialog";
import SettingsDialog from "@/components/SettingsDialog";
// import QuestProgressBar if you prefer that component instead of the inline bar
// import { QuestProgressBar } from "@/components/goalProgress";

export default function DashboardPage() {
  /* -----------------------------------------------------------------------
     Local state – wire these to Supabase later.                           */
  const [username, setUsername] = useState<string>("");
  const [avatar, setAvatar]   = useState<string>("");
  const [cash, setCash]       = useState<number>(0);

  const [focusedGoal, setFocusedGoal] = useState<UserGoal | null>(null);
  const goalProgress = focusedGoal?.progress ?? 0; // 0‑100

  /* --- Dialog toggles --------------------------------------------------- */
  const [showGoalDialog,     setShowGoalDialog]     = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  /* --- Routing helpers -------------------------------------------------- */
  const router    = useRouter();
  const pathname  = usePathname();

  /* -----------------------------------------------------------------------
     TEMP: Pull basic user information from localStorage – replace with
     Supabase queries or server components in the future.
  ----------------------------------------------------------------------- */
  useEffect(() => {
    const name = localStorage.getItem("username") ?? "";
    const cashStr = localStorage.getItem("cash") ?? "0";
    const avatarPath = localStorage.getItem("avatar") ?? "";

    setUsername(name);
    setCash(parseInt(cashStr, 10));
    setAvatar(avatarPath);
  }, []);

  /* --------------------------------------------------------------------- */
  function handleGoalSelect(goal: UserGoal) {
    setFocusedGoal(goal);
    setShowGoalDialog(false);
    /* TODO: Persist focused_goal_id -> Supabase */
  }

  /* ===================================================================== */
  return (
    <main
      className="min-h-screen w-full overflow-x-hidden overflow-y-auto relative flex flex-col pb-24"
      style={{
        backgroundImage: "url('/assets/Background/PNG/Fixed Background.png')", // replace if you moved the asset
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* ================= HEADER ================= */}
      <header className="p-4 relative">
        {/* Avatar (opens Settings) */}
        <button
          onClick={() => setShowSettingsDialog(true)}
          className="absolute top-4 right-4"
        >
          <Avatar className="w-10 h-10 border-2 border-white/60 shadow">
            {avatar ? (
              <AvatarImage src={avatar} alt={username} />
            ) : (
              <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
        </button>

        {/* Cash counter */}
        <div className="flex items-center justify-center gap-2">
          <span className="text-3xl font-extrabold text-white drop-shadow-sm">
            {cash}
          </span>
          <Image
            src="/assets/Revenue&Profits/Revenue&Profits_Coin/Revenue&Profits_Coin.svg" // ✅ update path if different
            alt="Coin Icon"
            width={28}
            height={28}
            priority
          />
        </div>

        {/* Goal banner */}
        <div className="mt-3 flex items-center gap-2 bg-[#F8D660] px-4 py-2 rounded-xl border-b-4 border-yellow-600 shadow-md">
          <span className="text-sm font-semibold text-[#1f105c]">Goal</span>

          {/* Simple progress bar – swap for <QuestProgressBar/> if desired */}
          <div className="flex-1 h-3 mx-3 bg-white/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#CF7F00]"
              style={{ width: `${goalProgress}%` }}
            />
          </div>

          {/* Edit / choose goal */}
          <button onClick={() => setShowGoalDialog(true)} className="shrink-0">
            <Image
              src="/assets/Goals/Goals_Progress Bar/Editpen.svg" // ✅ update path
              alt="Edit Goal"
              width={20}
              height={20}
            />
          </button>
        </div>
      </header>

      {/* ================= MAIN WIDGETS ================= */}
      <div className="flex-1 px-4 space-y-8 mt-6">
        {/* Monetary Growth ------------------------------------------------*/}
        <section>
          <Image
            src="/assets/Business/Monetary Growth/Business_Monetary Growth_Title.svg" // ✅ update path
            alt="Monetary Growth"
            width={220}
            height={40}
            className="mb-2"
          />

          <div className="relative w-full max-w-[600px] mx-auto bg-[rgba(255,255,255,0.1)] rounded-xl border-2 border-white/20 shadow-md">
            {/* Replace static chart image with live component when ready */}
            <Image
              src="/assets/Business/Monetary Growth/Business_Monetary Growth_BarLineChart.svg" // ✅ update path
              alt="Growth Chart"
              width={600}
              height={300}
              className="object-contain w-full h-auto"
            />
          </div>
        </section>

        {/* Customer Satisfaction -----------------------------------------*/}
        <section>
          <Image
            src="/assets/Business/Customer Satisfaction/Business_CS_Title.svg" // ✅ update path
            alt="Customer Satisfaction"
            width={260}
            height={40}
            className="mb-2"
          />

          <div className="relative w-full max-w-[600px] mx-auto">
            <Image
              src="/assets/Business/Customer Satisfaction/Business_CS_Frame.svg" // ✅ update path
              alt="Customer Satisfaction Bar"
              width={600}
              height={120}
              className="object-contain w-full"
            />
            {/* Optionally overlay dynamic satisfaction marker here */}
          </div>
        </section>

        {/* Quality & Reputation -------------------------------------------*/}
        <section className="pb-4">
          <Image
            src="/assets/Business/Quality&Reputation/Business_Q&R_Title.svg" // ✅ update path
            alt="Quality & Reputation"
            width={260}
            height={40}
            className="mb-2"
          />

          <div className="relative w-full max-w-[600px] mx-auto flex justify-center">
            <Image
              src="/assets/Business/Quality&Reputation/Business_Q&R_Frame.svg" // ✅ update path
              alt="Quality & Reputation Chart"
              width={660}
              height={260}
              className="object-contain"
            />
          </div>
        </section>
      </div>

      {/* ================= BOTTOM NAV ================= */}
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="relative h-[75px] bg-[#FFFFFF] rounded-t-[32px] flex items-center justify-around px-6">
          {/* Home / Goal */}
          <button
            onClick={() => router.push("/dashboard")}
            className={`flex flex-col items-center hover:scale-110 transition-transform ${
              pathname === "/dashboard" ? "text-[#1f105c]" : "text-white"
            }`}
          >
            <div className="relative w-12 h-12">
              <Image
                src="/assets/Navbar/Navbar_Personal Icons/Navbar_Personal Icons_Clicked/Navbar_Personal Icons_Clicked.png" // ✅ update path
                alt="Home"
                fill
                style={{ objectFit: "contain" }}
              />
            </div>
          </button>

          {/* Game */}
          <div className="relative -top-4">
            <button
              onClick={() => router.push("/dashboard/game")}
              className="relative w-32 h-32 bg-white rounded-full border-8 border-white flex items-center justify-center text-[#82b266] hover:scale-110 transition-transform"
            >
              <div className="relative w-48 h-48">
                <Image
                  src="/assets/Navbar/Navbar_GameButton/Navbar_GameButton.png" // ✅ update path
                  alt="Game"
                  fill
                  style={{ objectFit: "contain" }}
                />
              </div>
            </button>
          </div>

          {/* Business (this page) */}
          <button
            onClick={() => router.push("/dashboard/business")}
            className={`flex flex-col items-center hover:scale-110 transition-transform ${
              pathname === "/dashboard/business" ? "text-[#1f105c]" : "text-white"
            }`}
          >
            <div className="relative w-12 h-12">
              <Image
                src="/assets/Navbar/Navbar_Business Icons/Navbar_Business Icons_Clicked/Navbar_Business Icons_Clicked.png" // ✅ update path
                alt="Business"
                fill
                style={{ objectFit: "contain" }}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* ============== DIALOGS ============== */}
      {showGoalDialog && (
        <GoalDialog
          userId={"" /* supply real userId when hooked up */}
          onClose={() => setShowGoalDialog(false)}
          onGoalSelect={handleGoalSelect}
        />
      )}

      {showSettingsDialog && (
        <SettingsDialog
          key="settings"
          username={username}
          initialAvatar={avatar}
          initialLanguage="english"
          initialSoundEnabled={true}
          onClose={() => setShowSettingsDialog(false)}
          onSave={(newAvatar) => setAvatar(newAvatar)}
        />
      )}
    </main>
  );
}
