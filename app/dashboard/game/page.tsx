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

    // Set main character image
    let stepImage = null;
    if (currentStepData.mainCharacterImage?.startsWith('/')) {
        stepImage = currentStepData.mainCharacterImage;
    } else if (currentStepData.narrativeSteps?.[0]) {
       stepImage = getCharacterImagePath(currentStepData.narrativeSteps[0].character);
    }
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
              // Don't show feedback yet
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

      // --- Determine if the *previous* step was an MCQ submission ---
      // We need to know if the user *just* answered the MCQ to avoid resetting hasAnsweredMcq
      // Let's infer this: If decisionIndex is null AND the previous step had an MCQ (lastMcqRef.current is set)
      // AND the new step doesn't have feedback yet (implying it's the step *right after* answering) - this logic is tricky.
      // Simpler approach: Reset hasAnsweredMcq *unless* the incoming step contains feedback.
      if (!data.scenarioStep.feedback) {
          setHasAnsweredMcq(false);
          setSelectedMcqOption(null);
      }
      // If it's feedback, ensure hasAnsweredMcq remains true if it was already true
      else if (data.scenarioStep.feedback) {
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
  }, [userId]);

  // Advance narrative or show interaction area (No changes needed here for UI)
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
                    pfp: nextMessageToShow.pfp,
                    text: nextMessageToShow.text,
                    isDecision: false
                }];
            });

            if (queue.length === 0 && currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
                 if (currentStepData.feedback && !hasAnsweredMcq && currentStepData.mcq) {
                     // Don't show feedback yet
                 } else {
                     setTimeout(() => setShowInteractionArea(true), 0);
                 }
            } else {
                 setShowInteractionArea(false);
            }

            return queue;
        }
        return queue;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingApi, messageQueue, currentStepData, hasAnsweredMcq]);

   // Screen Click Handler (No changes needed here for UI)
   const handleScreenClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
       const target = event.target as HTMLElement;
       if (target.closest('button, a, [data-interactive="true"]')) {
           return;
       }
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

    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++, character: "User", pfp: null, text: `I choose: "${choiceText}"`, isDecision: true
    }]);
    setDecisionCount(c => c + 1); // <-- Increment user decision count
    setSelectedDecisionOption(null);
    setShowInteractionArea(false);
    await loadScenarioStep(decisionIndexToSubmit, userId);
  }

  function handleSelectMcqOption(index: number) {
    if (isLoadingApi || !showInteractionArea || hasAnsweredMcq) return;
    setSelectedMcqOption(index);
  }

  // SUBMIT MCQ: Set hasAnsweredMcq here
  async function submitMcqAnswer() {
    if (selectedMcqOption === null || !userId || isLoadingApi || hasAnsweredMcq) return;
    const answerText = currentStepData?.mcq?.options[selectedMcqOption] || '';

    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++, character: "User", pfp: null, text: `My answer: "${answerText}"`, isDecision: true
    }]);
    setHasAnsweredMcq(true); // <-- Mark MCQ as answered
    setShowInteractionArea(false);
    await loadScenarioStep(null, userId); // Load feedback/completion step
  }

  function handleEndScenario() {
    router.push("/dashboard");
  }

  // --- Visibility Flags ---
  // Note: These flags determine if the *options* are shown, not the question text itself
  const isShowingDecisionOpt = showInteractionArea && currentStepData?.decisionPoint && !hasAnsweredMcq && !isComplete;
  const isShowingMcqOpt      = showInteractionArea && currentStepData?.mcq && !hasAnsweredMcq && !isComplete;
  const isShowingFeedback    = showInteractionArea && currentStepData?.feedback && hasAnsweredMcq;
  const isShowingCompletion  = showInteractionArea && isComplete && !isShowingFeedback;

  // --- Calculate currentStep for new ProgressBar (4 steps: D1, D2, D3, MCQ) ---
  // Step 1: Before D1 (decisionCount = 0)
  // Step 2: After D1, Before D2 (decisionCount = 1)
  // Step 3: After D2, Before D3 (decisionCount = 2)
  // Step 4: After D3 (MCQ stage) OR answered MCQ OR complete (decisionCount = 3 OR hasAnsweredMcq OR isComplete)
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

  return (
    <div
      className="relative w-full h-screen flex flex-col overflow-hidden bg-gray-800"
      style={{ backgroundImage: `url(/game/bgs/bg_1.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* Top Bar - REMOVED blur and background */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4">
        {/* Integrate the new progress bar */}
        <DecisionProgressBar currentStep={progressBarCurrentStep} />
         {/* Book Icon - REMOVED background */}
        <div className="shrink-0 p-2 rounded-full cursor-pointer hover:bg-white/20 transition-colors" data-interactive="true">
          <Image src="/game/book.png" alt="Scenario Log" width={28} height={28} />
        </div>
      </div>

      {/* --- Main Content Area --- ADDED 'relative' for absolute positioning of question */}
      <div
        className="relative flex-grow flex flex-col overflow-hidden pt-16 md:pt-20 cursor-pointer"
        onClick={handleScreenClick}
      >

        {/* --- Chat History --- */}
        <div className="flex-grow overflow-y-auto p-3 md:p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent mb-2">
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

         {/* --- Interaction Area Container --- */}
         {/* REMOVED original background/blur. */}
         {/* Added min-h-[150px] or similar to give space for absolutely positioned question */}
        <div
           className={`relative p-3
                       shrink-0 min-h-[150px] md:min-h-[180px] flex flex-col justify-end items-center
                       transition-opacity duration-300 ease-in-out ${
                       showInteractionArea ? "opacity-100" : "opacity-0 pointer-events-none"
                       }`}
           onClick={(e) => e.stopPropagation()}
           style={{ cursor: 'default' }}
           data-interactive="true"
        >
            {/* Options / Feedback Container - ADDED translucent background here */}
            <div className={`w-full max-w-xl mx-auto space-y-3 p-4 rounded-lg ${ (isShowingDecisionOpt || isShowingMcqOpt || isShowingFeedback || isShowingCompletion) ? 'bg-black/60 backdrop-blur-sm' : '' } `}>
              {/* Decision Point Options */}
              {isShowingDecisionOpt && currentStepData?.decisionPoint && (
                <>
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
            </div> {/* End Options/Feedback Container */}

        </div> {/* End Interaction Area */}

        {/* --- Character Image Area --- */}
        {/* Increased height slightly, adjusted margin */}
        <div className="relative flex-shrink-0 h-[40vh] md:h-[45vh] flex justify-center items-end pointer-events-none mt-[-40px] mb-4 z-0"> {/* Negative margin to pull it up slightly */}
          {mainCharacterImage && (
            <Image key={mainCharacterImage} src={mainCharacterImage} alt="Current Character" width={250} height={400} className="object-contain max-h-full animate-fade-in drop-shadow-lg" priority />
          )}
        </div>

        {/* --- ABSOLUTELY POSITIONED QUESTION TEXT --- */}
        {/* Shown only when Decision or MCQ options are visible */}
        {(isShowingDecisionOpt || isShowingMcqOpt) && (
            <p className="absolute bottom-[160px] md:bottom-[190px] left-1/2 transform -translate-x-1/2 w-full max-w-xl px-6 pointer-events-none z-10 text-center font-semibold text-base text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.7)] animate-fade-in">
              {isShowingDecisionOpt && currentStepData?.decisionPoint?.question}
              {isShowingMcqOpt && currentStepData?.mcq?.question}
            </p>
        )}

      </div> {/* --- End Main Content Area --- */}

    </div> // End Page Container
  );
}