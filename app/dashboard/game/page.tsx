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
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [mainCharacterImage, setMainCharacterImage] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecisionOption, setSelectedDecisionOption] = useState<number | null>(null);
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);
  const [hasAnsweredMcq, setHasAnsweredMcq] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [decisionCount, setDecisionCount] = useState(0); // Tracks how many decisions the *user* has made
  const [isComplete, setIsComplete] = useState(false);
  const [isMcqStepActive, setIsMcqStepActive] = useState(false); // Track if the current step *is* the MCQ step

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
    setDecisionCount(0); // Reset decision count on load
    setIsMcqStepActive(false); // Reset MCQ flag
    loadScenarioStep(null, storedUserId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Handle new scenario step data
  useEffect(() => {
    if (!currentStepData || isLoadingApi) return;

    setShowInteractionArea(false); // Default to hidden
    setIsInitialLoading(false);

    // Set main character image (using the helper)
    let stepImage = null;
    if (currentStepData.mainCharacterImage?.startsWith('/')) {
        // If an explicit path is provided, use it
        stepImage = currentStepData.mainCharacterImage;
    } else if (currentStepData.narrativeSteps?.[0]) {
       // Otherwise, try to map from the first character in the narrative steps
       stepImage = getCharacterImagePath(currentStepData.narrativeSteps[0].character);
    }
    // Only update state if the image actually changes
    if (stepImage !== mainCharacterImage) {
       setMainCharacterImage(stepImage);
    }


    // Check if this step is the MCQ step
    setIsMcqStepActive(!!currentStepData.mcq);

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
    } else {
      setMessageQueue([]);
      // Show interactions immediately if no narrative
      if (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete) {
          if (currentStepData.feedback && !hasAnsweredMcq && currentStepData.mcq) {
              // Don't show feedback yet if MCQ hasn't been answered
          } else {
              // Delay showing slightly to allow potential image fade-in
              setTimeout(() => setShowInteractionArea(true), 50);
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

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [staggeredMessages]);

  // --- Core Logic Functions ---

  // Fetch Scenario Step (No changes needed here for UI)
  const loadScenarioStep = useCallback(async (decisionIndex: number | null, uid: string) => {
    if (!uid) {
      setError("User ID is missing.");
      setIsInitialLoading(false);
      return;
    }
    setIsLoadingApi(true);
    setError(null);
    setShowInteractionArea(false); // Hide interaction area while loading new step
    setMessageQueue([]); // Clear any remaining message queue from previous step

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

      // Reset MCQ answered state *unless* the incoming step specifically includes feedback
      // This handles the transition from answering MCQ -> seeing feedback correctly
      if (!data.scenarioStep.feedback) {
          setHasAnsweredMcq(false);
          setSelectedMcqOption(null); // Also reset selected option if not feedback
      } else if (data.scenarioStep.feedback) {
          // If feedback is present, ensure we *keep* the answered state
          // (This mainly handles edge cases or reloads on feedback steps)
          setHasAnsweredMcq(true);
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
  }, [userId]); // userId dependency is okay here

  // Advance narrative or show interaction area
  const handleNextStep = useCallback(() => {
    if (isLoadingApi || messageQueue.length === 0) return;

    setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const nextMessageToShow = queue.shift();

        if (nextMessageToShow) {
            // Check if the main character image is explicitly set for the step
            const stepImageProvided = currentStepData?.mainCharacterImage?.startsWith('/');
            // Only update the image based on the narrative character if no step image is provided
            if (!stepImageProvided) {
                const charImage = getCharacterImagePath(nextMessageToShow.character);
                 // Update main character image if it's different from the current one
                setMainCharacterImage(prevMainImage => {
                    if (charImage !== prevMainImage) return charImage;
                    return prevMainImage;
                });
            }

            // Add message to display list
            setStaggeredMessages(prev => {
                // Basic duplicate check to prevent accidental double adds on fast clicks
                const lastMsg = prev[prev.length - 1];
                if (lastMsg && lastMsg.text === nextMessageToShow.text && lastMsg.character === nextMessageToShow.character && !lastMsg.isDecision) {
                    return prev; // Avoid adding duplicate narrative message
                }
                return [...prev, {
                    id: messageIdCounter.current++,
                    character: nextMessageToShow.character,
                    pfp: nextMessageToShow.pfp, // Assuming pfp comes from the NarrativeDialogue
                    text: nextMessageToShow.text,
                    isDecision: false
                }];
            });

            // If the queue is now empty, check if we should show interactions
            if (queue.length === 0 && currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
                 // Don't show feedback interaction area until MCQ is answered
                 if (currentStepData.feedback && !hasAnsweredMcq && currentStepData.mcq) {
                     // Do nothing, wait for MCQ submission
                 } else {
                     // Use setTimeout to ensure state updates propagate before showing
                     setTimeout(() => setShowInteractionArea(true), 0);
                 }
            } else {
                 // Keep interaction area hidden if there are more messages
                 setShowInteractionArea(false);
            }

            return queue; // Return the updated queue
        }
        return queue; // Return original queue if no message was shifted
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingApi, messageQueue, currentStepData, hasAnsweredMcq]); // Dependencies look correct

   // Screen Click Handler
   const handleScreenClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
       // Prevent advancing narrative if clicking on interactive elements
       const target = event.target as HTMLElement;
       if (target.closest('button, a, [data-interactive="true"]')) {
           return;
       }
       // Advance narrative only if API isn't loading, there are messages, and interaction area isn't shown
       if (!isLoadingApi && messageQueue.length > 0 && !showInteractionArea) {
           handleNextStep();
       }
   }, [isLoadingApi, messageQueue, showInteractionArea, handleNextStep]);


  // --- Interaction Handlers ---

  function handleSelectDecisionOption(index: number) {
    if (isLoadingApi || !showInteractionArea) return;
    setSelectedDecisionOption(index);
  }

  // SUBMIT DECISION: Increment decisionCount here
  async function submitDecision() {
    if (selectedDecisionOption === null || !userId || isLoadingApi) return;
    const decisionIndexToSubmit = selectedDecisionOption;
    const choiceText = currentStepData?.decisionPoint?.options[decisionIndexToSubmit]?.text || '';

    // Add user choice to chat history
    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++, character: "User", pfp: null, text: `I choose: "${choiceText}"`, isDecision: true
    }]);
    setDecisionCount(c => c + 1); // <-- Increment user decision count
    setSelectedDecisionOption(null); // Reset selection
    setShowInteractionArea(false); // Hide options
    await loadScenarioStep(decisionIndexToSubmit, userId); // Load next step based on decision
  }

  function handleSelectMcqOption(index: number) {
    if (isLoadingApi || !showInteractionArea || hasAnsweredMcq) return; // Prevent selection if already answered
    setSelectedMcqOption(index);
  }

  // SUBMIT MCQ: Set hasAnsweredMcq here
  async function submitMcqAnswer() {
    if (selectedMcqOption === null || !userId || isLoadingApi || hasAnsweredMcq) return;
    const answerText = currentStepData?.mcq?.options[selectedMcqOption] || '';

    // Add user answer to chat history
    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++, character: "User", pfp: null, text: `My answer: "${answerText}"`, isDecision: true
    }]);
    setHasAnsweredMcq(true); // <-- Mark MCQ as answered
    setShowInteractionArea(false); // Hide options immediately
    // Reset selected option visually *after* marking as answered but *before* loading next step
    setSelectedMcqOption(null);
    await loadScenarioStep(null, userId); // Load feedback/completion step (decisionIndex is null for MCQ feedback)
  }

  function handleEndScenario() {
    router.push("/dashboard"); // Or wherever the user should go after completion
  }

  // --- Visibility Flags ---
  // Note: These flags determine if the *options* are shown, not the question text itself
  const isShowingDecisionOpt = showInteractionArea && currentStepData?.decisionPoint && !hasAnsweredMcq && !isComplete;
  const isShowingMcqOpt      = showInteractionArea && currentStepData?.mcq && !hasAnsweredMcq && !isComplete;
  // Show feedback ONLY if the feedback exists AND the MCQ has been answered
  const isShowingFeedback    = showInteractionArea && currentStepData?.feedback && hasAnsweredMcq;
  // Show completion ONLY if scenario is complete AND we are NOT showing feedback (feedback takes priority if both are true)
  const isShowingCompletion  = showInteractionArea && isComplete && !isShowingFeedback;

   // --- Calculate currentStep for new ProgressBar (4 steps: D1, D2, D3, MCQ) ---
  let progressBarCurrentStep = 1;
  if (decisionCount === 1) {
    progressBarCurrentStep = 2;
  } else if (decisionCount === 2) {
    progressBarCurrentStep = 3;
  } else if (decisionCount >= 3 || isMcqStepActive || hasAnsweredMcq || isComplete) {
      // If user made 3 decisions OR we are on the MCQ step OR MCQ is answered OR scenario complete -> Mark step 4 (MCQ) as active/done
      progressBarCurrentStep = 4;
  }


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
        <div className="flex-grow overflow-y-auto p-3 md:p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent"> {/* REMOVED large pb-* */}
          {/* Chat bubble rendering unchanged */}
          {staggeredMessages.map(msg => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.character === "User" ? "justify-end" : "justify-start"} animate-fade-in-short`}>
              {msg.character !== "User" && msg.pfp && ( <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 shadow border border-white/20 mb-1 self-start"> <Image src={msg.pfp} alt={`${msg.character} pfp`} width={40} height={40} className="object-cover"/> </div> )}
              {/* Placeholder div for alignment when it's a user message */}
              {msg.character === "User" && !msg.pfp && <div className="w-8 md:w-10 shrink-0"></div>}
              <div className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md ${ msg.character === "User" ? "bg-blue-600 text-white rounded-br-none" : "bg-white/95 text-gray-900 rounded-bl-none" }`}>
                {msg.character !== "User" && (<p className="text-xs font-semibold mb-0.5 text-indigo-700">{msg.character}</p>)}
                <p className={`text-sm leading-relaxed break-words`}>{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoadingApi && !isInitialLoading && ( <div className="flex items-center justify-center p-4"> <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div> <span className="text-sm text-gray-400 italic ml-2">Loading...</span> </div> )}
          <div ref={messagesEndRef} /> {/* Scroll target */}
        </div>

        {/* --- Bottom Area (Character Image + Interactions) --- Fixed Height */}
        {/* This container has a fixed height and prevents the chat from flowing into it */}
        <div className="relative flex-shrink-0 h-[40vh] md:h-[45vh]"> {/* ** NEW CONTAINER ** - `relative` for absolute children, `flex-shrink-0` to prevent shrinking, fixed `h-[]` */}

            {/* --- Character Image Area --- Positioned absolutely WITHIN the bottom-area */}
            <div className="absolute inset-0 flex justify-center items-end pointer-events-none pb-2 md:pb-4"> {/* Use inset-0 to fill parent, adjust padding */}
              {mainCharacterImage && (
                  <Image
                      key={mainCharacterImage} // Re-trigger animation on image change
                      src={mainCharacterImage}
                      alt="Current Character"
                      width={250}
                      height={400}
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
                <div className={`w-full max-w-xl mx-auto space-y-3 p-4 rounded-lg bg-black/60 backdrop-blur-sm shadow-lg`}>

                  {/* Decision Point Options */}
                  {isShowingDecisionOpt && currentStepData?.decisionPoint && (
                    <>
                      {/* Question Text */}
                      <p className="font-semibold text-sm mb-3 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] px-2">
                        {currentStepData.decisionPoint.question}
                      </p>
                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentStepData.decisionPoint.options.map((opt, idx) => ( <button key={idx} onClick={() => handleSelectDecisionOption(idx)} className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none ${selectedDecisionOption === idx ? "border-yellow-400 bg-yellow-500/30 shadow-lg scale-[1.03] text-yellow-100 ring-2 ring-yellow-300/70" : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500 hover:scale-[1.02]"}`}>{opt.text}</button> ))}
                      </div>
                      {/* Confirm Button */}
                      <button onClick={submitDecision} disabled={selectedDecisionOption === null || isLoadingApi} className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-green-500 shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out">Confirm Choice</button>
                    </>
                  )}

                  {/* MCQ Options */}
                  {isShowingMcqOpt && currentStepData?.mcq && (
                    <>
                       {/* Question Text */}
                      <p className="font-semibold text-sm mb-3 text-center text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.5)] px-2">
                          {currentStepData.mcq.question}
                      </p>
                      {/* Options Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {currentStepData.mcq.options.map((opt, idx) => ( <button key={idx} onClick={() => handleSelectMcqOption(idx)} className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none ${selectedMcqOption === idx ? "border-cyan-400 bg-cyan-500/30 shadow-lg scale-[1.03] text-cyan-100 ring-2 ring-cyan-300/70" : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500 hover:scale-[1.02]"}`}>{opt}</button> ))}
                      </div>
                      {/* Submit Button */}
                      <button onClick={submitMcqAnswer} disabled={selectedMcqOption === null || isLoadingApi} className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-blue-500 shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out">Submit Answer</button>
                    </>
                  )}

                  {/* Feedback Display */}
                  {isShowingFeedback && currentStepData?.feedback && lastMcqRef.current && (
                    <div className="text-sm text-center animate-fade-in w-full">
                       {/* Check if selectedMcqOption matches the correct index from the *remembered* MCQ */}
                      {selectedMcqOption === lastMcqRef.current.correctOptionIndex ? (
                         <div className="font-medium mb-3 p-3 rounded-lg border bg-green-800/80 border-green-600 text-green-100 shadow-md">
                            <strong className="block text-base mb-1">Correct!</strong> {currentStepData.feedback.correctFeedback}
                         </div>
                     ) : (
                         <div className="font-medium mb-3 p-3 rounded-lg border bg-red-800/80 border-red-600 text-red-100 shadow-md">
                            <strong className="block text-base mb-1">Incorrect.</strong> {currentStepData.feedback.incorrectFeedback}
                            {/* Safely access the correct answer text using the remembered MCQ */}
                            {typeof lastMcqRef.current.correctOptionIndex === 'number' && lastMcqRef.current.options[lastMcqRef.current.correctOptionIndex] && (
                                <span className="block mt-2 text-xs text-red-200 opacity-90">
                                    (Correct Answer: "{lastMcqRef.current.options[lastMcqRef.current.correctOptionIndex]}")
                                </span>
                            )}
                         </div>
                     )}
                      {/* Show Finish button only if the scenario is complete AND we are showing feedback */}
                      {isComplete && (
                         <button onClick={handleEndScenario} className="mt-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">
                           Finish Scenario
                         </button>
                       )}
                    </div>
                  )}


                  {/* Scenario Completion Message (Only shown if NOT showing feedback) */}
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