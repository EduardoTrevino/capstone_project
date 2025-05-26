"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GoalDialog, { UserGoal } from "@/components/GoalDialog";
import SettingsDialog from "@/components/SettingsDialog";

import MonetaryGrowthWidget from "@/components/widgets/MonetaryGrowthWidget";
import CustomerSatisfactionWidget from "@/components/widgets/CustomerSatisfactionWidget";
import QualityReputationWidget from "@/components/widgets/QualityReputationWidget";

/* ---------------------------------------------------------------------- */
export default function DashboardPage() {
  const router = useRouter();

  /* demo state – swap for Supabase later */
  const [username] = useState("E");
  const [avatar, setAvatar] = useState("");
  const [cash] = useState(60);
  const [goal, setGoal] = useState<UserGoal | null>(null);

  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const goalPct = goal?.progress ?? 0;

  function handleGoalSelect(g: UserGoal) {
    setGoal(g);
    setShowGoalDialog(false);
  }

  /* ---------------------------- JSX ---------------------------- */
  return (
    <main
      className="min-h-screen w-full overflow-x-hidden overflow-y-auto pb-[120px] flex flex-col"
      style={{ background: "url('/assets/Background/PNG/Fixed Background.png') center/cover" }}
    >
      <Header
        username={username}
        avatar={avatar}
        onAvatarClick={() => setShowSettingsDialog(true)}
        onLogClick={() => router.push("/dashboard/log")}
        goalPct={goalPct}
        onGoalEdit={() => setShowGoalDialog(true)}
      />

      {/* KPI widgets */}
      <div className="flex-1 px-4 mt-10 space-y-10 mx-auto w-full max-w-[600px]">
        <MonetaryGrowthWidget data={[35, 10, 5, 30, 45, 60]} total={cash} />
        <CustomerSatisfactionWidget score={50} />
        <QualityReputationWidget />
      </div>

      <BottomNav router={router} />

      {showGoalDialog && <GoalDialog userId="" onClose={() => setShowGoalDialog(false)} onGoalSelect={handleGoalSelect} />}
      {showSettingsDialog && (
        <SettingsDialog
          key="settings"
          username={username}
          initialAvatar={avatar}
          initialLanguage="english"
          initialSoundEnabled
          onClose={() => setShowSettingsDialog(false)}
          onSave={setAvatar}
        />
      )}
    </main>
  );
}

// ---------------------------- shared header ----------------------------
interface HeaderProps {
  username: string;
  avatar: string;
  goalPct: number;
  onAvatarClick: () => void;
  onLogClick: () => void;
  onGoalEdit: () => void;
}

export function Header({ username, avatar, goalPct, onAvatarClick, onLogClick, onGoalEdit }: HeaderProps) {
  return (
    <header className="relative pt-4 pb-2 px-4">
      {/* avatar */}
      <button onClick={onAvatarClick} className="absolute top-4 left-4 z-20">
        <Avatar className="w-10 h-10 border-2 border-white/60 shadow">
          {avatar ? <AvatarImage src={avatar} alt={username} /> : <AvatarFallback>{username}</AvatarFallback>}
        </Avatar>
      </button>

      {/* log */}
      <button onClick={onLogClick} className="absolute top-4 right-4 z-20 w-10 h-10 hover:scale-110 transition">
        <Image src="/assets/Log/Log_Icon/Log_Icon.png" alt="Log" fill style={{ objectFit: "contain" }} />
      </button>

      {/* lives */}
      <div className="flex justify-center mt-2 gap-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Image key={i} src="/assets/Business/Lives/heart.svg" alt="heart" width={28} height={28} />
        ))}
      </div>

      {/* goal banner */}
      <div className="mx-auto mt-2 w-full max-w-[600px] px-4 py-2 bg-[#FEEED0] rounded-xl border-2 border-[#A03827] shadow-lg flex items-center gap-3 relative z-10">
        <span className="text-sm font-semibold text-[#1F105C]">Goal</span>
        <div className="flex-1 h-3 bg-white/40 rounded-full overflow-hidden"><div className="h-full bg-[#CF7F00] transition-all duration-500" style={{ width: `${goalPct}%` }} /></div>
        <button onClick={onGoalEdit}><Image src="/assets/Goals/Goals_Progress Bar/Editpen.svg" alt="edit" width={20} height={20} /></button>
      </div>
    </header>
  );
}

// ---------------------------- bottom nav ----------------------------
function BottomNav({ router }: { router: any }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      <div className="relative h-[95px] bg-white rounded-t-[32px] flex items-center justify-around px-6">
        <button onClick={() => router.push("/dashboard")} className="hover:scale-110 transition"><Image src="/assets/Navbar/Navbar_Personal Icons/Navbar_Personal Icons_Clicked/Navbar_Personal Icons_Clicked.png" alt="home" width={48} height={48} /></button>
        <div className="relative -top-5"><button onClick={() => router.push("/dashboard/game")} className="w-[100px] h-[100px] bg-white rounded-full border-8 border-white flex items-center justify-center hover:scale-110 transition"><Image src="/assets/Navbar/Navbar_GameButton/Navbar_GameButton.png" alt="game" fill style={{ objectFit: "contain" }} /></button></div>
        <button onClick={() => router.push("/dashboard/business")} className="hover:scale-110 transition"><Image src="/assets/Navbar/Navbar_Business Icons/Navbar_Business Icons_Clicked/Navbar_Business Icons_Clicked.png" alt="biz" width={48} height={48} /></button>
      </div>
    </nav>
  );
}