"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// --- Interfaces ---
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

// --- REMOVED isTyping flag ---
interface DisplayMessage {
  id: number;
  character: string;
  pfp: string | null;
  text: string;
  isDecision?: boolean;
  // isTyping?: boolean; // Removed
}

// --- Constants ---
const NARRATIVE_STEP_DELAY_MS = 1800; // Slightly increased delay to compensate for no typing indicator

// --- Helper Function to Map Character Name to Image Path ---
const getCharacterImagePath = (characterName: string | null): string | null => {
    if (!characterName) return null;
    const basePath = '/game/characters/';
    switch (characterName.toLowerCase()) {
        case 'rani':      return `${basePath}rani.png`;
        case 'ali':       return `${basePath}ali.png`;
        case 'yash':      return `${basePath}yash.png`;
        case 'nisha':     return `${basePath}nisha.png`;
        case 'narrator':  return `${basePath}narrator.png`; // Ensure this exists
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
  const [isDisplayingMessages, setIsDisplayingMessages] = useState(false);
  const [showInteractionArea, setShowInteractionArea] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [mainCharacterImage, setMainCharacterImage] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDecisionOption, setSelectedDecisionOption] = useState<number | null>(null);
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null);
  const [hasAnsweredMcq, setHasAnsweredMcq] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [decisionCount, setDecisionCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const messageIdCounter = useRef(0);
  const displayTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // const textUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Removed

  // 🔧 NEW – remember last MCQ
  const lastMcqRef = useRef<MCQ | null>(null);

  // --- Helpers ---
  const clearDisplayTimeouts = useCallback(() => {
    if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
    // if (textUpdateTimeoutRef.current) clearTimeout(textUpdateTimeoutRef.current); // Removed
    displayTimeoutRef.current = null;
    // textUpdateTimeoutRef.current = null; // Removed
  }, []);

  // --- Effects ---

  // Initial load
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) { router.push("/"); return; }
    setUserId(storedUserId);
    // 🔧 No initial typing message needed now
    setStaggeredMessages([]);
    setIsInitialLoading(true); // Set back to true until first API call finishes
    loadScenarioStep(null, storedUserId);
    return () => { clearDisplayTimeouts(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Handle new scenario step
  useEffect(() => {
    if (!currentStepData || isLoadingApi) return;

    clearDisplayTimeouts();
    setShowInteractionArea(false);
    setIsInitialLoading(false); // API response received, initial load done

     // --- Main Character Image Logic (moved here for clarity) ---
     // Prefer image from step data if it's a valid path
     let stepImage = null;
     if (currentStepData.mainCharacterImage && currentStepData.mainCharacterImage.startsWith('/')) {
         stepImage = currentStepData.mainCharacterImage;
         console.log("Using mainCharacterImage from step data:", stepImage);
     }
     // If step doesn't provide image, try mapping first character of narrative steps
     else if (Array.isArray(currentStepData.narrativeSteps) && currentStepData.narrativeSteps.length > 0) {
        const firstCharacter = currentStepData.narrativeSteps[0]?.character;
        stepImage = getCharacterImagePath(firstCharacter);
        if (stepImage) console.log(`Using mapped image for first character ${firstCharacter}: ${stepImage}`);
     }
     // Only update state if the resolved path is different
     if (stepImage !== mainCharacterImage) {
         setMainCharacterImage(stepImage);
     }
     // --- End Main Character Image Logic ---


    if (currentStepData.mcq) { lastMcqRef.current = currentStepData.mcq; } // Remember MCQ

    // Queue narrative steps if they exist
    if (Array.isArray(currentStepData.narrativeSteps) && currentStepData.narrativeSteps.length > 0) {
      setMessageQueue([...currentStepData.narrativeSteps]);
      setIsDisplayingMessages(true); // Start processing
    } else {
      // No narrative steps, check if interactions should appear immediately
      setMessageQueue([]);
      setIsDisplayingMessages(false);
      if (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete) {
        setShowInteractionArea(true);
      }
    }

    // Update final states
    if (currentStepData.scenarioComplete) setIsComplete(true);
    if (currentStepData.feedback) setHasAnsweredMcq(true);
    if (currentStepData.error) setError(currentStepData.error);

  // Depend only on step data and loading status
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepData, isLoadingApi]);

  // --- Process message queue (Simplified: No Typing Indicator) ---
  useEffect(() => {
    if (!isDisplayingMessages || messageQueue.length === 0) {
      // If queue processing is done, check if interaction area should be shown
      if (!isDisplayingMessages && messageQueue.length === 0 && currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
          setShowInteractionArea(true);
      }
      return; // Stop if not displaying or queue is empty
    }

    const displayNextMessage = () => {
      setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const nextMessageToShow = queue.shift();

        if (nextMessageToShow) {
           // *** Directly add the final message after delay ***
           displayTimeoutRef.current = setTimeout(() => {
              // Update main image based on THIS specific character *if* step didn't provide one
               const stepImage = currentStepData?.mainCharacterImage;
               if (!stepImage || !stepImage.startsWith('/')) {
                   const charImage = getCharacterImagePath(nextMessageToShow.character);
                   // Only update if different to avoid unnecessary re-renders
                   if (charImage !== mainCharacterImage) {
                     setMainCharacterImage(charImage);
                     console.log(`Setting character image for specific message: ${nextMessageToShow.character} -> ${charImage}`);
                   }
               }

               // Add the actual message
               setStaggeredMessages(prev => [...prev, {
                   id: messageIdCounter.current++,
                   character: nextMessageToShow.character,
                   pfp: nextMessageToShow.pfp,
                   text: nextMessageToShow.text,
                   isTyping: false, // Always false now
                   isDecision: false
               }]);

               // Schedule next cycle or finish
               if (queue.length > 0) {
                   // No need for separate text update timeout
                   displayTimeoutRef.current = setTimeout(displayNextMessage, NARRATIVE_STEP_DELAY_MS);
               } else {
                   setIsDisplayingMessages(false); // Queue finished
                   if (currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
                       setShowInteractionArea(true); // Show interaction after last message
                   }
               }
           }, NARRATIVE_STEP_DELAY_MS); // Delay before showing the message
        } else {
           // Queue became empty unexpectedly
           setIsDisplayingMessages(false);
            if (currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
               setShowInteractionArea(true);
           }
        }
        return queue; // Return remaining queue
      });
    };

    // Start the first message display (or the next one)
    displayTimeoutRef.current = setTimeout(displayNextMessage, isInitialLoading ? 500 : NARRATIVE_STEP_DELAY_MS); // Show first message faster

    // Cleanup
    return () => { clearDisplayTimeouts(); };
  // Dependencies updated
  }, [isDisplayingMessages, messageQueue, currentStepData, clearDisplayTimeouts, isInitialLoading, mainCharacterImage]);

  // Progress bar (unchanged)
  useEffect(() => {
    let p = 5;
    if (decisionCount === 1) p = 25;
    else if (decisionCount === 2) p = 50;
    else if (decisionCount === 3) p = 75;
    if (currentStepData?.mcq && !hasAnsweredMcq) p = 90;
    if (hasAnsweredMcq && !isComplete) p = 95;
    if (isComplete) p = 100;
    setProgress(p);
  }, [decisionCount, currentStepData, hasAnsweredMcq, isComplete]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [staggeredMessages]);

  // --- Core Logic ---

  // Fetch Scenario Step
  const loadScenarioStep = useCallback(async (decisionIndex: number | null, uid: string) => {
    if (!uid) { setError("User ID is missing."); return; }

    // 🔧 NEW – tidy up UI before request
    // flushTypingIndicators();
    setIsLoadingApi(true);
    setError(null);
    setShowInteractionArea(false);
    clearDisplayTimeouts();
    setIsDisplayingMessages(false);

    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, decisionIndex })
      });
      const txt = await res.text();
      if (!res.ok) throw new Error(txt);
      const data = JSON.parse(txt);
      if (data.error) throw new Error(data.error);
      setCurrentStepData(data.scenarioStep);
    } catch (err: any) {
      console.error("loadScenarioStep error:", err);
      setError(err.message || "Unknown error.");
    } finally {
      setIsLoadingApi(false);
    }
  }, [clearDisplayTimeouts]);

  // Select/submit decision (unchanged)
  function handleSelectDecisionOption(i: number) {
    if (isLoadingApi || isDisplayingMessages || currentStepData?.mcq || isComplete) return;
    setSelectedDecisionOption(i);
  }
  async function submitDecision() {
    if (selectedDecisionOption === null || !userId || !currentStepData?.decisionPoint) return;
    const text = currentStepData.decisionPoint.options[selectedDecisionOption]?.text;
    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++, character: "User", pfp: null,
      text: `I choose: "${text}"`, isDecision: true
    }]);
    setDecisionCount(c => c + 1);
    setSelectedDecisionOption(null);
    setShowInteractionArea(false);
    await loadScenarioStep(selectedDecisionOption, userId);
  }

  // Select/submit MCQ (unchanged except lastMcqRef grading)
  function handleSelectMcqOption(i: number) {
    if (hasAnsweredMcq || isLoadingApi || isDisplayingMessages || isComplete) return;
    setSelectedMcqOption(i);
  }
  async function submitMcqAnswer() {
    if (selectedMcqOption === null || !userId || !currentStepData?.mcq || hasAnsweredMcq) return;
    const ans = currentStepData.mcq.options[selectedMcqOption];
    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++, character: "User", pfp: null,
      text: `My answer: "${ans}"`, isDecision: false
    }]);
    setHasAnsweredMcq(true);
    setShowInteractionArea(false);
    await loadScenarioStep(null, userId);
  }

  function handleEndScenario() { router.push("/dashboard"); }

  // --- Visibility Flags (simplified) ---
  const canShowInteraction   = showInteractionArea && !isDisplayingMessages && !isLoadingApi;
  const isShowingFeedback    = canShowInteraction && currentStepData?.feedback && hasAnsweredMcq;
  const isShowingCompletion  = canShowInteraction && isComplete && !isShowingFeedback;
  const isShowingDecisionOpt = canShowInteraction && currentStepData?.decisionPoint && !isShowingFeedback && !isShowingCompletion;
  const isShowingMcqOpt      = canShowInteraction && currentStepData?.mcq && !hasAnsweredMcq && !isShowingFeedback && !isShowingCompletion;

  // --- Render ---
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100">
        <div className="bg-white p-6 rounded shadow-lg text-center max-w-md">
          <h2 className="text-xl font-semibold text-red-700 mb-4">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => { setError(null); router.push("/dashboard"); }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-screen flex flex-col overflow-hidden"
      style={{ backgroundImage: `url(/game/bgs/bg_1.png)`,
               backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* top bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4">
        <div className="flex-grow flex items-center gap-2 bg-black/30 backdrop-blur-sm p-2 rounded-full shadow">
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden border border-gray-600">
            <div
              className="bg-gradient-to-r from-orange-400 to-yellow-500 h-4 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-medium text-yellow-200 w-8 text-right">
            {progress}%
          </span>
        </div>
        <div className="shrink-0 bg-black/30 backdrop-blur-sm p-2 rounded-full shadow">
          <Image src="/game/book.svg" alt="Scenario Log" width={28} height={28} />
        </div>
      </div>

      {/* main content */}
      <div className="flex-grow flex flex-col overflow-hidden pt-16">

        {/* character image */}
        <div className="relative flex-shrink-0 h-[35vh] md:h-[40vh] flex justify-center items-end pointer-events-none">
          {mainCharacterImage && (
            <Image
              key={mainCharacterImage}
              src={mainCharacterImage}
              alt="Character"
              width={250}
              height={400}
              className="object-contain max-h-full animate-fade-in"
              priority />
          )}
        </div>

        {/* Chat History */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent mb-2">
          {staggeredMessages.map(msg => (
            // --- REMOVED isTyping logic from rendering ---
            <div key={msg.id} className={`flex items-end gap-2 ${msg.character === "User" ? "justify-end" : "justify-start"}`}>
              {msg.character !== "User" && msg.pfp && ( <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 shadow border border-white/20 mb-1 self-start"> <Image src={msg.pfp} alt={`${msg.character} pfp`} width={40} height={40} className="object-cover"/> </div> )}
              {msg.character === "User" && <div className="w-8 md:w-10 shrink-0"></div>}
              <div className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md transition-colors duration-300 ${ msg.character === "User" ? "bg-blue-600 text-white rounded-br-none" : "bg-white/90 text-gray-900 rounded-bl-none" }`} // Simplified style - no typing variant needed
                 style={{ border: msg.character !== "User" ? '1px solid #e5e7eb' : 'none', backgroundColor: msg.character === "User" ? '#2563eb' : '#f9fafb', color: msg.character === "User" ? '#ffffff' : '#1f2937' }}>
                {msg.character !== "User" && (<p className="text-xs font-semibold mb-0.5 text-indigo-700">{msg.character}</p>)}
                <p className={`text-sm leading-relaxed break-words`}>{msg.text}</p> {/* Removed animate-pulse */}
              </div>
            </div>
          ))}

          {isLoadingApi && !isInitialLoading && (
            <div className="flex items-end gap-2 justify-start">
              <div className="w-8 h-8 md:w-10 md:h-10 rounded-full shrink-0 bg-gray-300 animate-pulse"></div>
              <div className="max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md
                              bg-gray-300 rounded-bl-none">
                <span className="animate-pulse text-sm text-gray-500">...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* interaction area */}
        <div className={`relative p-3 bg-black/20 backdrop-blur-sm border-t border-white/10
                         shrink-0 min-h-[100px] flex flex-col justify-center
                         transition-opacity duration-300 ${showInteractionArea
                         ? "opacity-100" : "opacity-0 pointer-events-none"}`}>

          {/* decision options */}
          {isShowingDecisionOpt && currentStepData?.decisionPoint && (
            <div className="w-full max-w-lg mx-auto animate-fade-in">
              <p className="font-semibold text-sm mb-3 text-center text-white">
                {currentStepData.decisionPoint.question}
              </p>
              {currentStepData.decisionPoint.options?.length === 4 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {currentStepData.decisionPoint.options.map((opt, idx) => (
                      <button key={idx}
                        onClick={() => handleSelectDecisionOption(idx)}
                        className={`p-2.5 rounded-lg border-2 text-sm text-left
                          transition-all duration-150
                          ${selectedDecisionOption === idx
                            ? "border-yellow-400 bg-yellow-400/20 shadow-lg scale-105 text-yellow-100 ring-2 ring-yellow-300"
                            : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500"}`}>
                        {opt.text}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={submitDecision}
                    disabled={selectedDecisionOption === null || isLoadingApi || isDisplayingMessages}
                    className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white
                               rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700
                               disabled:opacity-50 disabled:cursor-not-allowed shadow-lg
                               transform hover:scale-102 transition-transform">
                    Confirm Choice
                  </button>
                </>
              ) : (
                <p className="text-center text-red-400 text-sm">
                  Error: Invalid number of options.
                </p>
              )}
            </div>
          )}

          {/* MCQ options */}
          {isShowingMcqOpt && currentStepData?.mcq && (
            <div className="w-full max-w-lg mx-auto animate-fade-in">
              <p className="font-semibold text-sm mb-3 text-center text-white">
                {currentStepData.mcq.question}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {currentStepData.mcq.options.map((opt, idx) => (
                  <button key={idx}
                    onClick={() => handleSelectMcqOption(idx)}
                    className={`p-2.5 rounded-lg border-2 text-sm text-left
                      transition-all duration-150
                      ${selectedMcqOption === idx
                        ? "border-cyan-400 bg-cyan-400/20 shadow-lg scale-105 text-cyan-100 ring-2 ring-cyan-300"
                        : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500"}`}>
                    {opt}
                  </button>
                ))}
              </div>
              <button
                onClick={submitMcqAnswer}
                disabled={selectedMcqOption === null || isLoadingApi || isDisplayingMessages}
                className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white
                           rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700
                           disabled:opacity-50 disabled:cursor-not-allowed shadow-lg
                           transform hover:scale-102 transition-transform">
                Submit Answer
              </button>
            </div>
          )}

          {/* feedback */}
          {isShowingFeedback && currentStepData?.feedback && (
            <div className="text-sm text-center max-w-lg mx-auto animate-fade-in">
              {selectedMcqOption === lastMcqRef.current?.correctOptionIndex ? (
                <p className="font-medium mb-3 p-2 rounded border
                               bg-green-700/80 border-green-500 text-green-100">
                  <strong>Correct!</strong> {currentStepData.feedback.correctFeedback}
                </p>
              ) : (
                <p className="font-medium mb-3 p-2 rounded border
                               bg-red-700/80 border-red-500 text-red-100">
                  <strong>Incorrect.</strong> {currentStepData.feedback.incorrectFeedback}
                </p>
              )}

              {isComplete && (
                <button onClick={handleEndScenario}
                  className="mt-2 px-6 py-2 bg-gradient-to-r
                             from-purple-500 to-pink-600 text-white rounded-lg
                             text-sm font-bold hover:from-purple-600 hover:to-pink-700
                             shadow-lg transform hover:scale-105 transition-transform">
                  Return to Dashboard
                </button>
              )}
            </div>
          )}

          {/* completion */}
          {isShowingCompletion && (
            <div className="text-center max-w-lg mx-auto animate-fade-in">
              <p className="font-semibold text-lg text-yellow-300 mb-4">
                Scenario Complete!
              </p>
              <button onClick={handleEndScenario}
                className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white
                           rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700
                           shadow-lg transform hover:scale-105 transition-transform">
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
