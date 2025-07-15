// components/GoalDialog.tsx
"use client"

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { Loader2, ChevronDown } from "lucide-react";

// ... (interfaces Goal, UserGoal, GoalDialogProps remain the same) ...
interface Goal {
  id: number;
  name: string;
  description: string | null;
}

export interface UserGoal extends Goal {
  user_goal_id: number | null;
  progress: number;
  dialogue_history: any | null;
  status?: string;
}

interface GoalDialogProps {
  userId: string;
  onClose: () => void;
  onGoalSelect: (goal: UserGoal) => void;
}

// GoalItem component remains the same
const GoalItem = ({ goal, onSelect }: { goal: UserGoal; onSelect: (goal: UserGoal) => void; }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggleDescription = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  return (
    <div
      key={goal.id}
      className="bg-black/40 p-4 rounded-lg border border-amber-600/50 shadow-md hover:bg-black/60 hover:border-amber-500 transition-colors cursor-pointer"
      onClick={() => onSelect(goal)}
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-amber-100 font-dashboard">{goal.name}</h3>
        <ChevronDown
          className={`h-6 w-6 text-amber-100 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          onClick={handleToggleDescription}
        />
      </div>
      {isOpen && (
        <div className="mt-4 pt-4 border-t border-amber-600/30">
          <p className="text-sm text-gray-300">{goal.description || "No description available."}</p>
        </div>
      )}
    </div>
  );
};


export default function GoalDialog({ userId, onClose, onGoalSelect }: GoalDialogProps) {
  const [userGoals, setUserGoals] = useState<UserGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGoalsAndProgress = async () => {
      // ... (fetch logic remains the same) ...
      if (!userId) {
        setError("User ID is missing.");
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const { data: goalsData, error: goalsError } = await supabase.from("goals").select("id, name, description");
        if (goalsError) throw goalsError;
        if (!goalsData) throw new Error("No goals found.");
        const { data: userGoalsData, error: userGoalsError } = await supabase.from("user_goals").select("id, goal_id, progress, dialogue_history").eq("user_id", userId);
        if (userGoalsError) throw userGoalsError;
        const combinedGoals: UserGoal[] = goalsData.map((goal) => {
          const userGoal = userGoalsData?.find((ug) => ug.goal_id === goal.id);
          return { ...goal, user_goal_id: userGoal?.id || null, progress: userGoal?.progress || 0, dialogue_history: userGoal?.dialogue_history || null };
        });
        setUserGoals(combinedGoals);
      } catch (err: any) {
        console.error("Error fetching goals:", err);
        setError(`Failed to load goals: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGoalsAndProgress();
  }, [userId]);

  const handleSelectGoal = (goal: UserGoal) => {
    console.log("GoalDialog: Selected goal:", goal.name);
    onGoalSelect(goal);
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="w-[90%] sm:max-w-[700px] max-h-[80vh] p-0 rounded-lg [&>button]:hidden"
        style={{
          backgroundImage: 'url("/assets/Goals/Goals_BG/Goals_BG.png")',
          backgroundSize: "cover",
          backgroundPosition: "center", // Helps center the image
          color: "#FEECCF",
          border: "none",
          overflow: "hidden", // This is key to clipping the background to the rounded corners
        }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* We wrap everything in a flex column to control layout */}
        <div className="flex flex-col h-full">
            <div className="p-6 pb-2"> {/* Add padding back to the header area */}
                <DialogHeader>
                    <DialogTitle className="text-white font-dashboard text-2xl text-center">
                        You can change your goal whenever you want
                    </DialogTitle>
                </DialogHeader>
            </div>

            {/* This inner div is now responsible for scrolling */}
            <div className="flex-1 p-6 pt-4 space-y-4 overflow-y-auto">
                {isLoading ? (
                    <div className="flex justify-center items-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                    <p className="ml-2 font-dashboard">Loading Goals...</p>
                    </div>
                ) : error ? (
                    <p className="text-red-400 font-dashboard text-center">{error}</p>
                ) : userGoals.length === 0 ? (
                    <p className="text-gray-300 font-dashboard text-center">No goals available yet.</p>
                ) : (
                    userGoals.map((goal) => (
                    <GoalItem key={goal.id} goal={goal} onSelect={handleSelectGoal} />
                    ))
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}