// app/dashboard/goal/page.tsx
"use client"

import { useEffect, useState, useCallback } from "react" // Import useCallback
import { useRouter, usePathname } from "next/navigation"
import Image from "next/image"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import SettingsDialog from "@/components/SettingsDialog"
import { OnboardingTour, tourStepsConfig } from "@/components/onboarding-tour"
import { QuestProgressBar } from "@/components/goalProgress"
import GoalDialog from "@/components/GoalDialog"
import { supabase } from "@/lib/supabase"
import { UserGoal } from "@/components/GoalDialog";

export default function GoalPage() {
  const [username, setUsername] = useState("")
  const [userId, setUserId] = useState<string | null>(null);
  const [avatar, setAvatar] = useState("")

  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [showTour, setShowTour] = useState(false)
  const [tourStep, setTourStep] = useState(0);

  const [isLoadingTour, setIsLoadingTour] = useState(true);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [isLoadingGoal, setIsLoadingGoal] = useState(true); // Loading state for focused goal


  interface UserGoal {
    id: number; name: string; description: string | null;
    user_goal_id: number | null; progress: number; dialogue_history: any | null;
  }
 const [selectedGoal, setSelectedGoal] = useState<UserGoal | null>(null);

  const router = useRouter()
  const pathname = usePathname()

  // --- Data Fetching ---
  useEffect(() => {
    const storedUsername = localStorage.getItem("username")
    const storedUserId = localStorage.getItem("userId");
    if (!storedUsername || !storedUserId) {
      console.log("Redirecting to login, missing username or userId");
      router.push("/")
      return
    }
    console.log(`GoalPage: Found username=${storedUsername}, userId=${storedUserId}`);
    setUsername(storedUsername);
    setUserId(storedUserId);

    fetchUserDataAndInitialGoal(storedUserId, storedUsername);
    fetchTourStatus(storedUsername); // Fetch tour status first
    fetchUserData(storedUsername);  // Fetch other user data

    // Check for tour resumption *after* fetching initial status potentially
    const savedStep = localStorage.getItem('onboardingStep');
    if (savedStep) {
        const stepNum = parseInt(savedStep, 10);
        console.log(`GoalPage: Resuming tour from step: ${stepNum}`);
        setTourStep(stepNum);
        localStorage.removeItem('onboardingStep');
    } else {
        console.log("GoalPage: No saved tour step found.");
    }

  }, [router]); // Run once on mount basically

  // Separate useEffect for pathname changes if needed, but base logic is on mount
  useEffect(() => {
      console.log("GoalPage: Pathname changed to", pathname);
      // If you need logic specific to pathname changes AFTER initial load, add here
  }, [pathname]);


  async function fetchUserData(name: string) {
    // ... (fetchUserData logic - unchanged) ...
    console.log("GoalPage: Fetching user data for", name);
     const { data, error } = await supabase
       .from("users")
       .select("avatar_path")
       .eq("name", name)
       .single()

     if (error) {
       console.error("Error fetching user data:", error.message)
       return
     }
     if (!data) {
         console.warn("No user data found for avatar.");
         return;
     }
     console.log("GoalPage: User data fetched, avatar:", data.avatar_path);
     setAvatar(data.avatar_path || "")
  }

  async function fetchTourStatus(name: string) {
     console.log("GoalPage: Fetching tour status for", name);
    setIsLoadingTour(true);
    try {
        const { data, error } = await supabase
            .from("users")
            .select("dashboard_tour_done")
            .eq("name", name)
            .single()

        if (error) throw error;

        if (data) {
            console.log(`GoalPage: Tour status=${data.dashboard_tour_done}`);
            setShowTour(!data.dashboard_tour_done);
        } else {
             console.warn("GoalPage: No tour status data found for user, assuming tour done.");
            setShowTour(false); // Or handle as needed, maybe assume not done for new users?
        }
    } catch (error: any) {
         console.error("Error fetching dashboard_tour_done:", error.message)
         setShowTour(false); // Default to false on error
    } finally {
         setIsLoadingTour(false);
          console.log("GoalPage: Finished fetching tour status.");
    }
  }

  // Combined initial data fetch
  async function fetchUserDataAndInitialGoal(uId: string, uName: string) {
    setIsLoadingGoal(true); // Start loading goal
    setIsLoadingTour(true); // Start loading tour status

    try {
        // Fetch user data including avatar and focused_goal_id
        const { data: userData, error: userError } = await supabase
            .from("users")
            .select("avatar_path, dashboard_tour_done, focused_goal_id") // Fetch all needed fields
            .eq("id", uId) // Fetch by ID is better
            .single();

        if (userError) throw userError;
        if (!userData) throw new Error("User data not found.");

        // Set avatar and tour status
        setAvatar(userData.avatar_path || "");
        setShowTour(!userData.dashboard_tour_done);

        // Now handle the focused goal
        if (userData.focused_goal_id) {
            console.log("GoalPage: User has focused_goal_id:", userData.focused_goal_id);
            // Fetch the details for the focused goal
            await fetchGoalDetails(uId, userData.focused_goal_id);
        } else {
            console.log("GoalPage: User has no focused_goal_id set.");
            setSelectedGoal(null); // Ensure it's null if no ID
            setIsLoadingGoal(false); // No goal to load
        }

    } catch (error: any) {
        console.error("Error fetching initial user data/goal:", error.message);
        setSelectedGoal(null); // Reset on error
        // Decide how to handle tour status on error
        setShowTour(false);
    } finally {
        // Only set tour loading false here, goal loading is handled within the flow
        setIsLoadingTour(false);
    }
}

// Function to fetch details of a specific goal for the user
async function fetchGoalDetails(uId: string, goalId: number) {
    setIsLoadingGoal(true);
    console.log(`GoalPage: Fetching details for goal ID: ${goalId} for user ID: ${uId}`);
    try {
        // We need goal name/description AND user's progress/dialogue for that goal
        // A JOIN or two separate queries. Let's use two for simplicity now.

        // 1. Get goal definition
        const { data: goalDef, error: goalDefError } = await supabase
            .from('goals')
            .select('id, name, description')
            .eq('id', goalId)
            .single();

        if (goalDefError) throw goalDefError;
        if (!goalDef) throw new Error(`Goal definition not found for ID: ${goalId}`);

        // 2. Get user-specific progress for this goal
        const { data: userGoalData, error: userGoalError } = await supabase
            .from('user_goals')
            .select('id, progress, dialogue_history') // Select user_goal id too
            .eq('user_id', uId)
            .eq('goal_id', goalId)
            .maybeSingle(); // Use maybeSingle as the entry might not exist yet

        if (userGoalError) throw userGoalError;

        // Combine into the UserGoal structure
        const goalDetails: UserGoal = {
            id: goalDef.id,
            name: goalDef.name,
            description: goalDef.description,
            user_goal_id: userGoalData?.id ?? null,
            progress: userGoalData?.progress ?? 0,
            dialogue_history: userGoalData?.dialogue_history ?? null,
        };

        console.log("GoalPage: Successfully fetched goal details:", goalDetails);
        setSelectedGoal(goalDetails);

    } catch (error: any) {
         console.error(`Error fetching details for goal ID ${goalId}:`, error.message);
         setSelectedGoal(null); // Reset on error
    } finally {
         setIsLoadingGoal(false); // Finish loading this specific goal
    }
}
  // --- Callbacks ---
  const handleFinishTourCallback = useCallback(() => {
    console.log("GoalPage: handleFinishTourCallback called (Tour finished/skipped).");
    setShowTour(false);
  }, []); // Empty dependency array as it only sets state

  // Renamed: This is called specifically when the tour finishes on the final click step
  const handleFinishTourAndOpenDialog = useCallback(() => {
      console.log("GoalPage: handleFinishTourAndOpenDialog called (Tour finished via final click).");
      setShowTour(false); // Ensure tour UI is hidden
      setShowGoalDialog(true); // Open the dialog
  }, []); // Empty dependency array

  const handleSettingsSave = (newAvatar: string, /*...*/) => {
    // ... (handleSettingsSave logic - unchanged) ...
    setAvatar(newAvatar)
    setShowSettingsDialog(false)
  }

  // This handler is now mainly for clicks OUTSIDE the tour context
  const handleGoalAreaClick = () => {
    // Check if the tour is ACTIVE and ON THE FINAL STEP. If so, the tour's internal listener handles it.
    // Otherwise (tour not active, or not on final step), open the dialog directly.
    const currentTourConfig = showTour ? tourStepsConfig[tourStep] : null;
    const isTourOnFinalClickStep = currentTourConfig?.isFinalClickStep && currentTourConfig.page === pathname;

    if (!isTourOnFinalClickStep) {
        console.log("Goal area clicked (outside of tour final step). Opening dialog.");
        setShowGoalDialog(true);
    } else {
         console.log("Goal area clicked (during tour final step) - Tour listener should handle finishing and opening dialog.");
         // The tour's internal click listener should have already fired (or will fire)
         // and called handleFinishTourAndOpenDialog.
    }
  };

  const handleGoalSelect = useCallback(async (goal: UserGoal) => {
    if (!userId) {
        console.error("GoalPage: Cannot update focused goal, userId is missing.");
        return;
    }
    console.log("GoalPage: Goal selected from dialog - ", goal.name);
    // 1. Optimistically update UI
    setSelectedGoal(goal);
    setShowGoalDialog(false); // Close the dialog

    // 2. Update the database asynchronously
    console.log(`GoalPage: Updating user ${userId} focused_goal_id to ${goal.id}`);
    const { error } = await supabase
        .from('users')
        .update({ focused_goal_id: goal.id })
        .eq('id', userId); // Use user's UUID

    if (error) {
        console.error("GoalPage: Error updating focused_goal_id in database:", error.message);
        // Optional: Revert UI or show error message
        // For simplicity, we won't revert the UI optimistic update now
         alert("Failed to save your focused goal. Please try again.");
    } else {
         console.log("GoalPage: Successfully updated focused_goal_id in database.");
    }

  }, [userId]); // Add userId dependency

  // --- Render ---
  return (
    <main
        // ... main attributes ...
         className="min-h-screen w-full overflow-x-hidden overflow-y-auto relative flex flex-col pb-24" // Ensure padding-bottom for nav
         style={{
            backgroundImage: "url('/dashboard/background_dashboard.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
        }}
    >
      {/* Header */}
      <header className="p-4 relative">
        <div className="absolute top-4 right-4 cursor-pointer" onClick={() => setShowSettingsDialog(true)}>
          {/* ... Avatar ... */}
          <Avatar className="w-10 h-10">
            {avatar ? (
              <AvatarImage src={avatar} alt={username} />
            ) : (
              <AvatarFallback>{username.charAt(0).toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 px-4"> {/* Removed pb-24 here */}
        {/* Game Name */}
        <div className="flex justify-center mt-8 mb-4"> {/* Added margin bottom */}
            <Image src="/game_name.png" alt="Game Name" width={220} height={60} priority /> {/* Added priority for LCP */}
        </div>

        {/* Quest Progress Bar - Show loading state */}
        <div
            id="goal-section-trigger"
            className={`mt-8 ${isLoadingGoal ? 'opacity-50' : 'cursor-pointer'}`} // Dim if loading
            onClick={!isLoadingGoal ? handleGoalAreaClick : undefined} // Disable click if loading
        >
          {isLoadingGoal ? (
             // Simple loading text or spinner for the progress bar area
             <div className="max-w-md mx-auto text-center p-10 bg-black/10 rounded-lg">
                <p className="text-white font-dashboard">Loading goal...</p>
             </div>
          ) : (
            <QuestProgressBar
                goal={selectedGoal?.name ?? "Not selected"}
                progress={selectedGoal?.progress ?? 0}
            />
           )}
        </div>

        {/* Log image */}
        {/* Consider if this log should display data related to the selected goal later */}
        <div className="flex justify-center mt-8">
          <Image src="/goal/log_temp.png" alt="Log Template" width={400} height={150} />
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
          {/* ... Navigation Bar structure (ensure paths and active states are correct) ... */}
           <div className="relative h-[75px] bg-[#82b266] rounded-t-[32px] flex items-center justify-around px-6">
              {/* Goal Page (Home) */}
              <button
                onClick={() => router.push("/dashboard/goal")} // Navigate to Goal page
                className={`flex flex-col items-center gap-1 pt-2 hover:scale-110 transition-transform ${
                  pathname === "/dashboard/goal" ? "text-[#1f105c]" : "text-white" // Active state check
                }`}
              >
                <div className="relative w-20 h-20">
                  <Image src="/dashboard/home_icon.png" alt="Home" fill style={{ objectFit: "contain" }} />
                </div>
              </button>

                {/* Game Button (Center) */}
                <div className="relative -top-8">
                    <button
                    onClick={() => router.push("/dashboard/game")}
                    className="relative w-24 h-24 bg-white rounded-full border-8 border-white flex items-center justify-center text-[#82b266] hover:scale-110 transition-transform"
                    >
                    <div className="relative w-24 h-24">
                        <Image src="/dashboard/game_icon.png" alt="Game" fill style={{ objectFit: "contain" }} />
                    </div>
                    </button>
                </div>

                {/* Business/Dashboard Page */}
                 <button
                    onClick={() => router.push("/dashboard")} // Navigate to Business page
                    className={`flex flex-col items-center gap-1 pt-2 hover:scale-110 transition-transform ${
                    pathname === "/dashboard" ? "text-[#1f105c]" : "text-white" // Active state check
                    }`}
                 >
                    <div className="relative w-20 h-20">
                    {/* Use appropriate icon for Business */}
                    <Image src="/dashboard/growth_icon.png" alt="Business" fill style={{ objectFit: "contain" }} />
                    </div>
                 </button>
            </div>
      </div>

      {/* Dialogs and Tour */}
      {showGoalDialog && userId && (
          <GoalDialog
            userId={userId}
            onClose={() => setShowGoalDialog(false)}
            onGoalSelect={handleGoalSelect} // <<< PASS THE HANDLER HERE
          />
       )}

      {/* Render Tour conditionally */}
      {!isLoadingTour && showTour && username && (
            <OnboardingTour
                key={pathname + tourStep} // Add tourStep to key to force re-render if step changes significantly? Test if needed.
                username={username}
                onFinish={handleFinishTourCallback} // General finish/skip
                initialStep={tourStep}
                onFinishAndOpenGoalDialog={handleFinishTourAndOpenDialog} // Specific callback for final click
            />
        )}

      {showSettingsDialog && (
          // ... SettingsDialog (unchanged) ...
            <SettingsDialog
            key={showSettingsDialog ? "open" : "closed"}
            username={username}
            initialAvatar={avatar}
            initialLanguage="english"
            initialSoundEnabled={true}
            onClose={() => setShowSettingsDialog(false)}
            onSave={handleSettingsSave}
            />
      )}
    </main>
  )
}