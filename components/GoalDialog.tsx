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
import { Loader2, ChevronDown } from "lucide-react"; // For loading and dropdown arrow

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

// A self-contained, collapsible goal item component
const GoalItem = ({ goal, onSelect }: { goal: UserGoal; onSelect: (goal: UserGoal) => void; }) => {
  const [isOpen, setIsOpen] = useState(false);

  // This handler stops the click from bubbling up to the parent div
  // so that clicking the arrow only toggles the description.
  const handleToggleDescription = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevents the onSelect event from firing
    setIsOpen(!isOpen);
  };

  return (
    <div
      key={goal.id}
      className="bg-black/40 p-4 rounded-lg border border-amber-600/50 shadow-md hover:bg-black/60 hover:border-amber-500 transition-colors cursor-pointer"
      onClick={() => onSelect(goal)} // Select the goal when the item is clicked
    >
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-amber-100 font-dashboard">{goal.name}</h3>
        <ChevronDown
          className={`h-6 w-6 text-amber-100 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          onClick={handleToggleDescription} // Arrow click is handled separately
        />
      </div>

      {/* Collapsible content area */}
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
      if (!userId) {
        setError("User ID is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { data: goalsData, error: goalsError } = await supabase
          .from("goals")
          .select("id, name, description");

        if (goalsError) throw goalsError;
        if (!goalsData) throw new Error("No goals found.");

        const { data: userGoalsData, error: userGoalsError } = await supabase
          .from("user_goals")
          .select("id, goal_id, progress, dialogue_history")
          .eq("user_id", userId);

        if (userGoalsError) throw userGoalsError;

        const combinedGoals: UserGoal[] = goalsData.map((goal) => {
          const userGoal = userGoalsData?.find((ug) => ug.goal_id === goal.id);
          return {
            ...goal,
            user_goal_id: userGoal?.id || null,
            progress: userGoal?.progress || 0,
            dialogue_history: userGoal?.dialogue_history || null,
          };
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
        // This Tailwind arbitrary variant hides the default 'X' close button
        className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto [&>button]:hidden"
        style={{
          backgroundImage: 'url("/assets/Goals/Goals_BG/Goals_BG.png")',
          backgroundSize: "cover",
          color: "#FEECCF",
          // The border has been removed
        }}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-white font-dashboard text-2xl text-center">
            You can change your goal whenever you want
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 space-y-4">
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

        {/* The DialogFooter and its Close button have been completely removed */}
      </DialogContent>
    </Dialog>
  );
}