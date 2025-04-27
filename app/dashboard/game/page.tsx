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

  // --- State (Unchanged) ---
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
  const [decisionCount, setDecisionCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isMcqStepActive, setIsMcqStepActive] = useState(false);

  // --- Visibility Flags (Unchanged) ---
  const isShowingDecisionOpt = showInteractionArea && currentStepData?.decisionPoint && !hasAnsweredMcq && !isComplete;
  const isShowingMcqOpt      = showInteractionArea && currentStepData?.mcq && !hasAnsweredMcq && !isComplete;
  const isShowingFeedback    = showInteractionArea && currentStepData?.feedback && hasAnsweredMcq;
  const isShowingCompletion  = showInteractionArea && isComplete && !isShowingFeedback;

  // --- Refs (Unchanged) ---
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const messageIdCounter = useRef(0);
  const lastMcqRef = useRef<MCQ | null>(null);


  // --- Effects ---

  // Initial load (Unchanged)
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) { router.push("/"); return; }
    setUserId(storedUserId);
    setStaggeredMessages([]); setIsInitialLoading(true); setDecisionCount(0); setIsMcqStepActive(false);
    loadScenarioStep(null, storedUserId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Handle new scenario step data (Unchanged)
  useEffect(() => {
    if (!currentStepData || isLoadingApi) return;
    setShowInteractionArea(false); setIsInitialLoading(false);
    let stepImage = null;
    if (currentStepData.mainCharacterImage?.startsWith('/')) stepImage = currentStepData.mainCharacterImage;
    else if (currentStepData.narrativeSteps?.[0]) stepImage = getCharacterImagePath(currentStepData.narrativeSteps[0].character);
    if (stepImage !== mainCharacterImage) setMainCharacterImage(stepImage);
    setIsMcqStepActive(!!currentStepData.mcq);
    if (currentStepData.mcq) {
      lastMcqRef.current = currentStepData.mcq;
      if (!currentStepData.feedback) { setHasAnsweredMcq(false); setSelectedMcqOption(null); }
    }
    if (currentStepData.decisionPoint) setSelectedDecisionOption(null);
    if (currentStepData.narrativeSteps?.length > 0) {
      // Clear existing messages *before* queueing new ones for the initial auto-display logic
      setStaggeredMessages([]);
      setMessageQueue([...currentStepData.narrativeSteps]);
    } else {
      setMessageQueue([]);
      setStaggeredMessages([]); // Also clear if no narrative steps
      if (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete) {
          if (!(currentStepData.feedback && !hasAnsweredMcq && currentStepData.mcq)) {
            setShowInteractionArea(true);
          }
      }
    }
    if (currentStepData.scenarioComplete) setIsComplete(true);
    if (currentStepData.error) setError(currentStepData.error);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepData, isLoadingApi]);

  // Auto-scroll chat (Unchanged)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [staggeredMessages]);

  // --- Core Logic Functions ---

  // Fetch Scenario Step (Unchanged)
  const loadScenarioStep = useCallback(async (decisionIndex: number | null, uid: string) => {
    if (!uid) { setError("User ID is missing."); setIsInitialLoading(false); return; }
    setIsLoadingApi(true); setError(null); setShowInteractionArea(false); setMessageQueue([]);
    try {
      const res = await fetch("/api/lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: uid, decisionIndex }) });
      const responseText = await res.text();
      if (!res.ok) { let err = `HTTP ${res.status}`; try { err = JSON.parse(responseText).error || responseText; } catch { } throw new Error(err); }
      const data = JSON.parse(responseText);
      if (data.error) throw new Error(data.error);
      if (!data.scenarioStep.feedback) { setHasAnsweredMcq(false); setSelectedMcqOption(null); }
      else if (data.scenarioStep.feedback) { setHasAnsweredMcq(true); }
      setCurrentStepData(data.scenarioStep);
    } catch (err: any) { console.error("loadScenarioStep error:", err); setError(err.message || "Failed to load step."); setCurrentStepData(null); }
    finally { setIsLoadingApi(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Advance narrative or show interaction area
   const handleNextStep = useCallback(() => {
    // Make sure not to run if queue is empty or during API load
    if (isLoadingApi || messageQueue.length === 0) {
      // If queue is empty AFTER attempting a step, check if interactions should show
      if (messageQueue.length === 0 && !isLoadingApi && currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
         if (!(currentStepData.feedback && !hasAnsweredMcq && currentStepData.mcq)) {
             // Use timeout 0 to defer state update
             setTimeout(() => setShowInteractionArea(true), 0);
         }
      }
      return;
    }


    setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const nextMessageToShow = queue.shift(); // Get next message and remove from queue

        if (nextMessageToShow) {
            // Update character image if needed
            const stepImageProvided = currentStepData?.mainCharacterImage?.startsWith('/');
            if (!stepImageProvided) {
                const charImage = getCharacterImagePath(nextMessageToShow.character);
                setMainCharacterImage(prevMainImage => {
                    if (charImage !== prevMainImage) return charImage;
                    return prevMainImage;
                });
            }

            // Add message to display
            setStaggeredMessages(prev => {
                // Simple duplicate check (optional, maybe remove if causing issues)
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

            // If this was the *last* message in the queue, show interactions immediately after render
            if (queue.length === 0 && currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
                 // Show feedback only if MCQ was answered OR if it's the only interaction
                 if (!(currentStepData.feedback && !hasAnsweredMcq && currentStepData.mcq)) {
                     // Use timeout 0 to ensure state update happens *after* this render cycle
                     setTimeout(() => setShowInteractionArea(true), 0);
                 }
            } else {
                 // If more messages are queued, ensure interactions stay hidden
                 setShowInteractionArea(false);
            }

            return queue; // Return updated queue
        }
        return queue; // Return queue (should be empty if no message found)
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingApi, messageQueue, currentStepData, hasAnsweredMcq]); // Added dependencies

   // Screen Click Handler
   const handleScreenClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
       const target = event.target as HTMLElement;
       // Prevent advancing if click is on specific interactive elements
       if (target.closest('button, a, [data-interactive="true"]')) {
           return;
       }
       // Only advance narrative if messages are queued and interaction area isn't already shown
       if (!isLoadingApi && messageQueue.length > 0 && !showInteractionArea) {
           handleNextStep();
       }
       // Special case: If queue is empty but feedback is showing, allow click to potentially proceed (e.g., to completion)
       // This might need refinement based on exact desired flow after feedback
       else if (!isLoadingApi && messageQueue.length === 0 && isShowingFeedback && showInteractionArea) {
           // Example: if feedback is shown and scenario is complete, maybe trigger end? Or maybe API handles next step?
           // For now, let's assume clicking after feedback doesn't do anything unless a button is present.
           // If clicking anywhere should trigger the *next* step after feedback (if any), call loadScenarioStep here.
           // console.log("Click after feedback displayed.");
       }

   }, [isLoadingApi, messageQueue, showInteractionArea, handleNextStep, isShowingFeedback]); // Added isShowingFeedback

  // --- Interaction Handlers (Unchanged) ---
  function handleSelectDecisionOption(index: number) { if (isLoadingApi || !showInteractionArea) return; setSelectedDecisionOption(index); }
  async function submitDecision() {
    if (selectedDecisionOption === null || !userId || isLoadingApi) return;
    const decisionIndexToSubmit = selectedDecisionOption;
    const choiceText = currentStepData?.decisionPoint?.options[decisionIndexToSubmit]?.text || '';
    // Add user choice message immediately
    setStaggeredMessages(prev => [...prev, { id: messageIdCounter.current++, character: "User", pfp: null, text: `I choose: "${choiceText}"`, isDecision: true }]);
    setDecisionCount(c => c + 1);
    setSelectedDecisionOption(null);
    setShowInteractionArea(false);
    await loadScenarioStep(decisionIndexToSubmit, userId);
  }
  function handleSelectMcqOption(index: number) { if (isLoadingApi || !showInteractionArea || hasAnsweredMcq) return; setSelectedMcqOption(index); }
  async function submitMcqAnswer() {
    if (selectedMcqOption === null || !userId || isLoadingApi || hasAnsweredMcq) return;
    const answerText = currentStepData?.mcq?.options[selectedMcqOption] || '';
    // Add user answer message immediately
    setStaggeredMessages(prev => [...prev, { id: messageIdCounter.current++, character: "User", pfp: null, text: `My answer: "${answerText}"`, isDecision: true }]);
    setHasAnsweredMcq(true);
    setShowInteractionArea(false);
    await loadScenarioStep(null, userId);
  }
  function handleEndScenario() { router.push("/dashboard"); }


  // --- NEW Effect to display the first message automatically ---
  useEffect(() => {
    // Only run if:
    // - Message queue has items
    // - Staggered messages is empty (meaning we haven't shown any message for this step yet)
    // - We are not in initial loading or API loading states
    if (messageQueue.length > 0 && staggeredMessages.length === 0 && !isLoadingApi && !isInitialLoading) {
        console.log("Auto-displaying first message of the step.");
        // Use a minimal timeout to allow the state related to queue population to settle
        const timer = setTimeout(() => {
            handleNextStep();
        }, 50); // Small delay might help prevent race conditions
        return () => clearTimeout(timer); // Cleanup timer on unmount or re-run
    }
  // Include handleNextStep and other relevant states in dependency array
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messageQueue, staggeredMessages.length, isLoadingApi, isInitialLoading, handleNextStep]);


  // --- Calculate currentStep for ProgressBar (Unchanged) ---
  let progressBarCurrentStep = 1;
  if (decisionCount === 1) progressBarCurrentStep = 2;
  else if (decisionCount === 2) progressBarCurrentStep = 3;
  else if (decisionCount >= 3 || isMcqStepActive || hasAnsweredMcq || isComplete) progressBarCurrentStep = 4;


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

   // --- Main Render Structure ---
   return (
    <div
      className="relative w-full h-screen flex flex-col overflow-hidden bg-gray-800"
      style={{ backgroundImage: `url(/game/bgs/bg_1.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* Top Bar (Unchanged) */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4">
        <DecisionProgressBar currentStep={progressBarCurrentStep} />
        <div className="shrink-0 p-2 rounded-full cursor-pointer hover:bg-white/20 transition-colors" data-interactive="true">
          <Image src="/game/book.png" alt="Scenario Log" width={28} height={28} />
        </div>
      </div>

      {/* --- Main Content Area - Reverted Layout --- */}
      <div
        className="flex-grow flex flex-col overflow-hidden pt-16 md:pt-20 cursor-pointer" // Keep cursor pointer for clicks
        onClick={handleScreenClick} // Attach screen click handler here
      >

        {/* --- Chat History --- Takes available space, stops above character/interaction */}
        <div className="flex-grow overflow-y-auto p-3 md:p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent mb-2"> {/* Use margin-bottom */}
          {/* Chat bubble rendering unchanged */}
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

        {/* --- Character Image Area --- Positioned normally within flex column */}
        <div className="relative flex-shrink-0 h-[35vh] md:h-[40vh] flex justify-center items-end pointer-events-none mb-2"> {/* Adjusted height, mb */}
          {mainCharacterImage && (
            <Image key={mainCharacterImage} src={mainCharacterImage} alt="Current Character" width={250} height={400} className="object-contain max-h-full animate-fade-in drop-shadow-lg" priority />
          )}
        </div>

        {/* --- Interaction Area Container --- Positioned normally at bottom */}
        <div
           className={`relative p-3 bg-black/60 backdrop-blur-sm // Use background here
                       shrink-0 min-h-[90px] md:min-h-[100px] flex flex-col justify-center items-center // Center content vertically
                       transition-opacity duration-300 ease-in-out ${
                       showInteractionArea ? "opacity-100" : "opacity-0 pointer-events-none" // Only visible when true
                       }`}
           onClick={(e) => e.stopPropagation()} // Prevent clicks here triggering screen click
           style={{ cursor: 'default' }} // Reset cursor for this area
           data-interactive="true" // Mark this whole block as interactive
        >
            {/* Options / Feedback Container - Now just a logical wrapper */}
            <div className={`w-full max-w-xl mx-auto space-y-3 `}>
              {/* Render decision options, MCQ, feedback, completion messages */}
              {/* (Rendering logic for options/feedback is unchanged from previous correct version) */}

              {/* Decision Point Options */}
              {isShowingDecisionOpt && currentStepData?.decisionPoint && (
                <>
                  <p className="font-semibold text-sm mb-3 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] px-2">
                    {currentStepData.decisionPoint.question}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentStepData.decisionPoint.options.map((opt, idx) => ( <button key={idx} onClick={() => handleSelectDecisionOption(idx)} className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none ${selectedDecisionOption === idx ? "border-yellow-400 bg-yellow-500/30 shadow-lg scale-[1.03] text-yellow-100 ring-2 ring-yellow-300/70" : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500 hover:scale-[1.02]"}`}>{opt.text}</button> ))}
                  </div>
                  <button onClick={submitDecision} disabled={selectedDecisionOption === null || isLoadingApi} className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-green-500 shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out">Confirm Choice</button>
                </>
              )}

              {/* MCQ Options */}
              {isShowingMcqOpt && currentStepData?.mcq && (
                <>
                  <p className="font-semibold text-sm mb-3 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] px-2">
                      {currentStepData.mcq.question}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {currentStepData.mcq.options.map((opt, idx) => ( <button key={idx} onClick={() => handleSelectMcqOption(idx)} className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none ${selectedMcqOption === idx ? "border-cyan-400 bg-cyan-500/30 shadow-lg scale-[1.03] text-cyan-100 ring-2 ring-cyan-300/70" : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500 hover:scale-[1.02]"}`}>{opt}</button> ))}
                  </div>
                  <button onClick={submitMcqAnswer} disabled={selectedMcqOption === null || isLoadingApi} className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-blue-500 shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out">Submit Answer</button>
                </>
              )}

              {/* Feedback Display */}
              {isShowingFeedback && currentStepData?.feedback && lastMcqRef.current && (
                <div className="text-sm text-center animate-fade-in w-full">
                  {selectedMcqOption === lastMcqRef.current.correctOptionIndex ? ( <div className="font-medium mb-3 p-3 rounded-lg border bg-green-800/80 border-green-600 text-green-100 shadow-md"> <strong className="block text-base mb-1">Correct!</strong> {currentStepData.feedback.correctFeedback} </div> ) : ( <div className="font-medium mb-3 p-3 rounded-lg border bg-red-800/80 border-red-600 text-red-100 shadow-md"> <strong className="block text-base mb-1">Incorrect.</strong> {currentStepData.feedback.incorrectFeedback} {typeof lastMcqRef.current.correctOptionIndex === 'number' && (<span className="block mt-2 text-xs text-red-200 opacity-90">(Correct Answer: "{lastMcqRef.current.options[lastMcqRef.current.correctOptionIndex]}")</span>)} </div> )}
                  {isComplete && ( <button onClick={handleEndScenario} className="mt-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">Finish Scenario</button> )}
                </div>
              )}

              {/* Scenario Completion Message */}
              {isShowingCompletion && (
                <div className="text-center animate-fade-in w-full">
                  <p className="font-semibold text-lg text-yellow-300 mb-4 drop-shadow">Scenario Complete!</p>
                  <button onClick={handleEndScenario} className="px-8 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">Return to Dashboard</button>
                </div>
              )}
            </div> {/* End Inner Wrapper */}

        </div> {/* End Interaction Area */}

      </div> {/* --- End Main Content Area --- */}

    </div> // End Page Container
  );
}