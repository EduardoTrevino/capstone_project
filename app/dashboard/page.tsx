// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react"; // Added useEffect
import Image from "next/image";
import { useRouter } from "next/navigation";
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

  const [username, setUsername] = useState("Player"); // Default or load from localStorage
  const [userId, setUserId] = useState<string | null>(null); // Add userId state
  const [avatar, setAvatar] = useState("");
  // const [cash] = useState(60); // This will come from user_metric_scores
  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null); // Renamed for clarity

  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true); // For initial data load

  // Placeholder data for widgets until real data is fetched
  const [monetaryData, setMonetaryData] = useState({ data: [0], total: 0 });
  const [customerSatisfaction, setCustomerSatisfaction] = useState(0);
  const [reputationScore, setReputationScore] = useState(0); // For QualityReputationWidget

  // Fetch user data and focused goal on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    const storedUsername = localStorage.getItem("username");

    if (storedUserId) {
      setUserId(storedUserId);
      if (storedUsername) setUsername(storedUsername);

      const fetchData = async () => {
        setIsLoadingData(true);
        try {
          // Fetch user details including avatar and focused_goal_id
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("avatar_path, focused_goal_id, lives") // Add lives if you display it here
            .eq("id", storedUserId)
            .single();

          if (userError) throw userError;

          if (userData) {
            setAvatar(userData.avatar_path || "");
            // If no focused_goal_id, or if we want to always show dialog on dashboard entry for selection
            if (!userData.focused_goal_id) {
              setShowGoalDialog(true);
            } else {
              // Fetch details of the focused goal
              const { data: goalData, error: goalError } = await supabase
                .from("goals")
                .select("*, user_goals!inner(progress, dialogue_history, user_goal_id:id)")
                .eq("id", userData.focused_goal_id)
                .eq("user_goals.user_id", storedUserId)
                .single();

              if (goalError) {
                console.warn("Error fetching focused goal details, showing dialog:", goalError.message);
                setShowGoalDialog(true); // Show dialog if focused goal can't be fetched
              } else if (goalData) {
                const userGoalEntry = goalData.user_goals[0];
                setCurrentGoal({
                  id: goalData.id,
                  name: goalData.name,
                  description: goalData.description,
                  progress: userGoalEntry?.progress || 0,
                  dialogue_history: userGoalEntry?.dialogue_history || null,
                  user_goal_id: userGoalEntry?.user_goal_id || null,
                });
              } else {
                setShowGoalDialog(true); // No specific goal found, show dialog
              }
            }
          }

          // Fetch metric data (placeholders for now, implement later)
          // Example: Revenue for MonetaryGrowthWidget
          // const { data: revenueScoreData } = await supabase.from('user_metric_scores')... where name='Revenue'
          // setMonetaryData({ data: [parsed_timeseries_data], total: current_revenue_value });
          // setCustomerSatisfaction( fetched_csat_score );
          // setReputationScore( fetched_reputation_score );


        } catch (error: any) {
          console.error("Error fetching dashboard data:", error.message);
          // Potentially show an error message to the user
        } finally {
          setIsLoadingData(false);
        }
      };
      fetchData();
    } else {
      // No userId, redirect to login
      router.push("/");
    }
  }, [router]);


  const goalPct = currentGoal?.progress ?? 0;

  async function handleGoalSelect(selectedGoal: UserGoal) {
    if (!userId) return;

    setIsLoadingData(true); // Show loading while updating
    try {
      // 1. Update user's focused_goal_id
      const { error: updateUserError } = await supabase
        .from("users")
        .update({ focused_goal_id: selectedGoal.id })
        .eq("id", userId);

      if (updateUserError) throw updateUserError;

      // 2. Ensure a user_goals entry exists for this user and selected goal
      //    (GoalDialog already does this, but good to be defensive or do it here if preferred)
      const { error: upsertUserGoalError } = await supabase
        .from("user_goals")
        .upsert({
            user_id: userId,
            goal_id: selectedGoal.id,
            // Only set these if they are not already set by GoalDialog's fetch
            // progress: selectedGoal.progress || 0, // or fetch fresh from DB if needed
            // dialogue_history: selectedGoal.dialogue_history || null,
            status: 'active' // Or 'pending_initial_scenario' if dialogue_history is empty/new
        }, {
            onConflict: 'user_id, goal_id',
            ignoreDuplicates: false // We want to update updated_at if it exists
        })
        .select() // To get the potentially new/updated user_goal_id
        .single();

      if (upsertUserGoalError) throw upsertUserGoalError;


      setCurrentGoal(selectedGoal); // Update UI state
      setShowGoalDialog(false);

    } catch (error: any) {
        console.error("Error setting focused goal:", error.message);
        // Handle error (e.g., show a toast message)
    } finally {
        setIsLoadingData(false);
    }
  }

  if (isLoadingData && !showGoalDialog) { // Show a general loading spinner if not showing goal dialog
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
        // Always show goal dialog on edit click, or if no current goal
        onGoalEdit={() => setShowGoalDialog(true)}
      />

      {/* KPI widgets */}
      <div className="flex-1 px-4 mt-10 space-y-10 mx-auto w-full max-w-[600px]">
        <MonetaryGrowthWidget data={monetaryData.data} total={monetaryData.total} />
        <CustomerSatisfactionWidget score={customerSatisfaction} />
        <QualityReputationWidget/> {/* Added score prop */}
        {/* <QualityReputationWidget score={reputationScore} /> Added score prop */}
      </div>

      <BottomNav router={router} />

      {/* Ensure userId is passed to GoalDialog */}
      {showGoalDialog && userId && (
        <GoalDialog
            userId={userId}
            onClose={() => setShowGoalDialog(false)}
            onGoalSelect={handleGoalSelect}
        />
      )}
      {showSettingsDialog && userId && ( // Also ensure userId for settings if it needs it
        <SettingsDialog
          key="settings"
          username={username}
          // userId={userId} // Pass userId if SettingsDialog needs to update user-specific settings
          initialAvatar={avatar}
          initialLanguage="english" // This should come from user data
          initialSoundEnabled // This should come from user data
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
export function BottomNav({ router }: { router: any }) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      <div className="relative h-[95px] bg-white rounded-t-[32px] flex items-center justify-around px-6">
        <button onClick={() => router.push("/dashboard")} className="hover:scale-110 transition"><Image src="/assets/Navbar/Navbar_Personal Icons/Navbar_Personal Icons_Clicked/Navbar_Personal Icons_Clicked.png" alt="home" width={48} height={48} /></button>
        <div className="relative -top-5"><button onClick={() => router.push("/dashboard/game")} className="w-[100px] h-[100px] bg-white rounded-full border-8 border-white flex items-center justify-center hover:scale-110 transition"><Image src="/assets/Navbar/Navbar_GameButton/Navbar_GameButton.png" alt="game" fill style={{ objectFit: "contain" }} /></button></div>
        <button onClick={() => router.push("/dashboard/growth")} className="hover:scale-110 transition"><Image src="/assets/Navbar/Navbar_Business Icons/Navbar_Business Icons_Clicked/Navbar_Business Icons_Clicked.png" alt="biz" width={48} height={48} /></button>
      </div>
    </nav>
  );
}