"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Header, BottomNav } from "@/app/dashboard/page";
import EthicalDecisionMakingWidget from "@/components/widgets/EthicalDecisionMakingWidget";
import RiskTakingAbilityWidget from "@/components/widgets/RiskTakingAbilityWidget";
import LockedWidget from "@/components/widgets/LockedWidget";
import { supabase } from "@/lib/supabase";
import { UserGoal } from "@/components/GoalDialog";

export default function GrowthPage() {
  const router = useRouter();

  const [username] = useState("Eduardo_Test");
  const [avatar, setAvatar] = useState("");
  const [goalPct] = useState(0);
  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userLives, setUserLives] = useState(3);

  // Fetch user's focused goal on mount
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) {
      router.push("/");
      return;
    }
    setUserId(storedUserId);

    const fetchData = async () => {
      try {
        // Fetch user details including focused_goal_id
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("focused_goal_id, lives")
          .eq("id", storedUserId)
          .single();

        if (userError) throw userError;

        if (userData?.focused_goal_id) {
          // Fetch details of the focused goal
          const { data: goalData, error: goalError } = await supabase
            .from("goals")
            .select("*, user_goals!inner(progress, dialogue_history, user_goal_id:id)")
            .eq("id", userData.focused_goal_id)
            .eq("user_goals.user_id", storedUserId)
            .single();

          if (goalError) {
            console.warn("Error fetching focused goal details:", goalError.message);
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
          }
        }
      } catch (error: any) {
        console.error("Error fetching dashboard data:", error.message);
      }
    };

    fetchData();
  }, [router]);

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
        onAvatarClick={() => {}}
        onLogClick={() => router.push("/dashboard/log")}
        onGoalEdit={() => {}}
      />

      <div className="flex-1 px-4 mt-10 space-y-10 mx-auto w-full max-w-[600px]">
        <EthicalDecisionMakingWidget positivePct={25} />
        <RiskTakingAbilityWidget score={100} />
        <LockedWidget titleSrc="/assets/Growth/ct_title.svg" />
        <LockedWidget titleSrc="/assets/Growth/aspi_title.svg" />
      </div>

      <BottomNav router={router} currentGoal={currentGoal} />
    </main>
  );
}
