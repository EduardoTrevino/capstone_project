// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react"; // Added useEffect
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GoalDialog, { UserGoal } from "@/components/GoalDialog";
import SettingsDialog from "@/components/SettingsDialog";
import { supabase } from "@/lib/supabase"; // Import Supabase
import { Loader2 } from "lucide-react"; // Add Loader2 import

import MonetaryGrowthWidget from "@/components/widgets/MonetaryGrowthWidget";
import CustomerSatisfactionWidget from "@/components/widgets/CustomerSatisfactionWidget";
import QualityReputationWidget from "@/components/widgets/QualityReputationWidget";

/* ---------------------------------------------------------------------- */
export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); // For reading query params from game page

  const [username, setUsername] = useState("Player");
  const [userIdFromStorage, setUserIdFromStorage] = useState<string | null>(null);
  const [avatar, setAvatar] = useState("");
  // const [cash] = useState(60); // This will come from user_metric_scores
  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null); // Renamed for clarity

  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true); // For initial data load

  // Placeholder data for widgets until real data is fetched
  const [monetaryData, setMonetaryData] = useState({ data: [0], total: 0 });
  const [customerSatisfaction, setCustomerSatisfaction] = useState(0);
  const [reputationScore, setReputationScore] = useState(0);
  const [userLives, setUserLives] = useState(3);

  // Effect 1: Get userId from localStorage on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    const storedUsername = localStorage.getItem("username");
    if (storedUserId) {
      setUserIdFromStorage(storedUserId);

      if (storedUsername) setUsername(storedUsername);
    } else {
      router.push("/");
    }
  }, [router]);

  // Effect 2: Fetch data when userIdFromStorage is available or searchParams change
  useEffect(() => {
    if (!userIdFromStorage) {
      if (!localStorage.getItem("userId")) setIsLoadingPageData(false);
      return;
    }

    const fetchData = async () => {
      setIsLoadingPageData(true);
      setShowGoalDialog(false);
      try {
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("avatar_path, focused_goal_id, lives")
          .eq("id", userIdFromStorage)
          .single();

        if (userError) {
          console.error("Error fetching user data:", userError);
          if (userError.code === 'PGRST116') router.push('/');
          throw userError;
        }
        
        if (userData) {
          setAvatar(userData.avatar_path || "");
          setUserLives(userData.lives || 0);

          if (searchParams.get('showGoalDialog') === 'true') {
            setShowGoalDialog(true);
            setCurrentGoal(null);
          } else if (!userData.focused_goal_id) {
            setShowGoalDialog(true);
            setCurrentGoal(null);
          } else {
            const { data: goalData, error: goalError } = await supabase
              .from("goals")
              .select("id, name, description, status, user_goals!inner(progress, dialogue_history, user_goal_id:id, status)")
              .eq("id", userData.focused_goal_id)
              .eq("user_goals.user_id", userIdFromStorage)
              .single();

            if (goalError || !goalData) {
              console.warn("Focused goal not found or user_goals entry missing, showing dialog:", goalError?.message);
              setShowGoalDialog(true);
              setCurrentGoal(null);
            } else {
              const userGoalEntry = goalData.user_goals[0];
              setCurrentGoal({
                id: goalData.id,
                name: goalData.name,
                description: goalData.description,
                progress: userGoalEntry?.progress || 0,
                dialogue_history: userGoalEntry?.dialogue_history || null,
                user_goal_id: userGoalEntry?.user_goal_id || null,
                status: userGoalEntry?.status || 'active',
              });
              setShowGoalDialog(false);
            }
          }
        } else {
          router.push('/');
        }

      } catch (error: any) {
        console.error("Error in fetchData dashboard:", error.message);
      } finally {
        setIsLoadingPageData(false);
      }
    };

    fetchData();
  }, [userIdFromStorage, searchParams, router]);

  const goalPct = currentGoal?.progress ?? 0;

  async function handleGoalSelect(selectedGoal: UserGoal) {
    if (!userIdFromStorage) return;

    setCurrentGoal(selectedGoal);
    setShowGoalDialog(false);
    setIsLoadingPageData(true);

    try {
      const { error: updateUserError } = await supabase
        .from("users")
        .update({ focused_goal_id: selectedGoal.id })
        .eq("id", userIdFromStorage);
      if (updateUserError) throw updateUserError;

      const { data: upsertedUserGoal, error: upsertUserGoalError } = await supabase
        .from("user_goals")
        .upsert({
            user_id: userIdFromStorage,
            goal_id: selectedGoal.id,
            status: 'active',
            progress: 0,
            dialogue_history: [],
            attempts_for_current_goal_cycle: 0,
        }, { onConflict: 'user_id, goal_id', ignoreDuplicates: false })
        .select('id, progress, status, dialogue_history, attempts_for_current_goal_cycle')
        .single();

      if (upsertUserGoalError) throw upsertUserGoalError;

      if (upsertedUserGoal) {
          setCurrentGoal({
              ...selectedGoal,
              user_goal_id: upsertedUserGoal.id,
              progress: upsertedUserGoal.progress,
              status: upsertedUserGoal.status,
              dialogue_history: upsertedUserGoal.dialogue_history,
          });
      } else {
        setCurrentGoal(selectedGoal);
      }

    } catch (error: any) {
        console.error("Error setting focused goal:", error.message);
        setCurrentGoal(null);
        setShowGoalDialog(true);
    } finally {
        setIsLoadingPageData(false);
    }
  }

  if (isLoadingPageData && !showGoalDialog) {
      return (
          <main
              className="min-h-screen w-full flex items-center justify-center"
              style={{ background: "url('/assets/Background/PNG/Fixed Background.png') center/cover" }}
          >
              <Loader2 className="h-12 w-12 animate-spin text-white" />
          </main>
      );
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
        currentGoalName={currentGoal?.name}
        userLives={userLives}
        onGoalEdit={() => {
            setCurrentGoal(null);
            setShowGoalDialog(true);
        }}
      />

      {/* KPI widgets */}
      <div className="flex-1 px-4 mt-10 space-y-10 mx-auto w-full max-w-[600px]">
        <MonetaryGrowthWidget data={monetaryData.data} total={monetaryData.total} />
        <CustomerSatisfactionWidget score={customerSatisfaction} />
        <QualityReputationWidget/> {/* Added score prop */}
        {/* <QualityReputationWidget score={reputationScore} /> Added score prop */}
      </div>

      <BottomNav router={router} currentGoal={currentGoal} />

      {showGoalDialog && userIdFromStorage && (
        <GoalDialog
            userId={userIdFromStorage}
            onClose={() => setShowGoalDialog(false)}
            onGoalSelect={handleGoalSelect}
        />
      )}
      {showSettingsDialog && userIdFromStorage && (
        <SettingsDialog
          key="settings"
          username={username}
          initialAvatar={avatar}
          initialLanguage="english"
          initialSoundEnabled
          onClose={() => setShowSettingsDialog(false)}
          onSave={(newAvatar, newLang, newSound) => {
            setAvatar(newAvatar);
            // Update user settings in DB here if SettingsDialog doesn't do it internally
          }}
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
  currentGoalName?: string | null;
  userLives: number;
  onAvatarClick: () => void;
  onLogClick: () => void;
  onGoalEdit: () => void;
}

export function Header({ username, avatar, goalPct, currentGoalName, userLives, onAvatarClick, onLogClick, onGoalEdit }: HeaderProps) {
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

      <div className="flex justify-center mt-2 gap-1">
        {Array.from({ length: userLives }).map((_, i) => (
          <Image key={i} src="/assets/Business/Lives/heart.svg" alt="heart" width={28} height={28} />
        ))}
        {Array.from({ length: Math.max(0, 3 - userLives) }).map((_, i) => (
          <Image key={`empty-${i}`} src="/assets/Business/Lives/heart_empty.svg" alt="empty heart" width={28} height={28} />
        ))}
      </div>

      {/* goal banner */}
      <div className="mx-auto mt-2 w-full max-w-[600px] px-4 py-2 bg-[#FEEED0] rounded-xl border-2 border-[#A03827] shadow-lg flex items-center gap-3 relative z-10">
        <span className="text-sm font-semibold text-[#1F105C]">{currentGoalName || "No Goal Selected"}</span>
        {currentGoalName && (
          <div className="flex-1 h-3 bg-white/40 rounded-full overflow-hidden">
            <div className="h-full bg-[#CF7F00] transition-all duration-500" style={{ width: `${goalPct}%` }} />
          </div>
        )}
        <button onClick={onGoalEdit}><Image src="/assets/Goals/Goals_Progress Bar/Editpen.svg" alt="edit" width={20} height={20} /></button>
      </div>
    </header>
  );
}

// ---------------------------- bottom nav ----------------------------
export function BottomNav({ router, currentGoal }: { router: any, currentGoal: UserGoal | null }) {
  const handlePlayClick = () => {
    if (currentGoal?.status === 'completed' || currentGoal?.status === 'failed_needs_retry') {
      // Pass status AND goalId so game page can fetch the correct summary if needed
      router.push(`/dashboard/game?status=${currentGoal.status}&goalId=${currentGoal.id}`);
    } else {
      router.push("/dashboard/game");
    }
  };

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      <div className="relative h-[95px] bg-white rounded-t-[32px] flex items-center justify-around px-6">
        <button onClick={() => router.push("/dashboard")} className="hover:scale-110 transition">
          <Image src="/assets/Navbar/Navbar_Personal Icons/Navbar_Personal Icons_Clicked/Navbar_Personal Icons_Clicked.png" alt="home" width={48} height={48} />
        </button>
        <div className="relative -top-5">
          <button
            onClick={handlePlayClick}
            className="w-[100px] h-[100px] bg-white rounded-full border-8 border-white flex items-center justify-center hover:scale-110 transition"
            disabled={!currentGoal}
          >
            <Image src="/assets/Navbar/Navbar_GameButton/Navbar_GameButton.png" alt="game" fill style={{ objectFit: "contain" }} />
          </button>
        </div>
        <button onClick={() => router.push("/dashboard/growth")} className="hover:scale-110 transition">
          <Image src="/assets/Navbar/Navbar_Business Icons/Navbar_Business Icons_Clicked/Navbar_Business Icons_Clicked.png" alt="biz" width={48} height={48} />
        </button>
      </div>
    </nav>
  );
}