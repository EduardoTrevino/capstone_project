"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import React from 'react'; // Import React for event type
import DecisionProgressBar from "@/components/DecisionProgressBar"; // Adjust path if needed

// --- Interfaces (Unchanged) ---
interface NarrativeDialogue {
  character: "Rani" | "Ali" | "Yash" | "Nisha" | "Narrator";
  pfp: string;
  text: string;
}
interface DecisionPointOption { text: string; }
interface DecisionPoint { question: string; options: DecisionPointOption[]; }
interface MCQ { question: string; options: string[]; correctOptionIndex: number; }
interface Feedback { correctFeedback: string; incorrectFeedback: string; }
interface ScenarioStep {
  narrativeSteps: NarrativeDialogue[];
  mainCharacterImage: string | null;
  decisionPoint: DecisionPoint | null;
  mcq: MCQ | null;
  feedback: Feedback | null;
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
        case 'yash':      return `${basePath}yash.png`;
        case 'nisha':     return `${basePath}nisha.png`;
        case 'narrator':  return `${basePath}narrator.png`;
        default:
            console.warn(`Mapping not found for character image: ${characterName}`);
            return null;
    }
};

export default function NarrativeGamePage() {
  const router = useRouter();

  // --- State ---
  const [currentStepData, setCurrentStepData] = useState<ScenarioStep | null>(null);
  const [staggeredMessages, setStaggeredMessages] = useState<DisplayMessage[]>([]);
  const [messageQueue, setMessageQueue] = useState<NarrativeDialogue[]>([]);
  const [showInteractionArea, setShowInteractionArea] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [mainCharacterImage, setMainCharacterImage] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecisionOption, setSelectedDecisionOption] = useState<number | null>(null);
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);
  const [hasAnsweredMcq, setHasAnsweredMcq] = useState(false);
  const [userId, setUserId] = useState<string>("");
  // const [progress, setProgress] = useState(0); // Removed - progress derived for new bar
  const [decisionCount, setDecisionCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  // --- Refs ---
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const messageIdCounter = useRef(0);
  const lastMcqRef = useRef<MCQ | null>(null);


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
    setIsInitialLoading(true);
    loadScenarioStep(null, storedUserId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Handle new scenario step data
  useEffect(() => {
    if (!currentStepData || isLoadingApi) return;

    setShowInteractionArea(false); // Default to hidden
    setIsInitialLoading(false);

    // Set main character image
    let stepImage = null;
    if (currentStepData.mainCharacterImage?.startsWith('/')) {
        stepImage = currentStepData.mainCharacterImage;
    } else if (currentStepData.narrativeSteps?.[0]) {
       stepImage = getCharacterImagePath(currentStepData.narrativeSteps[0].character);
    }
    // Only update if it's truly different or initially null
    if (stepImage !== mainCharacterImage) {
       setMainCharacterImage(stepImage);
    }


    // Remember MCQ and reset related states if needed
    if (currentStepData.mcq) {
      lastMcqRef.current = currentStepData.mcq;
      // Only reset if it's a *new* MCQ step, not feedback following an MCQ
      if (!currentStepData.feedback) {
        setHasAnsweredMcq(false);
        setSelectedMcqOption(null);
      }
    }
    if (currentStepData.decisionPoint) {
        setSelectedDecisionOption(null);
    }

    // Queue narrative steps
    if (currentStepData.narrativeSteps?.length > 0) {
      setMessageQueue([...currentStepData.narrativeSteps]);
      // Interaction area remains hidden, waiting for screen clicks
    } else {
      // No narrative steps: Show interactions immediately
      setMessageQueue([]);
      if (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete) {
          // Show feedback only if MCQ was answered OR if it's the only interaction
          if (currentStepData.feedback && !hasAnsweredMcq && currentStepData.mcq) {
              // Don't show feedback yet if MCQ hasn't been answered
          } else {
              setShowInteractionArea(true);
          }
      }
    }

    // Update completion status
    if (currentStepData.scenarioComplete) {
      setIsComplete(true);
    }
     // Handle error state from API response
    if (currentStepData.error) {
      setError(currentStepData.error);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepData, isLoadingApi]); // Rerun when new step data arrives

  // Update progress bar - REMOVED useEffect for old progress calculation

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [staggeredMessages]);

  // --- Core Logic Functions ---

  // Fetch Scenario Step
  const loadScenarioStep = useCallback(async (decisionIndex: number | null, uid: string) => {
    if (!uid) {
      setError("User ID is missing.");
      setIsInitialLoading(false);
      return;
    }
    setIsLoadingApi(true);
    setError(null);
    setShowInteractionArea(false); // Hide interactions during load
    setMessageQueue([]); // Clear queue explicitly

    // Keep user's response message if applicable
    // Note: We append new messages, so history is preserved naturally.

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

      // Reset MCQ answered state ONLY when loading based on a *decision* response
      // OR when initiating the first step (where decisionIndex is null but it's not an MCQ answer submission)
      const isMcqAnswerSubmission = lastMcqRef.current && !data.scenarioStep.feedback && decisionIndex === null;
      if (decisionIndex !== null || (decisionIndex === null && !isMcqAnswerSubmission)) {
          setHasAnsweredMcq(false);
          setSelectedMcqOption(null);
      }


      setCurrentStepData(data.scenarioStep);
    } catch (err: any) {
      console.error("loadScenarioStep error:", err);
      setError(err.message || "Failed to load step.");
      setCurrentStepData(null);
    } finally {
      setIsLoadingApi(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Depend only on userId (it shouldn't change often)

  // Advance narrative or show interaction area
   const handleNextStep = useCallback(() => {
    if (isLoadingApi || messageQueue.length === 0) return; // Exit if loading or queue empty

    setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const nextMessageToShow = queue.shift(); // Get next message

        if (nextMessageToShow) {
            // Update character image if needed - only if mainCharacterImage isn't explicitly set in step data
            const stepImageProvided = currentStepData?.mainCharacterImage?.startsWith('/');
            if (!stepImageProvided) {
                const charImage = getCharacterImagePath(nextMessageToShow.character);
                // Check if different from *current* main image before setting
                setMainCharacterImage(prevMainImage => {
                    if (charImage !== prevMainImage) return charImage;
                    return prevMainImage;
                });
            }

            // Add message to display
             // *** Check for duplicates before adding ***
            setStaggeredMessages(prev => {
                // Simple check: don't add if the very last message has the same text and character
                // (This is a basic check, might need refinement if identical messages are valid)
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.text === nextMessageToShow.text && lastMsg.character === nextMessageToShow.character && !lastMsg.isDecision) {
                    console.warn("Potential duplicate message prevented:", nextMessageToShow.text);
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

            // If this was the *last* message, show interactions immediately after render
            if (queue.length === 0 && currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
                 // Show feedback only if MCQ was answered OR if it's the only interaction
                 if (currentStepData.feedback && !hasAnsweredMcq && currentStepData.mcq) {
                    // Don't show feedback yet
                 } else {
                     // Use timeout 0 to ensure state update happens *after* this render cycle
                     setTimeout(() => setShowInteractionArea(true), 0);
                 }
            } else {
                 setShowInteractionArea(false); // Ensure interactions stay hidden
            }

            return queue; // Return updated queue
        }
        return queue; // Return queue (should be empty if no message found)
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingApi, messageQueue, currentStepData, hasAnsweredMcq]); // Removed mainCharacterImage dependency

   // --- NEW: Screen Click Handler ---
   const handleScreenClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
       // Prevent advancing if click is on specific interactive elements (buttons, links etc)
       // The stopPropagation on the interaction area handles most cases.
       // Add more specific checks here if needed (e.g., based on target element type)
       const target = event.target as HTMLElement;
       if (target.closest('button, a, [data-interactive="true"]')) { // Added example data attribute
           return;
       }

       // Only advance narrative if messages are queued and interaction area isn't already shown
       if (!isLoadingApi && messageQueue.length > 0 && !showInteractionArea) {
           handleNextStep();
       }
   }, [isLoadingApi, messageQueue, showInteractionArea, handleNextStep]);


  // --- Interaction Handlers (Mostly Unchanged) ---

  function handleSelectDecisionOption(index: number) {
    if (isLoadingApi || !showInteractionArea) return;
    setSelectedDecisionOption(index);
  }

  async function submitDecision() {
    if (selectedDecisionOption === null || !userId || isLoadingApi) return;
    const decisionIndexToSubmit = selectedDecisionOption;
    const choiceText = currentStepData?.decisionPoint?.options[decisionIndexToSubmit]?.text || '';

    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++, character: "User", pfp: null, text: `I choose: "${choiceText}"`, isDecision: true
    }]);
    setDecisionCount(c => c + 1); // Increment decision count
    setSelectedDecisionOption(null);
    setShowInteractionArea(false);
    await loadScenarioStep(decisionIndexToSubmit, userId);
  }

  function handleSelectMcqOption(index: number) {
    if (isLoadingApi || !showInteractionArea || hasAnsweredMcq) return;
    setSelectedMcqOption(index);
  }

  async function submitMcqAnswer() {
    if (selectedMcqOption === null || !userId || isLoadingApi || hasAnsweredMcq) return;
    const answerText = currentStepData?.mcq?.options[selectedMcqOption] || '';

    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++, character: "User", pfp: null, text: `My answer: "${answerText}"`, isDecision: true
    }]);
    setHasAnsweredMcq(true); // Set *before* loading next step
    // Don't reset selectedMcqOption here, needed for feedback check
    setShowInteractionArea(false);
    // API call: Pass null for decisionIndex to indicate MCQ answer submission
    await loadScenarioStep(null, userId); // Load next step (feedback/completion)
  }

  function handleEndScenario() {
    router.push("/dashboard");
  }

  // --- Visibility Flags ---
  // Interaction area container is visible ONLY when showInteractionArea is true
  const isShowingDecisionOpt = showInteractionArea && currentStepData?.decisionPoint && !hasAnsweredMcq && !isComplete;
  const isShowingMcqOpt      = showInteractionArea && currentStepData?.mcq && !hasAnsweredMcq && !isComplete;
  const isShowingFeedback    = showInteractionArea && currentStepData?.feedback && hasAnsweredMcq;
  const isShowingCompletion  = showInteractionArea && isComplete && !isShowingFeedback; // Show completion last

  // --- Calculate currentStep for new ProgressBar ---
  // Map decisionCount (0, 1, 2, 3) to progress bar steps (1, 2, 3, 4)
  // The "Done" step (step 4) should become active after the 3rd decision is made.
  // If MCQ is answered or scenario is complete, it should definitely be step 4.
  const progressBarCurrentStep = Math.min(4, decisionCount + 1);


  // --- Render ---

  if (error) { /* Error rendering unchanged */
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
     return ( <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white text-xl font-semibold"> Loading Scenario... </div> );
   }

  return (
    <div
      className="relative w-full h-screen flex flex-col overflow-hidden bg-gray-800"
      style={{ backgroundImage: `url(/game/bgs/bg_1.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* Top Bar - MODIFIED to use DecisionProgressBar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4 backdrop-blur-sm bg-black/10">
        {/* Integrate the new progress bar */}
        <DecisionProgressBar currentStep={progressBarCurrentStep} />
        <div className="shrink-0 bg-black/30 p-2 rounded-full shadow cursor-pointer hover:bg-black/50 transition-colors" data-interactive="true">
          <Image src="/game/book.svg" alt="Scenario Log" width={28} height={28} />
        </div>
      </div>

      {/* --- Main Content Area (Character + Chat + Interaction) - LAYOUT SWAPPED --- */}
      <div
        className="flex-grow flex flex-col overflow-hidden pt-16 md:pt-20 cursor-pointer" // Added cursor-pointer
        onClick={handleScreenClick} // Attach screen click handler here
      >

        {/* --- Chat History & Interaction Area (MOVED UP) --- */}
        <div className="flex-grow overflow-y-auto p-3 md:p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent mb-2">
          {staggeredMessages.map(msg => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.character === "User" ? "justify-end" : "justify-start"} animate-fade-in-short`}>
              {msg.character !== "User" && msg.pfp && ( <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 shadow border border-white/20 mb-1 self-start"> <Image src={msg.pfp} alt={`${msg.character} pfp`} width={40} height={40} className="object-cover"/> </div> )}
              {msg.character === "User" && <div className="w-8 md:w-10 shrink-0"></div>}
              <div className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md ${ msg.character === "User" ? "bg-blue-600 text-white rounded-br-none" : "bg-white/95 text-gray-900 rounded-bl-none" }`}>
                {msg.character !== "User" && (<p className="text-xs font-semibold mb-0.5 text-indigo-700">{msg.character}</p>)}
                <p className={`text-sm leading-relaxed break-words`}>{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoadingApi && !isInitialLoading && ( <div className="flex items-center justify-center p-4"> <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div> <span className="text-sm text-gray-400 italic ml-2">Loading...</span> </div> )}
          <div ref={messagesEndRef} />
        </div>

        {/* --- Interaction Area Container (MOVED UP, logically follows chat) --- */}
        <div
           className={`relative p-3 bg-black/40 backdrop-blur-lg border-t border-white/10
                       shrink-0 min-h-[90px] md:min-h-[100px] flex flex-col justify-center items-center
                       transition-opacity duration-300 ease-in-out ${
                       showInteractionArea ? "opacity-100" : "opacity-0 pointer-events-none" // Only visible when true
                       }`}
           onClick={(e) => e.stopPropagation()} // Prevent clicks here triggering screen click
           style={{ cursor: 'default' }} // Reset cursor for this area
           data-interactive="true" // Mark this whole block as interactive
        >
           {/* --- REMOVED "Next" button --- */}

          {/* Decision Point Options */}
          {isShowingDecisionOpt && currentStepData?.decisionPoint && (
             <div className="w-full max-w-xl mx-auto animate-fade-in space-y-3">
              <p className="font-semibold text-sm mb-2 text-center text-white px-4">{currentStepData.decisionPoint.question}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentStepData.decisionPoint.options.map((opt, idx) => ( <button key={idx} onClick={() => handleSelectDecisionOption(idx)} className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none ${selectedDecisionOption === idx ? "border-yellow-400 bg-yellow-500/30 shadow-lg scale-[1.03] text-yellow-100 ring-2 ring-yellow-300/70" : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500 hover:scale-[1.02]"}`}>{opt.text}</button> ))}
              </div>
              <button onClick={submitDecision} disabled={selectedDecisionOption === null || isLoadingApi} className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-green-500 shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out">Confirm Choice</button>
             </div>
          )}

          {/* MCQ Options */}
          {isShowingMcqOpt && currentStepData?.mcq && (
             <div className="w-full max-w-xl mx-auto animate-fade-in space-y-3">
               <p className="font-semibold text-sm mb-2 text-center text-white px-4">{currentStepData.mcq.question}</p>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 {currentStepData.mcq.options.map((opt, idx) => ( <button key={idx} onClick={() => handleSelectMcqOption(idx)} className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none ${selectedMcqOption === idx ? "border-cyan-400 bg-cyan-500/30 shadow-lg scale-[1.03] text-cyan-100 ring-2 ring-cyan-300/70" : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500 hover:scale-[1.02]"}`}>{opt}</button> ))}
               </div>
               <button onClick={submitMcqAnswer} disabled={selectedMcqOption === null || isLoadingApi} className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-blue-500 shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out">Submit Answer</button>
             </div>
          )}

          {/* Feedback Display */}
          {isShowingFeedback && currentStepData?.feedback && lastMcqRef.current && (
            <div className="text-sm text-center max-w-lg mx-auto animate-fade-in w-full px-4">
              {selectedMcqOption === lastMcqRef.current.correctOptionIndex ? ( <div className="font-medium mb-3 p-3 rounded-lg border bg-green-800/80 border-green-600 text-green-100 shadow-md"> <strong className="block text-base mb-1">Correct!</strong> {currentStepData.feedback.correctFeedback} </div> ) : ( <div className="font-medium mb-3 p-3 rounded-lg border bg-red-800/80 border-red-600 text-red-100 shadow-md"> <strong className="block text-base mb-1">Incorrect.</strong> {currentStepData.feedback.incorrectFeedback} {typeof lastMcqRef.current.correctOptionIndex === 'number' && (<span className="block mt-2 text-xs text-red-200 opacity-90">(Correct Answer: "{lastMcqRef.current.options[lastMcqRef.current.correctOptionIndex]}")</span>)} </div> )}
              {/* Show finish button directly after feedback if scenario is complete */}
              {isComplete && ( <button onClick={handleEndScenario} className="mt-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">Finish Scenario</button> )}
               {/* Removed the "Click 'Next' to continue" hint as screen click handles it */}
            </div>
          )}

          {/* Scenario Completion Message (Only shown if NOT showing feedback) */}
          {isShowingCompletion && (
            <div className="text-center max-w-lg mx-auto animate-fade-in w-full px-4">
              <p className="font-semibold text-lg text-yellow-300 mb-4 drop-shadow">Scenario Complete!</p>
              <button onClick={handleEndScenario} className="px-8 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">Return to Dashboard</button>
            </div>
          )}

        </div> {/* End Interaction Area */}

        {/* --- Character Image Area (MOVED DOWN) --- */}
        {/* Added mt-4 for spacing, removed mb-2 */}
        <div className="relative flex-shrink-0 h-[35vh] md:h-[40vh] flex justify-center items-end pointer-events-none mt-4">
          {mainCharacterImage && (
            <Image key={mainCharacterImage} src={mainCharacterImage} alt="Current Character" width={250} height={400} className="object-contain max-h-full animate-fade-in drop-shadow-lg" priority />
          )}
        </div>

      </div> {/* --- End Main Content Area (now clickable) --- */}

    </div> // End Page Container
  );
}