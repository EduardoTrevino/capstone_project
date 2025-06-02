// app/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GoalDialog, { UserGoal } from "@/components/GoalDialog";
import SettingsDialog from "@/components/SettingsDialog";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

import MonetaryGrowthWidget from "@/components/widgets/MonetaryGrowthWidget";
import CustomerSatisfactionWidget from "@/components/widgets/CustomerSatisfactionWidget";
import QualityReputationWidget from "@/components/widgets/QualityReputationWidget";

// Interfaces (can be moved to a types file if used elsewhere)
interface MetricDefinition {
  id: number;
  name: string;
  data_type: string;
  min_value: number | null;
  max_value: number | null;
  initial_value: number;
}

interface MetricScoreData {
  current_value: string;
  metrics: {
    name: string;
  };
}

// Helper to fetch metric definitions - can be moved to a shared lib file
async function getMetricDefinitions(): Promise<MetricDefinition[]> {
  const { data: metricsData, error: metricsError } = await supabase
      .from('metrics')
      .select('id, name, data_type, min_value, max_value, initial_value');
  if (metricsError) {
    console.error("Failed to fetch metrics in getMetricDefinitions:", metricsError.message)
    // Instead of throwing, which might crash the component, return empty or handle error appropriately
    return []; 
  }
  return (metricsData || []).map(m => ({ ...m, initial_value: Number(m.initial_value) })) as MetricDefinition[];
}

/* ---------------------------------------------------------------------- */
export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("Player");
  const [userIdFromStorage, setUserIdFromStorage] = useState<string | null>(null);
  const [avatar, setAvatar] = useState("");
  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [userLives, setUserLives] = useState(3);

  // Placeholder data for widgets until real data is fetched
  const [monetaryData, setMonetaryData] = useState({ data: [] as number[], total: 0 }); // Ensure data is number[]
  const [customerSatisfaction, setCustomerSatisfaction] = useState(0);
  const [reputationScore, setReputationScore] = useState(0);

  // Add handleGoalSelect function
  const handleGoalSelect = async (selectedGoal: UserGoal) => {
    if (!userIdFromStorage) return;
    
    try {
      // Update user's focused goal in the database
      const { error: updateError } = await supabase
        .from('users')
        .update({ focused_goal_id: selectedGoal.id })
        .eq('id', userIdFromStorage);

      if (updateError) throw updateError;

      // Update local state
      setCurrentGoal(selectedGoal);
      setShowGoalDialog(false);
      
      // Optionally refresh data to ensure everything is in sync
      await fetchData(userIdFromStorage);
    } catch (error: any) {
      console.error("Error updating focused goal:", error.message);
      // You might want to show an error message to the user here
    }
  };

  // Effect 1: Get userId from localStorage on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    const storedUsername = localStorage.getItem("username");
    if (storedUserId) {
      setUserIdFromStorage(storedUserId);
      if (storedUsername) setUsername(storedUsername);
    } else {
      router.push("/"); // Redirect if no user ID
    }
  }, [router]);

  // Memoized fetchData to prevent re-creation on every render unless dependencies change
  const fetchData = useCallback(async (currentUserId: string) => {
    console.log("Dashboard fetchData triggered for user:", currentUserId);
    setIsLoadingPageData(true);
    // setShowGoalDialog(false); // Reset goal dialog visibility - Moved this decision into the logic below

    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("avatar_path, focused_goal_id, lives")
        .eq("id", currentUserId)
        .single();

      if (userError) {
        console.error("Error fetching user data in dashboard:", userError);
        if (userError.code === 'PGRST116') {
            console.log("User not found in DB, redirecting to login.");
            router.push('/'); 
        }
        setIsLoadingPageData(false);
        return; 
      }
      
      setAvatar(userData.avatar_path || "");
      setUserLives(userData.lives ?? 3);

      let focusedGoalIdForProcessing: number | null = userData.focused_goal_id;

      let shouldShowGoalDialogInitially = false;
      if (searchParams.get('showGoalDialog') === 'true') {
        console.log("Dashboard: showGoalDialog query param is true.");
        shouldShowGoalDialogInitially = true;
        setCurrentGoal(null); // Clear current goal as user intends to select
        focusedGoalIdForProcessing = null;
        // Clean the URL parameter after processing
        router.replace('/dashboard', { scroll: false }); // Next.js 13 App Router way
      } else if (!userData.focused_goal_id) {
        console.log("Dashboard: No focused goal ID for user.");
        shouldShowGoalDialogInitially = true;
        setCurrentGoal(null);
      } else {
        console.log("Dashboard: User has focused_goal_id:", userData.focused_goal_id);
        const { data: goalDetails, error: goalDetailsError } = await supabase
          .from("goals")
          .select(`
            id, name, description,
            user_goals!inner (
              user_goal_id:id, progress, status, dialogue_history, attempts_for_current_goal_cycle
            )
          `)
          .eq("id", userData.focused_goal_id)
          .eq("user_goals.user_id", currentUserId) // Ensure we get the user_goal for THIS user
          .single();

        if (goalDetailsError || !goalDetails) {
          console.warn("Dashboard: Focused goal details not found or user_goals entry missing. Showing dialog.", goalDetailsError?.message);
          shouldShowGoalDialogInitially = true;
          setCurrentGoal(null);
          focusedGoalIdForProcessing = null;
        } else {
          console.log("Dashboard: Successfully fetched focused goal details:", goalDetails.name);
          const ugEntry = goalDetails.user_goals[0];
          setCurrentGoal({
            id: goalDetails.id,
            name: goalDetails.name,
            description: goalDetails.description,
            user_goal_id: ugEntry.user_goal_id,
            progress: ugEntry.progress,
            status: ugEntry.status, // This is crucial for BottomNav logic
            dialogue_history: ugEntry.dialogue_history,
          });
          focusedGoalIdForProcessing = goalDetails.id;
        }
      }
      // Only set showGoalDialog if it's not already true from the query param
      if (!showGoalDialog) {
        setShowGoalDialog(shouldShowGoalDialogInitially);
      }

      // Fetch User Metric Scores for Widgets
      // const { data: metricScores, error: metricsError } = await supabase
      //   .from('user_metric_scores')
      //   .select('current_value, metrics!inner(name, initial_value)')
      //   .eq('user_id', currentUserId);

      // if (metricsError) {
      //   console.error("Error fetching user metric scores for dashboard:", metricsError);
      // } else {
      //   let revenueTotal = 0; // Default
      //   let csatScore = 50;   // Default
      //   let repScore = 2.5;   // Default

      //   const metricDefinitions = await getMetricDefinitions(); // Get all metric defs to find initial_values

      //   ((metricScores || []) as unknown as MetricScore[]).forEach(score => {
      //       const metricName = score.metrics.name;
      //       const value = parseFloat(score.current_value);

      //       if (metricName === 'Revenue') revenueTotal = value;
      //       else if (metricName === 'Customer Satisfaction') csatScore = value;
      //       else if (metricName === 'Reputation') repScore = value;
      //   });

      // Fetch current metric scores for CSAT and Reputation
      const { data: currentMetricScoresData, error: metricsError } = await supabase
        .from('user_metric_scores')
        .select('current_value, metrics!inner(name)') // No need for initial_value here
        .eq('user_id', currentUserId)
        .in('metrics.name', ['Customer Satisfaction', 'Reputation']); // Fetch only relevant metrics

      let csatScore = 0;
      let repScore = 0;

      if (metricsError) {
        console.error("Error fetching CSAT/Reputation scores:", metricsError);
      } else if (currentMetricScoresData) {
        ((currentMetricScoresData as unknown) as MetricScoreData[]).forEach(score => {
          const value = parseFloat(score.current_value);
          if (score.metrics.name === 'Customer Satisfaction') csatScore = value;
          else if (score.metrics.name === 'Reputation') repScore = value;
        });
      }
      setCustomerSatisfaction(csatScore);
      setReputationScore(repScore);

      // --- Logic for MonetaryGrowthWidget using user_metric_history ---
      const allMetricDefinitions = await getMetricDefinitions();
      const revenueMetricDefForWidget = allMetricDefinitions.find(m => m.name === 'Revenue');
      
      let fetchedRevenueHistoryValues: number[] = [];
      let latestRevenueTotalForWidget: number = 0;

      // Try to get latest revenue from user_metric_scores as a fallback or initial single point
      const currentRevenueScoreEntry = ((currentMetricScoresData as unknown) as MetricScoreData[] || []).find(
        s => s.metrics.name === 'Revenue'
      ) || (await supabase.from('user_metric_scores').select('current_value, metrics!inner(name)').eq('user_id', currentUserId).eq('metrics.name', 'Revenue').single()).data as MetricScoreData | null;

      if (currentRevenueScoreEntry) {
          latestRevenueTotalForWidget = parseFloat(currentRevenueScoreEntry.current_value);
      }
      // Default to one point if no history or other data
      fetchedRevenueHistoryValues = [latestRevenueTotalForWidget];


      if (revenueMetricDefForWidget && currentUserId && focusedGoalIdForProcessing) {
          const { data: revenueHistoryData, error: historyFetchError } = await supabase
              .from('user_metric_history')
              .select('value') 
              .eq('user_id', currentUserId)
              .eq('goal_id', focusedGoalIdForProcessing) // Use the determined goal ID
              .eq('metric_id', revenueMetricDefForWidget.id)
              .order('scenario_attempt_number', { ascending: true })
              .order('decision_number', { ascending: true });

          if (historyFetchError) {
              console.error("Error fetching revenue history for widget:", historyFetchError.message);
              // Fallback already handled by initializing with current score
          } else if (revenueHistoryData && revenueHistoryData.length > 0) {
              fetchedRevenueHistoryValues = revenueHistoryData.map(entry => parseFloat(entry.value as any));
              if (fetchedRevenueHistoryValues.length > 0) {
                latestRevenueTotalForWidget = fetchedRevenueHistoryValues[fetchedRevenueHistoryValues.length - 1];
              }
              console.log("Dashboard: Fetched revenue history for widget:", fetchedRevenueHistoryValues);
          } else {
              console.log("Dashboard: No revenue history found for goal, using current/default value for widget.");
              // Fallback already handled by initializing with current score
          }
      } else {
          console.log("Dashboard: Conditions not met to fetch revenue history (no revenue def, user, or goal). Using current/default.");
          // Fallback already handled
      }
      
      // Ensure data always has at least one point for the chart, even if it's 0 or the initial value
      if (fetchedRevenueHistoryValues.length === 0) {
        const revenueInitial = revenueMetricDefForWidget?.initial_value ?? 0;
        fetchedRevenueHistoryValues = [latestRevenueTotalForWidget || revenueInitial];
        if (latestRevenueTotalForWidget === 0 && revenueInitial !== 0) { // Prioritize current if non-zero
            latestRevenueTotalForWidget = revenueInitial;
        }
      }


      setMonetaryData({ data: fetchedRevenueHistoryValues, total: latestRevenueTotalForWidget });

    } catch (error: any) {
      console.error("Error in fetchData (dashboard):", error.message);
    } finally {
      setIsLoadingPageData(false);
      console.log("Dashboard fetchData finished.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, searchParams, showGoalDialog]); // showGoalDialog influences logic, so keep it.

  // Effect 2: Fetch data when userIdFromStorage is available
  useEffect(() => {
    if (userIdFromStorage) {
      fetchData(userIdFromStorage);
    } else {
      // If not redirecting yet and no userIdFromStorage, means still waiting for Effect 1 or user truly not logged in.
      // If localStorage is also empty, then stop loading.
      if (!localStorage.getItem("userId")) {
          setIsLoadingPageData(false);
      }
    }
  }, [userIdFromStorage, fetchData]); // fetchData is memoized, searchParams is implicitly handled by fetchData's own dep.


  const goalPct = currentGoal?.progress ?? 0;

  // Loading state display: show only if truly loading page data AND dialog isn't meant to be open.
  // Also don't show loading state when we're just updating the current goal
  if (isLoadingPageData && !showGoalDialog && !searchParams.get('showGoalDialog') && !currentGoal) {
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
            // When clicking edit, we want to show all goals, not just pre-filter to current.
            // Clearing currentGoal before showing dialog might simplify GoalDialog logic if it fetches all.
            // However, GoalDialog should fetch all regardless.
            setShowGoalDialog(true);
        }}
      />

      {/* KPI widgets */}
      <div className="flex-1 px-4 mt-10 space-y-10 mx-auto w-full max-w-[600px]">
        <MonetaryGrowthWidget data={monetaryData.data} total={monetaryData.total} />
        <CustomerSatisfactionWidget score={customerSatisfaction} />
        <QualityReputationWidget score={reputationScore} />
      </div>

      <BottomNav router={router} currentGoal={currentGoal} />

      {showGoalDialog && userIdFromStorage && (
        <GoalDialog
            userId={userIdFromStorage}
            onClose={() => {
                setShowGoalDialog(false);
                // If no currentGoal is set after closing, and user didn't select,
                // they might be stuck without a focused goal.
                // Re-fetch data to see if backend has a focused_goal_id (e.g. last one they had)
                if (!currentGoal && userIdFromStorage) {
                    fetchData(userIdFromStorage);
                }
            }}
            onGoalSelect={handleGoalSelect}
        />
      )}
      {showSettingsDialog && userIdFromStorage && (
        <SettingsDialog
          key="settings"
          username={username}
          // userId={userIdFromStorage} // Pass userId if SettingsDialog updates user table
          initialAvatar={avatar}
          initialLanguage="english" // TODO: Fetch from user data
          initialSoundEnabled={true} // TODO: Fetch from user data
          onClose={() => setShowSettingsDialog(false)}
          onSave={async (newAvatar, newLang, newSound) => { // Make onSave async if it updates DB
            setAvatar(newAvatar);
            // TODO: Update user settings in DB here
            // await supabase.from('users').update({ avatar_path: newAvatar, language: newLang, sound_enabled: newSound }).eq('id', userIdFromStorage);
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
      <button onClick={onAvatarClick} className="absolute top-4 left-4 z-20">
        <Avatar className="w-10 h-10 border-2 border-white/60 shadow">
          {avatar ? <AvatarImage src={avatar} alt={username} /> : <AvatarFallback>{username?.charAt(0)?.toUpperCase() || 'P'}</AvatarFallback>}
        </Avatar>
      </button>

      <button onClick={onLogClick} className="absolute top-4 right-4 z-20 w-10 h-10 hover:scale-110 transition">
        <Image src="/assets/Log/Log_Icon/Log_Icon.png" alt="Log" fill style={{ objectFit: "contain" }} />
      </button>

      <div className="flex justify-center mt-2 gap-1">
        {Array.from({ length: userLives }).map((_, i) => (
          <Image key={i} src="/assets/Business/Lives/heart.svg" alt="heart" width={28} height={28} />
        ))}
        {Array.from({ length: Math.max(0, 3 - userLives) }).map((_, i) => ( // Show empty hearts
          <Image key={`empty-${i}`} src="/assets/Business/Lives/heart_empty.svg" alt="empty heart" width={28} height={28} />
        ))}
      </div>

      <div className="mx-auto mt-2 w-full max-w-[600px] px-4 py-2 bg-[#FEEED0] rounded-xl border-2 border-[#A03827] shadow-lg flex items-center gap-3 relative z-10">
        <span className="text-sm font-semibold text-[#1F105C] truncate max-w-[150px] sm:max-w-xs" title={currentGoalName || "No Goal Selected"}>
            {currentGoalName || "No Goal Selected"}
        </span>
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
// (BottomNav should remain the same as your provided version, it correctly uses currentGoal.status)
export function BottomNav({ router, currentGoal }: { router: any, currentGoal: UserGoal | null }) {
  const handlePlayClick = () => {
    if (!currentGoal) {
        // Optionally prompt user to select a goal if none is focused
        alert("Please select a goal first!");
        return;
    }
    if (currentGoal.status === 'completed' || currentGoal.status === 'failed_needs_retry') {
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
            disabled={!currentGoal} // Disable play if no goal is selected/focused
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