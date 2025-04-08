// components/GoalDialog.tsx
"use client"

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose, // Import DialogClose for a close button
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { QuestProgressBar } from "@/components/goalProgress"; // Reuse your progress bar
import { Loader2 } from "lucide-react"; // For loading state

interface Goal {
  id: number;
  name: string;
  description: string | null;
}

export interface UserGoal extends Goal {
  user_goal_id: number | null; // ID from user_goals table
  progress: number;
  dialogue_history: any | null; // Or a more specific type
}

interface GoalDialogProps {
  userId: string; // Pass the user ID to fetch their specific goal data
  onClose: () => void;
  onGoalSelect: (goal: UserGoal) => void;
}

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
        // 1. Fetch all goal definitions
        const { data: goalsData, error: goalsError } = await supabase
          .from("goals")
          .select("id, name, description");

        if (goalsError) throw goalsError;
        if (!goalsData) throw new Error("No goals found.");

        // 2. Fetch user's progress for these goals
        const goalIds = goalsData.map((g) => g.id);
        const { data: userGoalsData, error: userGoalsError } = await supabase
          .from("user_goals")
          .select("id, goal_id, progress, dialogue_history")
          .eq("user_id", userId)
          .in("goal_id", goalIds);

        if (userGoalsError) throw userGoalsError;

        // 3. Combine the data
        const combinedGoals: UserGoal[] = goalsData.map((goal) => {
          const userGoal = userGoalsData?.find((ug) => ug.goal_id === goal.id);
          return {
            ...goal,
            user_goal_id: userGoal?.id || null,
            progress: userGoal?.progress || 0, // Default progress to 0 if not found
            dialogue_history: userGoal?.dialogue_history || null,
          };
        });

        // Optional: If a user doesn't have an entry in user_goals for a specific goal,
        // create it now. This ensures all goals are listed.
        const missingGoalIds = goalIds.filter(gid => !userGoalsData?.some(ug => ug.goal_id === gid));
        if (missingGoalIds.length > 0) {
            console.log("GoalDialog: Found missing goal IDs for user:", missingGoalIds);
            const newEntries = missingGoalIds.map(goal_id => ({
                user_id: userId,
                goal_id: goal_id,
                progress: 0,
                dialogue_history: null
            }));

            // Use upsert with ignoreDuplicates instead of insert
            const { error: upsertError } = await supabase
                .from('user_goals')
                .upsert(newEntries, {
                    onConflict: 'user_id, goal_id', // Specify the columns causing potential conflict
                    ignoreDuplicates: true // <<< Change to true: If duplicate exists, do nothing
                 });


            if (upsertError) {
                // Log error but don't necessarily stop everything, maybe the fetch worked partially
                console.error("Error upserting missing user goals:", upsertError);
                // Avoid setting the main error state here unless it's critical
                // setError(`Failed to ensure all goals exist: ${upsertError.message}`);
            } else {
                console.log("GoalDialog: Successfully ensured goal entries exist for user.");
                // Important: Re-fetch data *after* ensuring entries exist to get accurate progress/ids
                // Or merge the newly created defaults into the existing state (simpler for now)

                // Let's merge the defaults into the combinedGoals for immediate display
                 missingGoalIds.forEach(missingId => {
                    const goalDef = goalsData.find(g => g.id === missingId);
                    if (goalDef && !combinedGoals.some(cg => cg.id === missingId)) {
                        combinedGoals.push({
                            ...goalDef,
                            user_goal_id: null, // We don't get the ID back from ignoreDuplicates upsert easily
                            progress: 0,
                            dialogue_history: null
                        });
                    }
                 });
                 // Optional: Sort goals if needed after adding missing ones
                 // combinedGoals.sort((a, b) => a.id - b.id);
            }
        } else {
             console.log("GoalDialog: No missing goal entries found for user.");
        }

        setUserGoals(combinedGoals); // Update state with combined/potentially augmented list

      } catch (err: any) {
        console.error("Error fetching goals:", err);
        setError(`Failed to load goals: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGoalsAndProgress();
  }, [userId]); // Re-run if userId changes

  // Handler function when a goal is clicked in the dialog
  const handleSelectGoal = (goal: UserGoal) => {
    console.log("GoalDialog: Selected goal:", goal.name);
    onGoalSelect(goal); // Call the callback passed from the parent
    // onClose(); // Let the parent decide if it closes (GoalPage will close it)
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto" // Adjust size, add scroll
        style={{
          backgroundImage: 'url("/dashboard/settings_texture.png")', // Same background
          backgroundSize: "cover",
          border: "4px solid #FCD34D", // Same border
          color: "white", // Default text color for contrast
        }}
        onInteractOutside={(e) => e.preventDefault()} // Prevent closing on outside click if desired
      >
        <DialogHeader>
          <DialogTitle className="text-white font-dashboard text-2xl">Your Learning Goals</DialogTitle>
          <DialogDescription className="text-gray-200 font-dashboard">
            Track your progress and review your learning journey for each goal.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
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
                <div
                  key={goal.id}
                  className="bg-black/40 p-4 rounded-lg border border-amber-600/50 shadow-md hover:bg-black/60 hover:border-amber-500 transition-colors cursor-pointer"
                  onClick={() => handleSelectGoal(goal)} // Add onClick handler (we'll define this next)
                >
                  <h3 className="text-lg font-semibold text-amber-100 font-dashboard mb-2">{goal.name}</h3>
                  <p className="text-sm text-gray-300 mb-2">{goal.description || "No description."}</p>
                  <div className="flex justify-between items-center mt-2 text-sm">
                      <span className="text-gray-400 font-dashboard">Progress:</span>
                      <span className="font-bold text-white font-dashboard">{goal.progress}%</span>
                  </div>
                   {/* Simple progress bar (optional) */}
                   <div className="w-full bg-gray-700/50 rounded-full h-2.5 mt-1">
                      <div
                          className="bg-gradient-to-r from-amber-300 to-amber-500 h-2.5 rounded-full"
                          style={{ width: `${goal.progress}%` }}
                      ></div>
                   </div>
  
                  {/* Placeholder for Dialogue History (optional here) */}
                  {/* <div className="mt-3 border-t border-amber-600/30 pt-2">
                      <p className="text-xs text-gray-400 font-dashboard italic">
                          {goal.dialogue_history ? "Interaction history available" : "No interaction history yet."}
                      </p>
                  </div> */}
                </div>
              ))
            )}
          </div>

        <DialogFooter className="mt-4">
           <DialogClose asChild>
             <Button
                variant="outline"
                className="px-4 py-2 border-2 border-amber-700 rounded shadow-lg bg-amber-900/80 text-white font-bold hover:bg-amber-800 active:bg-orange-500 transition-colors font-dashboard"
              >
               Close
             </Button>
           </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
