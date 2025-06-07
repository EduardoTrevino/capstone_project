"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from 'react';
import DecisionProgressBar from "@/components/DecisionProgressBar";
import { ChatMessage } from "@/components/ChatMessage";
import { supabase } from "@/lib/supabase"; // Import Supabase clien
import { useSearchParams } from 'next/navigation'; // For reading query params
import { Loader2 } from 'lucide-react'; // If not already imported

export const maxDuration = 300;

interface NarrativeDialogue {
  character: "Rani" | "Ali" | "Santosh" | "Manju" | "Rajesh" | "Narrator";
  pfp: string;
  text: string;
}
interface DecisionPointOption { text: string; }
interface DecisionPoint { question: string; options: DecisionPointOption[]; }
interface ScenarioStep {
  narrativeSteps: NarrativeDialogue[];
  mainCharacterImage: string | null;
  decisionPoint: DecisionPoint | null;
  scenarioComplete: boolean;
  error?: string;
}
interface DisplayMessage {
  id: number;
  character: string;
  pfp: string | null;
  text: string;
  isDecision?: boolean;
}

// Interface for the data expected in the summary
interface ScenarioSummary {
  metricChanges: Array<{ metricName: string; change: number; unit: string; finalValue: number }>;
  goalStatus: string; // e.g., 'active', 'completed', 'failed_needs_retry'
  currentGoalProgress: number;
  scenarioAttemptNumber: number; // The attempt number that was just completed
}

// --- Helper Function to Map Character Name to Image Path (Unchanged) ---
const getCharacterImagePath = (characterName: string | null): string | null => {
    if (!characterName) return null;
    const basePath = '/game/characters/';
    switch (characterName.toLowerCase()) {
        case 'rani':      return `${basePath}rani.png`;
        case 'ali':       return `${basePath}ali.png`;
        case 'santosh':      return `${basePath}santosh.png`;
        case 'manju':     return `${basePath}manju.png`;
        case 'rajesh':     return `${basePath}rajesh.png`;
        case 'narrator':  return null; // Assuming you might want a narrator image
        default:
            console.warn(`Mapping not found for character image: ${characterName}`);
            return null; // Return null for narrator or unknown characters
    }
};

// Add this CSS animation at the top of the file, after the imports
const pulseAnimation = `
@keyframes pulse-subtle {
  0% {
    opacity: 0.6;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  }
  50% {
    opacity: 1;
    text-shadow: 0 0 20px rgba(255, 255, 255, 0.6);
  }
  100% {
    opacity: 0.6;
    text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
  }
}

.animate-pulse-subtle {
  animation: pulse-subtle 2s ease-in-out infinite;
}
`;

export default function NarrativeGamePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // --- State ---
  const [currentStepData, setCurrentStepData] = useState<ScenarioStep | null>(null);
  const [staggeredMessages, setStaggeredMessages] = useState<DisplayMessage[]>([]);
  const [messageQueue, setMessageQueue] = useState<NarrativeDialogue[]>([]);
  const [showInteractionArea, setShowInteractionArea] = useState(false);
  const [goalDescriptionForLoading, setGoalDescriptionForLoading] = useState<string | null>(null);
  const [gameBackground] = useState<string>("/game/bgs/bg_1.png");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [mainCharacterImage, setMainCharacterImage] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecisionOption, setSelectedDecisionOption] = useState<number | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [decisionCount, setDecisionCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  // Add new state for scenario summary data
  const [scenarioSummaryData, setScenarioSummaryData] = useState<ScenarioSummary | null>(null);
  const [showSummaryScreen, setShowSummaryScreen] = useState(false);
  const [currentFocusedGoalId, setCurrentFocusedGoalId] = useState<number | null>(null);
  const [currentGoalName, setCurrentGoalName] = useState<string | null>(null); // For summary title

  // --- Refs ---
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const messageIdCounter = useRef(0);

  // --- Effects ---

  // Initial load
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) {
      console.error("User ID not found, redirecting.");
      router.push("/");
      return;
    }
    setUserId(storedUserId);
    // Reset game state for a fresh load or goal switch
    setCurrentStepData(null);
    setStaggeredMessages([]);
    setMessageQueue([]);
    setShowInteractionArea(false);
    setMainCharacterImage(null);
    setError(null);
    setSelectedDecisionOption(null);
    setDecisionCount(0);
    setIsComplete(false);
    setShowSummaryScreen(false);
    setScenarioSummaryData(null);
    setIsLoadingApi(false);
    setIsInitialLoading(true);

    const goalStatusFromQuery = searchParams.get('status');
    const goalIdFromQuery = searchParams.get('goalId');

    async function initializeGamePage() {
      let focusedGoalIdToLoad: number | null = null;
      try {
        // Determine the goal to load/summarize
        if (goalIdFromQuery && (goalStatusFromQuery === 'completed' || goalStatusFromQuery === 'failed_needs_retry')) {
          focusedGoalIdToLoad = parseInt(goalIdFromQuery);
        } else {
          const { data: userData, error: userErr } = await supabase.from('users').select('focused_goal_id').eq('id', storedUserId).single();
          if (userErr || !userData?.focused_goal_id) throw new Error("User has no focused goal or error fetching user.");
          focusedGoalIdToLoad = userData.focused_goal_id;
        }
        
        if (!focusedGoalIdToLoad) throw new Error("Could not determine goal to load.");
        setCurrentFocusedGoalId(focusedGoalIdToLoad);

        const { data: goalData, error: goalErr } = await supabase.from('goals').select('name, description').eq('id', focusedGoalIdToLoad).single();
        if (goalErr || !goalData) throw new Error(`Could not fetch goal details for ID ${focusedGoalIdToLoad}.`);
        setGoalDescriptionForLoading(goalData.description || "No description.");
        setCurrentGoalName(goalData.name);

        if (goalStatusFromQuery === 'completed' || goalStatusFromQuery === 'failed_needs_retry') {
          // Show summary for already completed/failed goal
          const { data: userGoalEntry, error: ugError } = await supabase
              .from('user_goals')
              .select('dialogue_history, status, progress, attempts_for_current_goal_cycle')
              .eq('user_id', storedUserId)
              .eq('goal_id', focusedGoalIdToLoad)
              .single();

          if (ugError || !userGoalEntry) throw new Error("Could not load prior game summary data.");

          // For metric changes, ideally this would be stored, or we reconstruct/show a generic message
          setScenarioSummaryData({
              metricChanges: [], // Or try to parse from last dialogue if you store it there
              goalStatus: userGoalEntry.status,
              currentGoalProgress: userGoalEntry.progress,
              scenarioAttemptNumber: userGoalEntry.attempts_for_current_goal_cycle,
          });
          setShowSummaryScreen(true);
          setIsComplete(true); // Mark as "done" for UI logic
          setIsInitialLoading(false);
        } else {
          // Regular scenario load for an active goal
          loadScenarioStep(null, storedUserId);
        }
      } catch (e: any) {
        console.error("Error during game page initialization:", e.message);
        setError(`Initialization Error: ${e.message}`);
        setGoalDescriptionForLoading("Error loading details."); // Show error in loading screen
        setIsInitialLoading(false); // Stop loading on error
      }
    }
    initializeGamePage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, router]);

  // Handle new scenario step data
  useEffect(() => {
    if (isLoadingApi) return; // Don't process if API is currently loading a new step

    if (currentStepData) { // We have new step data
        if (isInitialLoading) setIsInitialLoading(false); // Turn off initial loader if it was on
        
        setShowInteractionArea(false);

        let stepImage = currentStepData.mainCharacterImage; // Prefer direct image
        if (!stepImage && currentStepData.narrativeSteps?.[0]) {
           stepImage = getCharacterImagePath(currentStepData.narrativeSteps[0].character);
        }
        if (stepImage !== mainCharacterImage) setMainCharacterImage(stepImage);
        if (currentStepData.decisionPoint) setSelectedDecisionOption(null);

        if (currentStepData.narrativeSteps?.length > 0) {
          setMessageQueue([...currentStepData.narrativeSteps]);
        } else { // No narrative steps from AI for this turn
          setMessageQueue([]);
          if (currentStepData.decisionPoint && !currentStepData.scenarioComplete) {
              setTimeout(() => setShowInteractionArea(true), 50);
          } else if (currentStepData.scenarioComplete && scenarioSummaryData) {
              // Scenario is complete by AI AND no narrative steps AND summary data is ready
              setIsComplete(true);
              setShowSummaryScreen(true);
          } else if (currentStepData.scenarioComplete && !scenarioSummaryData) {
              console.warn("Scenario complete but summary data not yet processed. Waiting for loadScenarioStep to set it.");
              // This case should be rare if loadScenarioStep always sets summaryData on complete
          }
        }
        if (currentStepData.scenarioComplete) setIsComplete(true); // Mark internal flag
    } else if (error && !isLoadingApi) { // Error occurred, and not currently loading new data
        if (isInitialLoading) setIsInitialLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepData, error, isLoadingApi]);

  // Auto-scroll chat
  useEffect(() => {
    // Add a slight delay to allow the new ChatMessage component's layout shift
    const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 100); // Adjust delay as needed
    return () => clearTimeout(timer);
  }, [staggeredMessages]);

  // --- Core Logic Functions ---

  const loadScenarioStep = useCallback(async (decisionIndexParam: number | undefined | null, uid: string | null) => {
    if (!uid) {
      setError("User ID is missing.");
      setIsInitialLoading(false);
      return;
    }
    setIsLoadingApi(true);
    setError(null);
    setShowInteractionArea(false);
    setMessageQueue([]);
    // Do not set setIsInitialLoading(false) here, it's handled by the useEffect watching currentStepData/error

    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, decisionIndex: decisionIndexParam })
      });
      const responseText = await res.text();
      if (!res.ok) {
        let errorMessage = `HTTP error! status: ${res.status}`;
        try { errorMessage = JSON.parse(responseText).error || responseText; } catch { /* use default */ }
        throw new Error(errorMessage);
      }
      const data = JSON.parse(responseText);
      if (data.error) throw new Error(data.error);

      setCurrentStepData(data.scenarioStep);
      setDecisionCount(data.currentDecisionCountInScenario || 0);

      if (data.scenarioStep.scenarioComplete) {
        setScenarioSummaryData({
            metricChanges: data.metricChangesSummary || [],
            goalStatus: data.goalStatusAfterStep,
            currentGoalProgress: data.currentGoalProgress,
            scenarioAttemptNumber: data.scenarioAttemptNumber,
        });
      } else {
        setScenarioSummaryData(null); // Clear if not complete
        setShowSummaryScreen(false);  // Hide summary if starting/continuing scenario
      }

    } catch (err: any) {
      console.error("loadScenarioStep error:", err);
      setError(err.message || "Failed to load step.");
      setCurrentStepData(null);
    } finally {
      setIsLoadingApi(false);
      // isInitialLoading is set to false in the useEffect watching currentStepData or error
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNextStep = useCallback(() => {
    if (isLoadingApi || messageQueue.length === 0) return;

    setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const nextMessageToShow = queue.shift();

        if (nextMessageToShow) {
            const charImage = getCharacterImagePath(nextMessageToShow.character);
            setMainCharacterImage(charImage);

            setStaggeredMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.text === nextMessageToShow.text && lastMsg.character === nextMessageToShow.character && !lastMsg.isDecision) {
                    return prev;
                }
                return [...prev, {
                    id: messageIdCounter.current++,
                    character: nextMessageToShow.character,
                    pfp: nextMessageToShow.pfp,
                    text: nextMessageToShow.text,
                    isDecision: false
                }];
            });

            if (queue.length === 0) {
                if (currentStepData?.decisionPoint && !currentStepData.scenarioComplete) {
                     // Don't show interaction area immediately, wait for next tap
                     setShowInteractionArea(false);
                } else if (currentStepData?.scenarioComplete && scenarioSummaryData) {
                     setTimeout(() => {
                        setShowInteractionArea(false);
                        setShowSummaryScreen(true);
                     }, 100);
                }
            } else {
                 setShowInteractionArea(false);
            }

            return queue;
        }
        return queue;
    });
  }, [isLoadingApi, messageQueue, currentStepData, scenarioSummaryData]);

  const handleScreenClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
       const target = event.target as HTMLElement;
       if (target.closest('button, a, [data-interactive="true"]')) {
           return;
       }
       if (!isLoadingApi && messageQueue.length > 0) {
           handleNextStep();
       } else if (!isLoadingApi && messageQueue.length === 0 && currentStepData?.decisionPoint && !showInteractionArea) {
           // Show interaction area on tap when there are no more messages
           setShowInteractionArea(true);
       }
   }, [isLoadingApi, messageQueue, showInteractionArea, handleNextStep, currentStepData]);

  function handleSelectDecisionOption(index: number) {
    if (isLoadingApi || !showInteractionArea) return;
    setSelectedDecisionOption(index);
  }

  async function submitDecision() {
    if (selectedDecisionOption === null || !userId || isLoadingApi) return;
    const decisionIndexToSubmit = selectedDecisionOption;
    const choiceText = currentStepData?.decisionPoint?.options[decisionIndexToSubmit]?.text || '';

    // Add user's choice message using the OLD style
    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++, character: "User", pfp: null, text: `I choose: "${choiceText}"`, isDecision: true
    }]);
    setSelectedDecisionOption(null);
    await loadScenarioStep(decisionIndexToSubmit, userId);
  }

  // --- New Handlers for Summary Screen Buttons ---
  const handleNextScenario = async () => {
    if (!userId || !currentFocusedGoalId) return;
    console.log("handleNextScenario called");

    setIsInitialLoading(true);
    setCurrentStepData(null);
    setStaggeredMessages([]);
    setMessageQueue([]);
    setShowInteractionArea(false);
    setMainCharacterImage(null);
    setError(null);
    setSelectedDecisionOption(null);
    setIsComplete(false);
    setShowSummaryScreen(false);
    setScenarioSummaryData(null);
    
    await loadScenarioStep(null, userId);
  };

  const handleSelectNewGoal = () => {
    router.push("/dashboard?showGoalDialog=true");
  };

  const handleEndScenario = () => {
    router.push("/dashboard");
  };

  // --- Visibility Flags ---
  const isShowingDecisionOpt = showInteractionArea && !showSummaryScreen && currentStepData?.decisionPoint && !isComplete;

  // --- Calculate currentStep for new ProgressBar (4 steps: D1, D2, D3, Finish) ---
  let progressBarCurrentStep = decisionCount + 1; // If decisionCount is 0 (start), step is 1. If 1, step 2 etc.
  if (isComplete || decisionCount >= 3) { // isComplete flag also set when scenarioComplete from API
      progressBarCurrentStep = 4;
  }
  progressBarCurrentStep = Math.min(4, Math.max(1, progressBarCurrentStep));

  // --- Render ---

  if (error && !isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 text-gray-800">
        <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-md border border-red-300">
          <h2 className="text-xl font-semibold text-red-700 mb-4">An Error Occurred</h2>
          <p className="text-red-600 mb-5">{error}</p>
          <button onClick={handleEndScenario} className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

   if (isInitialLoading && !showSummaryScreen) {
    return (
      <div
        className="flex items-center justify-center min-h-screen w-full p-4"
        style={{
          background: `url('${gameBackground}') center/cover no-repeat`,
        }}
      >
        {goalDescriptionForLoading ? (
          <div
            className="bg-[#FEECCF] text-black p-6 md:p-8 rounded-xl shadow-2xl max-w-lg text-center animate-fade-in"
          >
            <h2 className="text-2xl font-bold mb-4">Your Current Goal:</h2>
            <p className="text-md leading-relaxed">{goalDescriptionForLoading}</p>
            {isLoadingApi ? (
              <div className="mt-6 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-t-2 border-gray-700"></div>
                <p className="ml-3 text-gray-700 font-semibold">Loading scenario...</p>
              </div>
            ) : (
              <div className="mt-6">
                <p className="text-lg font-semibold text-[#A03827] animate-pulse-subtle">
                  Tap anywhere to play
                </p>
              </div>
            )}
          </div>
        ) : (
          // Fallback if goal description is still loading or failed before scenario load starts
          <div className="flex flex-col items-center justify-center text-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-xl font-semibold">Loading Game...</p>
          </div>
        )}
      </div>
    );
  }

  if (showSummaryScreen && scenarioSummaryData) {
    const { metricChanges, goalStatus, currentGoalProgress, scenarioAttemptNumber } = scenarioSummaryData;
    const goalCompletedOverall = goalStatus === 'completed';
    const maxAttemptsForGoalCycle = 3;
    const attemptsUsed = scenarioAttemptNumber;
    const canPlayNextScenario = !goalCompletedOverall && attemptsUsed < maxAttemptsForGoalCycle;

    return (
        <div
            className="absolute inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-sm bg-black/30"
            style={{
                backgroundImage: `url('${gameBackground!}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
            }}
        >
            <div className="bg-[#FEECCF] text-black p-6 md:p-8 rounded-xl shadow-2xl max-w-lg w-full text-center animate-fade-in">
                <h2 className="text-2xl font-bold mb-2 text-[#A03827]">
                    {goalCompletedOverall ? `${currentGoalName || 'Goal'} Achieved!` : `Scenario ${attemptsUsed} Complete!`}
                </h2>
                <p className="text-sm text-gray-700 mb-4">
                    Overall Goal Progress: <span className="font-semibold">{currentGoalProgress}%</span>
                </p>

                {metricChanges && metricChanges.length > 0 ? (
                    <div className="my-4 text-left space-y-1 max-h-48 overflow-y-auto p-2 border border-gray-300 rounded-md bg-white/50">
                        <p className="font-semibold mb-2 text-gray-800">Performance This Scenario:</p>
                        {metricChanges.map((mc, index) => (
                            <p key={index} className={`text-sm ${mc.change >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                {mc.metricName}: {mc.change >= 0 ? '+' : ''}{mc.change % 1 !== 0 ? mc.change.toFixed(2) : mc.change}{mc.unit}
                                <span className="text-xs text-gray-500 ml-2">(Now: {mc.finalValue % 1 !== 0 ? mc.finalValue.toFixed(2) : mc.finalValue}{mc.unit})</span>
                            </p>
                        ))}
                    </div>
                ) : (
                    <p className="my-4 text-sm text-gray-600">No direct metric changes recorded this scenario, but your choices are shaping your journey!</p>
                )}

                {goalCompletedOverall && (
                    <p className="my-4 font-semibold text-green-600">Congratulations! You've successfully completed the goal: "{currentGoalName || 'This Goal'}"!</p>
                )}
                {!goalCompletedOverall && attemptsUsed < maxAttemptsForGoalCycle && (
                     <p className="my-4 text-sm text-gray-700">You have {maxAttemptsForGoalCycle - attemptsUsed} scenario(s) remaining for this goal.</p>
                )}
                 {!goalCompletedOverall && attemptsUsed >= maxAttemptsForGoalCycle && (
                     <p className="my-4 text-sm text-red-600">You've used all scenarios for this goal attempt. You can retry the goal from the dashboard if you have lives.</p>
                )}

                <div className="mt-6 space-y-3">
                    <button
                        onClick={handleEndScenario}
                        className="w-full px-6 py-2.5 bg-gray-500 text-white rounded-lg text-sm font-bold hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out"
                    >
                        Return to Dashboard
                    </button>

                    {goalCompletedOverall ? (
                        <button
                            onClick={handleSelectNewGoal}
                            className="w-full px-6 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out"
                        >
                            Select a New Goal
                        </button>
                    ) : (
                        canPlayNextScenario && (
                            <button
                                onClick={handleNextScenario}
                                className="w-full px-6 py-2.5 bg-green-500 text-white rounded-lg text-sm font-bold hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-400 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out"
                            >
                                Next Scenario
                            </button>
                        )
                    )}
                </div>
            </div>
        </div>
    );
  }

  // Main Game UI
  return (
    <div
      className="relative w-full h-screen flex flex-col overflow-hidden bg-gray-800"
      style={{ backgroundImage: `url('${gameBackground!}')`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <style>{pulseAnimation}</style>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4">
        <DecisionProgressBar currentStep={progressBarCurrentStep} />
        <div className="shrink-0 p-2 rounded-full cursor-pointer hover:bg-white/20 transition-colors" data-interactive="true">
          <Image src="/game/book.png" alt="Scenario Log" width={28} height={28} />
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-grow flex flex-col pt-16 md:pt-20 overflow-hidden cursor-pointer"
        onClick={handleScreenClick}
      >
        {/* Chat History Area */}
        <div className="flex-grow overflow-y-auto p-3 md:p-4 pb-24 md:pb-28 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent">
          {staggeredMessages.map(msg => (
            msg.character === "User" ? (
              <div key={msg.id} className={`flex items-end gap-2 justify-end animate-fade-in-short mb-6`}>
                <div className="w-8 md:w-10 shrink-0"></div>
                <div className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md bg-[#BBD9A1] text-[#214104] rounded-br-none`}>
                  <p className={`text-sm leading-relaxed break-words`}>{msg.text}</p>
                </div>
              </div>
            ) : (
              <ChatMessage
                key={msg.id}
                message={msg.text}
                name={msg.character}
                avatarUrl={msg.pfp || ''}
                className="animate-fade-in-short mb-14"
              />
            )
          ))}
          {isLoadingApi && !isInitialLoading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400"/>
              <span className="text-sm text-gray-400 italic ml-2">Loading...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Area */}
        <div className="relative flex-shrink-0 h-[40vh] md:h-[45vh]">
            {/* Character Image Area */}
            <div className="absolute inset-0 flex justify-start items-end pointer-events-none pb-2 md:pb-4 pl-4">
              {mainCharacterImage && (
                  <Image
                      key={mainCharacterImage}
                      src={mainCharacterImage}
                      alt="Current Character"
                      width={350}
                      height={500}
                      className="object-contain max-h-full animate-fade-in drop-shadow-lg"
                      priority
                  />
              )}
            </div>
            
            {/* Interaction Area Container */}
            <div
               className={`absolute inset-x-0 bottom-0 p-3 z-10 flex flex-col justify-end items-center
                           transition-opacity duration-300 ease-in-out ${
                           isShowingDecisionOpt ? "opacity-100" : "opacity-0 pointer-events-none"
                           }`}
               onClick={(e) => e.stopPropagation()}
               style={{ cursor: 'default' }}
               data-interactive="true"
            >
                <div className={`w-full max-w-xl mx-auto space-y-3 p-4 rounded-lg bg-[#66943C] backdrop-blur-sm shadow-lg`}>
                  {isShowingDecisionOpt && currentStepData?.decisionPoint && (
                    <>
                      <p className="font-semibold text-sm mb-3 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] px-2">
                        {currentStepData.decisionPoint.question}
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentStepData.decisionPoint.options.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSelectDecisionOption(idx)}
                            className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none ${
                              selectedDecisionOption === idx
                                ? "border-yellow-400 bg-yellow-500/30 shadow-lg scale-[1.03] text-yellow-100 ring-2 ring-yellow-300/70"
                                : "border-gray-400 bg-[#BBD9A1] hover:bg-[#BBD9A1]/90 text-[#214104] hover:border-gray-500 hover:scale-[1.02]"
                            }`}
                          >
                            {opt.text}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={submitDecision}
                        disabled={selectedDecisionOption === null || isLoadingApi}
                        className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-green-500 shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out"
                      >
                        Confirm Choice
                      </button>
                    </>
                  )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
