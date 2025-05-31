"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Header, BottomNav } from "@/app/dashboard/page";
import EthicalDecisionMakingWidget from "@/components/widgets/EthicalDecisionMakingWidget";
import RiskTakingAbilityWidget from "@/components/widgets/RiskTakingAbilityWidget";
import LockedWidget from "@/components/widgets/LockedWidget";
import { supabase } from "@/lib/supabase";
import { UserGoal } from "@/components/GoalDialog";
import GoalDialog from "@/components/GoalDialog";
import SettingsDialog from "@/components/SettingsDialog";
import { Loader2 } from "lucide-react";

// Interfaces
interface MetricDefinition {
  id: number;
  name: string;
  data_type: string;
  min_value: number | null;
  max_value: number | null;
  initial_value: number;
}

interface MetricScore {
  current_value: string;
  metrics: {
    name: string;
    initial_value: number;
  };
}

// Helper to fetch metric definitions
async function getMetricDefinitions(): Promise<MetricDefinition[]> {
  const { data: metricsData, error: metricsError } = await supabase
      .from('metrics')
      .select('id, name, data_type, min_value, max_value, initial_value');
  if (metricsError) {
    console.error("Failed to fetch metrics in getMetricDefinitions:", metricsError.message)
    return []; 
  }
  return (metricsData || []).map(m => ({ ...m, initial_value: Number(m.initial_value) })) as MetricDefinition[];
}

export default function GrowthPage() {
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

  // Metric states
  const [ethicalDecisionMaking, setEthicalDecisionMaking] = useState(50);
  const [riskTakingAbility, setRiskTakingAbility] = useState(50);

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

  // Memoized fetchData to prevent re-creation on every render
  const fetchData = useCallback(async (currentUserId: string) => {
    console.log("Growth page fetchData triggered for user:", currentUserId);
    setIsLoadingPageData(true);

    try {
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("avatar_path, focused_goal_id, lives")
        .eq("id", currentUserId)
        .single();

      if (userError) {
        console.error("Error fetching user data in growth page:", userError);
        if (userError.code === 'PGRST116') {
            console.log("User not found in DB, redirecting to login.");
            router.push('/'); 
        }
        setIsLoadingPageData(false);
        return; 
      }
      
      setAvatar(userData.avatar_path || "");
      setUserLives(userData.lives ?? 3);

      let shouldShowGoalDialogInitially = false;
      if (searchParams.get('showGoalDialog') === 'true') {
        console.log("Growth: showGoalDialog query param is true.");
        shouldShowGoalDialogInitially = true;
        setCurrentGoal(null);
        router.replace('/dashboard/growth', { scroll: false });
      } else if (!userData.focused_goal_id) {
        console.log("Growth: No focused goal ID for user.");
        shouldShowGoalDialogInitially = true;
        setCurrentGoal(null);
      } else {
        console.log("Growth: User has focused_goal_id:", userData.focused_goal_id);
        const { data: goalDetails, error: goalDetailsError } = await supabase
          .from("goals")
          .select(`
            id, name, description,
            user_goals!inner (
              user_goal_id:id, progress, status, dialogue_history, attempts_for_current_goal_cycle
            )
          `)
          .eq("id", userData.focused_goal_id)
          .eq("user_goals.user_id", currentUserId)
          .single();

        if (goalDetailsError || !goalDetails) {
          console.warn("Growth: Focused goal details not found or user_goals entry missing. Showing dialog.", goalDetailsError?.message);
          shouldShowGoalDialogInitially = true;
          setCurrentGoal(null);
        } else {
          console.log("Growth: Successfully fetched focused goal details:", goalDetails.name);
          const ugEntry = goalDetails.user_goals[0];
          setCurrentGoal({
            id: goalDetails.id,
            name: goalDetails.name,
            description: goalDetails.description,
            user_goal_id: ugEntry.user_goal_id,
            progress: ugEntry.progress,
            status: ugEntry.status,
            dialogue_history: ugEntry.dialogue_history,
          });
        }
      }

      if (!showGoalDialog) {
        setShowGoalDialog(shouldShowGoalDialogInitially);
      }

      // Fetch User Metric Scores for Widgets
      const { data: metricScores, error: metricsError } = await supabase
        .from('user_metric_scores')
        .select('current_value, metrics!inner(name, initial_value)')
        .eq('user_id', currentUserId);

      if (metricsError) {
        console.error("Error fetching user metric scores for growth page:", metricsError);
      } else {
        let edmScore = 50;   // Default
        let rtaScore = 50;   // Default

        const metricDefinitions = await getMetricDefinitions();

        ((metricScores || []) as unknown as MetricScore[]).forEach(score => {
            const metricName = score.metrics.name;
            const value = parseFloat(score.current_value);

            if (metricName === 'Ethical Decision Making') edmScore = value;
            else if (metricName === 'Risk-Taking') rtaScore = value;
        });
        setEthicalDecisionMaking(edmScore);
        setRiskTakingAbility(rtaScore);
        console.log("Growth: Updated widget data - EDM:", edmScore, "RTA:", rtaScore);
      }

    } catch (error: any) {
      console.error("Error in fetchData (growth):", error.message);
    } finally {
      setIsLoadingPageData(false);
      console.log("Growth fetchData finished.");
    }
  }, [router, searchParams]);

  // Effect 2: Fetch data when userIdFromStorage is available
  useEffect(() => {
    if (userIdFromStorage) {
      fetchData(userIdFromStorage);
    } else {
      if (!localStorage.getItem("userId")) {
          setIsLoadingPageData(false);
      }
    }
  }, [userIdFromStorage, fetchData]);

  const goalPct = currentGoal?.progress ?? 0;

  // Loading state display
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

  return (
    <main
      className="min-h-screen w-full overflow-x-hidden overflow-y-auto pb-[120px] flex flex-col"
      style={{ background: "url('/assets/Background/PNG/Fixed Background.png') center/cover" }}
    >
      <Header
        username={username}
        avatar={avatar}
        goalPct={goalPct}
        currentGoalName={currentGoal?.name}
        userLives={userLives}
        onAvatarClick={() => setShowSettingsDialog(true)}
        onLogClick={() => router.push("/dashboard/log")}
        onGoalEdit={() => setShowGoalDialog(true)}
      />

      <div className="flex-1 px-4 mt-10 space-y-10 mx-auto w-full max-w-[600px]">
        <EthicalDecisionMakingWidget positivePct={ethicalDecisionMaking} />
        <RiskTakingAbilityWidget score={riskTakingAbility} />
        <LockedWidget titleSrc="/assets/Growth/ct_title.svg" />
        <LockedWidget titleSrc="/assets/Growth/aspi_title.svg" />
      </div>

      <BottomNav router={router} currentGoal={currentGoal} />

      {showGoalDialog && userIdFromStorage && (
        <GoalDialog
            userId={userIdFromStorage}
            onClose={() => {
                setShowGoalDialog(false);
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
          initialAvatar={avatar}
          initialLanguage="english"
          initialSoundEnabled={true}
          onClose={() => setShowSettingsDialog(false)}
          onSave={async (newAvatar, newLang, newSound) => {
            setAvatar(newAvatar);
            // TODO: Update user settings in DB here
          }}
        />
      )}
    </main>
  );
}
