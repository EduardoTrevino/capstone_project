"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from 'react';
import DecisionProgressBar from "@/components/DecisionProgressBar";
import { ChatMessage } from "@/components/ChatMessage";
import { supabase } from "@/lib/supabase"; // Import Supabase clien

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
        case 'narrator':  return `${basePath}narrator.png`; // Assuming you might want a narrator image
        default:
            console.warn(`Mapping not found for character image: ${characterName}`);
            return null; // Return null for narrator or unknown characters
    }
};

export default function NarrativeGamePage() {
  const router = useRouter();

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
    setStaggeredMessages([]);
    setDecisionCount(0);
    setIsInitialLoading(true); // Explicitly set to true

    async function fetchGoalDescriptionAndLoadScenario() {
        try {
            const { data: userData, error: userErr } = await supabase
                .from('users')
                .select('focused_goal_id')
                .eq('id', storedUserId)
                .single();

            if (userErr || !userData || !userData.focused_goal_id) {
                console.error("Could not fetch user's focused goal", userErr);
                setError("Could not load goal information. Please try again.");
                setIsInitialLoading(false); // Stop loading if goal info fails
                return;
            }

            const { data: goalData, error: goalErr } = await supabase
                .from('goals')
                .select('description')
                .eq('id', userData.focused_goal_id)
                .single();

            if (goalErr || !goalData) {
                console.error("Could not fetch goal description", goalErr);
                setGoalDescriptionForLoading("Goal details could not be loaded.");
            } else {
                setGoalDescriptionForLoading(goalData.description || "No goal description available.");
            }
        } catch (e: any) {
            console.error("Error fetching initial goal data:", e);
            setGoalDescriptionForLoading("Error loading goal details.");
        } finally {
            // Now load the scenario itself, isInitialLoading will be set to false
            // by loadScenarioStep or its error handling.
            if (storedUserId) {
                loadScenarioStep(null, storedUserId);
            }
        }
    }

    fetchGoalDescriptionAndLoadScenario();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // Removed loadScenarioStep from here, it's called internally now

  // Handle new scenario step data
  useEffect(() => {
    if (!isLoadingApi && (currentStepData || error)) { // If API is not loading AND we have data OR an error
      if (isInitialLoading) {
          setIsInitialLoading(false);
      }
  }
    if (!currentStepData || isLoadingApi) return;

    setShowInteractionArea(false);
    setIsInitialLoading(false);

    let stepImage = null;
    if (currentStepData.mainCharacterImage?.startsWith('/')) {
        stepImage = currentStepData.mainCharacterImage;
    } else if (currentStepData.narrativeSteps?.[0]) {
       stepImage = getCharacterImagePath(currentStepData.narrativeSteps[0].character);
    }
    if (stepImage !== mainCharacterImage) {
       setMainCharacterImage(stepImage);
    }

    if (currentStepData.decisionPoint) {
        setSelectedDecisionOption(null);
    }

    if (currentStepData.narrativeSteps?.length > 0) {
      setMessageQueue([...currentStepData.narrativeSteps]);
    } else {
      setMessageQueue([]);
      if (currentStepData.decisionPoint || currentStepData.scenarioComplete) {
          setTimeout(() => setShowInteractionArea(true), 50);
      }
    }

    if (currentStepData.scenarioComplete) {
      setIsComplete(true);
    }
    if (currentStepData.error) {
      setError(currentStepData.error);
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

  const loadScenarioStep = useCallback(async (decisionIndex: number | null, uid: string) => {
    if (!uid) {
      setError("User ID is missing.");
      setIsInitialLoading(false);
      return;
    }
    setIsLoadingApi(true);
    setError(null);
    setShowInteractionArea(false);
    setMessageQueue([]);

    try {
      const res = await fetch("/api/lessons", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, decisionIndex })
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
    } catch (err: any) {
      console.error("loadScenarioStep error:", err);
      setError(err.message || "Failed to load step.");
      setCurrentStepData(null);
    } finally {
      setIsLoadingApi(false);
      if (isInitialLoading) setIsInitialLoading(false); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialLoading]); // Removed userId dependency as it's passed in

  const handleNextStep = useCallback(() => {
    if (isLoadingApi || messageQueue.length === 0) return;

    setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const nextMessageToShow = queue.shift();

        if (nextMessageToShow) {
            const stepImageProvided = currentStepData?.mainCharacterImage?.startsWith('/');
            if (!stepImageProvided) {
                const charImage = getCharacterImagePath(nextMessageToShow.character);
                setMainCharacterImage(prevMainImage => {
                    if (charImage !== prevMainImage) return charImage;
                    return prevMainImage;
                });
            }

            setStaggeredMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.text === nextMessageToShow.text && lastMsg.character === nextMessageToShow.character && !lastMsg.isDecision) {
                    return prev;
                }
                return [...prev, {
                    id: messageIdCounter.current++,
                    character: nextMessageToShow.character,
                    // Use the pfp from the dialogue step for the message avatar
                    pfp: nextMessageToShow.pfp, // Ensure API provides this
                    text: nextMessageToShow.text,
                    isDecision: false
                }];
            });

            if (queue.length === 0 && currentStepData && (currentStepData.decisionPoint || currentStepData.scenarioComplete)) {
                 setTimeout(() => setShowInteractionArea(true), 0);
            } else if (queue.length > 0) {
                 setShowInteractionArea(false);
            }

            return queue;
        }
        return queue;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingApi, messageQueue, currentStepData]); // Removed userId dependency

  const handleScreenClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
       const target = event.target as HTMLElement;
       if (target.closest('button, a, [data-interactive="true"]')) {
           return;
       }
       if (!isLoadingApi && messageQueue.length > 0 && !showInteractionArea) {
           handleNextStep();
       }
   }, [isLoadingApi, messageQueue, showInteractionArea, handleNextStep]);

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
    setDecisionCount(c => c + 1);
    setSelectedDecisionOption(null);
    setShowInteractionArea(false);
    await loadScenarioStep(decisionIndexToSubmit, userId);
  }

  function handleEndScenario() {
    router.push("/dashboard");
  }

  // --- Visibility Flags ---
  const isShowingDecisionOpt = showInteractionArea && currentStepData?.decisionPoint && !isComplete;
  const isShowingCompletion = showInteractionArea && isComplete;

  // --- Calculate currentStep for new ProgressBar (4 steps: D1, D2, D3, Finish) ---
  let progressBarCurrentStep = 1;
  if (decisionCount === 1) {
    progressBarCurrentStep = 2;
  } else if (decisionCount === 2) {
    progressBarCurrentStep = 3;
  } else if (decisionCount >= 3 || isComplete) {
    progressBarCurrentStep = 4;
  }

  // --- Render ---

  if (error && !isInitialLoading) { /* Error rendering unchanged */
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

   if (isInitialLoading) { /* Initial loading unchanged */
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
            <div className="mt-6 flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-t-2 border-gray-700"></div>
              <p className="ml-3 text-gray-700 font-semibold">Loading scenario...</p>
            </div>
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

   // ========================================================================
   // LAYOUT STRUCTURE CHANGE:
   // - Outer container uses flex-col.
   // - Top bar is absolute.
   // - Main content area takes remaining space (flex-grow) and is ALSO flex-col.
   // - Chat history *within* main content uses flex-grow and overflow-y-auto.
   // - A new fixed-height 'bottom-area' holds the Character Image and Interaction Area.
   // ========================================================================
   return (
    <div
      className="relative w-full h-screen flex flex-col overflow-hidden bg-gray-800"
      style={{ backgroundImage: `url(/game/bgs/bg_1.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* --- Top Bar (Unchanged) --- */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4">
        <DecisionProgressBar currentStep={progressBarCurrentStep} />
        <div className="shrink-0 p-2 rounded-full cursor-pointer hover:bg-white/20 transition-colors" data-interactive="true">
          <Image src="/game/book.png" alt="Scenario Log" width={28} height={28} />
        </div>
      </div>

      {/* --- Main Content Area --- Takes up space BELOW top bar */}
      {/* Added overflow-hidden here to prevent potential parent scrollbars */}
      <div
        className="flex-grow flex flex-col pt-16 md:pt-20 overflow-hidden cursor-pointer" // Use flex-grow, flex-col, add overflow-hidden
        onClick={handleScreenClick} // Click handler on the whole area (excluding bottom interactive elements)
      >

        {/* --- Chat History Area --- Grows to fill space ABOVE the bottom area */}
        <div className="flex-grow overflow-y-auto p-3 md:p-4 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent"> {/* REMOVED space-y-3 */}
          {staggeredMessages.map(msg => (
            msg.character === "User" ? (
              // --- Keep existing User message rendering ---
              // Added mb-6 to match the new component's bottom margin for consistency
              <div key={msg.id} className={`flex items-end gap-2 justify-end animate-fade-in-short mb-6`}>
                {/* Placeholder div */}
                <div className="w-8 md:w-10 shrink-0"></div>
                <div className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md bg-[#BBD9A1] text-[#214104] rounded-br-none`}>
                  {/* Removed user name display from bubble if it existed */}
                  <p className={`text-sm leading-relaxed break-words`}>{msg.text}</p>
                </div>
              </div>
            ) : (
              // --- Use new ChatMessage component for AI/Character messages ---
              <ChatMessage
                key={msg.id}
                message={msg.text}
                name={msg.character}
                // Ensure pfp is passed, provide empty string as fallback for component's placeholder
                avatarUrl={msg.pfp || ''}
                // Let the component handle the fallback text generation (e.g., first letter of name)
                className="animate-fade-in-short mb-14" // Added mb-6 for consistent spacing with user messages
              />
            )
          ))}
          {/* Loading Indicator (Unchanged) */}
          {isLoadingApi && !isInitialLoading && ( <div className="flex items-center justify-center p-4"> <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div> <span className="text-sm text-gray-400 italic ml-2">Loading...</span> </div> )}
          {/* Scroll Target (Unchanged) */}
          <div ref={messagesEndRef} /> {/* Scroll target */}
        </div>
        {/* ================== END CHAT HISTORY AREA ================== */}

        {/* --- Bottom Area (Character Image + Interactions) --- Fixed Height */}
        {/* This container has a fixed height and prevents the chat from flowing into it */}
        <div className="relative flex-shrink-0 h-[40vh] md:h-[45vh]"> {/* ** NEW CONTAINER ** - `relative` for absolute children, `flex-shrink-0` to prevent shrinking, fixed `h-[]` */}

            {/* --- Character Image Area --- Positioned absolutely WITHIN the bottom-area */}
            <div className="absolute inset-0 flex justify-start items-end pointer-events-none pb-2 md:pb-4 pl-4"> {/* Changed justify-center to justify-start and added pl-4 */}
              {mainCharacterImage && (
                  <Image
                      key={mainCharacterImage} // Re-trigger animation on image change
                      src={mainCharacterImage}
                      alt="Current Character"
                      width={350} // Increased from 250
                      height={500} // Increased from 400
                      className="object-contain max-h-full animate-fade-in drop-shadow-lg"
                      priority // Load primary character images eagerly
                  />
              )}
            </div>

            {/* --- Interaction Area Container --- Positioned absolutely AT THE BOTTOM of the bottom-area */}
            <div
               className={`absolute inset-x-0 bottom-0 p-3 z-10 flex flex-col justify-end items-center
                           transition-opacity duration-300 ease-in-out ${
                           showInteractionArea ? "opacity-100" : "opacity-0 pointer-events-none"
                           }`}
               onClick={(e) => e.stopPropagation()} // Prevent clicks inside from triggering handleScreenClick
               style={{ cursor: 'default' }} // Reset cursor for this area
               data-interactive="true" // Mark as interactive for handleScreenClick check
            >
                {/* Options / Feedback Container - With translucent background */}
                <div className={`w-full max-w-xl mx-auto space-y-3 p-4 rounded-lg bg-[#66943C] backdrop-blur-sm shadow-lg`}>

                  {/* Decision Point Options */}
                  {isShowingDecisionOpt && currentStepData?.decisionPoint && (
                    <>
                      {/* Question Text */}
                      <p className="font-semibold text-sm mb-3 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] px-2">
                        {currentStepData.decisionPoint.question}
                      </p>
                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentStepData.decisionPoint.options.map((opt, idx) => ( <button key={idx} onClick={() => handleSelectDecisionOption(idx)} className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none ${selectedDecisionOption === idx ? "border-yellow-400 bg-yellow-500/30 shadow-lg scale-[1.03] text-yellow-100 ring-2 ring-yellow-300/70" : "border-gray-400 bg-[#BBD9A1] hover:bg-[#BBD9A1]/90 text-[#214104] hover:border-gray-500 hover:scale-[1.02]"}`}>{opt.text}</button> ))}
                      </div>
                      {/* Confirm Button */}
                      <button onClick={submitDecision} disabled={selectedDecisionOption === null || isLoadingApi} className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-green-500 shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out">Confirm Choice</button>
                    </>
                  )}

                  {/* Scenario Completion Message (Only shown if NOT showing decision options) */}
                  {isShowingCompletion && (
                    <div className="text-center animate-fade-in w-full">
                      <p className="font-semibold text-lg text-yellow-300 mb-4 drop-shadow">Scenario Complete!</p>
                      <button onClick={handleEndScenario} className="px-8 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">Return to Dashboard</button>
                    </div>
                  )}
                </div> {/* End Options/Feedback Container */}

            </div> {/* End Interaction Area Container */}

        </div> {/* --- End Bottom Area --- */}

      </div> {/* --- End Main Content Area --- */}

    </div> // End Page Container
  );
}