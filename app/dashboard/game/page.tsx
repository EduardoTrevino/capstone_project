// app/dashboard/game/page.tsx
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

interface DecisionPointOption {
  text: string; // API now guarantees this structure
}

interface DecisionPoint {
  question: string;
  options: DecisionPointOption[]; // Array of objects {text: string}
}

interface MCQ {
  question: string;
  options: string[]; // Array of strings
  correctOptionIndex: number;
}

interface Feedback {
  correctFeedback: string;
  incorrectFeedback: string;
}

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
  isTyping?: boolean;
}

// --- Constants ---
const NARRATIVE_STEP_DELAY_MS = 1500;
const TYPING_INDICATOR_DELAY_MS = 500;
const TYPING_INDICATOR = "...";

export default function NarrativeGamePage() {
  const router = useRouter();

  // --- State Variables ---
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
  const textUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Helper Functions ---
  const clearDisplayTimeouts = useCallback(() => {
    if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
    if (textUpdateTimeoutRef.current) clearTimeout(textUpdateTimeoutRef.current);
    displayTimeoutRef.current = null;
    textUpdateTimeoutRef.current = null;
  }, []);

  // --- Effects ---

  // Initial Load
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) { router.push("/"); return; }
    setUserId(storedUserId);
    setStaggeredMessages([{
      id: messageIdCounter.current++, character: "Narrator",
      pfp: "/game/character_pfp/narrator.png", text: TYPING_INDICATOR, isTyping: true,
    }]);
    loadScenarioStep(null, storedUserId);
    return () => { clearDisplayTimeouts(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Process API Response -> Start Message Queue
  useEffect(() => {
    if (currentStepData && !isLoadingApi) {
      clearDisplayTimeouts();
      setShowInteractionArea(false);

      if (isInitialLoading && Array.isArray(currentStepData.narrativeSteps) && currentStepData.narrativeSteps.length > 0) {
        setStaggeredMessages([]);
      }
      setIsInitialLoading(false);

      if (currentStepData.mainCharacterImage !== undefined) { // Check if the key exists (even if null)
        setMainCharacterImage(currentStepData.mainCharacterImage);
        console.log("Setting main character image:", currentStepData.mainCharacterImage);
      }

      if (Array.isArray(currentStepData.narrativeSteps) && currentStepData.narrativeSteps.length > 0) {
        setMessageQueue([...currentStepData.narrativeSteps]);
        setIsDisplayingMessages(true);
      } else {
        setMessageQueue([]);
        setIsDisplayingMessages(false);
        if (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete) {
          setShowInteractionArea(true);
        }
      }
      if (currentStepData.scenarioComplete) setIsComplete(true);
      if (currentStepData.feedback) setHasAnsweredMcq(true);
      if (currentStepData.error) setError(currentStepData.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepData, isLoadingApi]);

  // Process Message Queue for Staggered Display
  useEffect(() => {
    if (!isDisplayingMessages || messageQueue.length === 0) {
      if (!isDisplayingMessages && messageQueue.length === 0 && currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
        setShowInteractionArea(true);
      }
      return;
    }

    const displayNextMessage = () => {
      setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const nextMessageToShow = queue.shift();

        if (nextMessageToShow) {
          const newMessageId = messageIdCounter.current++;
          const typingMessage: DisplayMessage = {
            id: newMessageId, character: nextMessageToShow.character, pfp: nextMessageToShow.pfp,
            text: TYPING_INDICATOR, isTyping: true, isDecision: false,
          };
          setStaggeredMessages(prev => [...prev, typingMessage]);

          textUpdateTimeoutRef.current = setTimeout(() => {
            setStaggeredMessages(prevMessages =>
              prevMessages.map(msg =>
                msg.id === newMessageId
                  ? { ...msg, text: nextMessageToShow.text, isTyping: false } // Update text & typing
                  : msg
              )
            );

            if (queue.length > 0) {
              displayTimeoutRef.current = setTimeout(displayNextMessage, NARRATIVE_STEP_DELAY_MS);
            } else {
              setIsDisplayingMessages(false);
              if (currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
                setShowInteractionArea(true);
              }
            }
          }, TYPING_INDICATOR_DELAY_MS);
        } else {
           setIsDisplayingMessages(false);
           if (currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
              setShowInteractionArea(true);
           }
        }
        return queue;
      });
    };

    // Start slightly faster if replacing initial narrator message
    displayTimeoutRef.current = setTimeout(displayNextMessage, staggeredMessages.length === 1 && staggeredMessages[0].isTyping ? 100 : NARRATIVE_STEP_DELAY_MS);

    return () => { clearDisplayTimeouts(); };
  }, [isDisplayingMessages, messageQueue, currentStepData, clearDisplayTimeouts, staggeredMessages]); // Added staggeredMessages dependency


  // Update progress
  useEffect(() => {
    let currentProgress = 5;
    if (decisionCount === 1) currentProgress = 25;
    else if (decisionCount === 2) currentProgress = 50;
    else if (decisionCount === 3) currentProgress = 75;
    if (currentStepData?.mcq && !hasAnsweredMcq) currentProgress = 90; // MCQ shown but not answered
    if (hasAnsweredMcq && !isComplete) currentProgress = 95; // MCQ answered / Feedback shown
    if (isComplete) currentProgress = 100;
    setProgress(currentProgress);
  }, [decisionCount, currentStepData, hasAnsweredMcq, isComplete]);

  // Scroll chat to bottom
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [staggeredMessages]);

  // --- Core Logic Functions ---

  // Fetch Scenario Step
  const loadScenarioStep = useCallback(async (decisionIndex: number | null, userIdParam: string) => {
    if (!userIdParam) { setError("User ID is missing."); setIsInitialLoading(false); return; }
    setIsLoadingApi(true); setError(null); setShowInteractionArea(false);
    clearDisplayTimeouts(); setIsDisplayingMessages(false);
    const requestBody = { userId: userIdParam, decisionIndex };
    try {
      const res = await fetch("/api/lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });
      if (!res.ok) { let errData; try { errData = await res.json(); } catch { /* ignore */ } throw new Error(`HTTP Error ${res.status}: ${errData?.error || res.statusText}`); }
      const data = await res.json();
      if (data?.error) { throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error)); }
      const nextStep: ScenarioStep = data.scenarioStep;
      if (!nextStep || typeof nextStep !== 'object') { throw new Error("Invalid scenario data received from server."); }
      setCurrentStepData(nextStep); // Trigger useEffect to process
    } catch (err: any) {
      console.error("Error loading scenario step:", err);
      setError(err.message || "An unknown error occurred loading the scenario.");
      setIsInitialLoading(false);
    } finally {
      setIsLoadingApi(false);
    }
  }, [clearDisplayTimeouts]); // Dependency

  // Select Decision Option
  function handleSelectDecisionOption(index: number) {
    if (isLoadingApi || isDisplayingMessages || currentStepData?.mcq || isComplete) return;
    setSelectedDecisionOption(index);
  }

  // Submit Decision
  async function submitDecision() {
    if (selectedDecisionOption === null || isLoadingApi || isDisplayingMessages || !userId || !currentStepData?.decisionPoint) return;

    // API should now guarantee options[...].text exists if options array exists
    const decisionText = currentStepData.decisionPoint.options[selectedDecisionOption]?.text;
    if (typeof decisionText !== 'string') { // Stricter check
        console.error("Selected option text not found or invalid structure:", currentStepData.decisionPoint.options[selectedDecisionOption]);
        setError("Error processing decision. Please try again or refresh.");
        return;
    }

    const userDecisionMessage: DisplayMessage = {
        id: messageIdCounter.current++, character: "User", pfp: null,
        text: `I choose: "${decisionText}"`, isDecision: true,
    };
    setStaggeredMessages(prev => [...prev, userDecisionMessage]);
    const currentDecisionIndex = selectedDecisionOption;
    setDecisionCount(prev => prev + 1);
    setSelectedDecisionOption(null);
    setShowInteractionArea(false);
    await loadScenarioStep(currentDecisionIndex, userId);
  }

  // Select MCQ Option
  function handleSelectMcqOption(index: number) {
    if (hasAnsweredMcq || isLoadingApi || isDisplayingMessages || isComplete) return;
    setSelectedMcqOption(index);
  }

  // Submit MCQ Answer
  async function submitMcqAnswer() {
    if (selectedMcqOption === null || isLoadingApi || isDisplayingMessages || !userId || !currentStepData?.mcq || hasAnsweredMcq) return;

     // API guarantees options are strings now
     const answerText = currentStepData.mcq.options[selectedMcqOption];
     if (typeof answerText !== 'string') {
         console.error("MCQ option is not a string:", answerText); // Should not happen with API fix
         setError("Error processing answer. Please try again.");
         return;
     }
     const userAnswerMessage: DisplayMessage = {
         id: messageIdCounter.current++, character: "User", pfp: null,
         text: `My answer: "${answerText}"`, isDecision: false,
     };
     setStaggeredMessages(prev => [...prev, userAnswerMessage]);

    setHasAnsweredMcq(true);
    setShowInteractionArea(false);
    await loadScenarioStep(null, userId); // decisionIndex is null
  }

  // End Scenario
  function handleEndScenario() { router.push("/dashboard"); }

  // --- Render Logic ---

  // Error Display
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100">
        <div className="bg-white p-6 rounded shadow-lg text-center max-w-md">
          <h2 className="text-xl font-semibold text-red-700 mb-4">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => { setError(null); router.push("/dashboard"); }} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">Go to Dashboard</button>
        </div>
      </div>
    );
  }

  // Visibility Flags
  const isShowingDecisionOptions = showInteractionArea && !isDisplayingMessages && !isLoadingApi && currentStepData?.decisionPoint && !currentStepData.mcq && !hasAnsweredMcq && !isComplete;
  const isShowingMcqOptions = showInteractionArea && !isDisplayingMessages && !isLoadingApi && currentStepData?.mcq && !hasAnsweredMcq && !isComplete;
  const isShowingFeedback = showInteractionArea && !isDisplayingMessages && !isLoadingApi && currentStepData?.feedback && hasAnsweredMcq && !isComplete;
  const isShowingCompletion = showInteractionArea && !isDisplayingMessages && !isLoadingApi && isComplete;

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden" style={{ backgroundImage: `url(/game/bgs/bg_1.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4">
        <div className="flex-grow flex items-center gap-2 bg-black/30 backdrop-blur-sm p-2 rounded-full shadow">
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden border border-gray-600">
            <div className="bg-gradient-to-r from-orange-400 to-yellow-500 h-4 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-xs font-medium text-yellow-200 w-8 text-right">{progress}%</span>
        </div>
        <div className="shrink-0 bg-black/30 backdrop-blur-sm p-2 rounded-full shadow"><Image src="/game/book.svg" alt="Scenario Log" width={28} height={28} /></div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col overflow-hidden pt-16">
        {/* Character Image Area */}
        <div className="relative flex-shrink-0 h-[35vh] md:h-[40vh] w-full flex justify-center items-end pointer-events-none">
          {/* Debugging Log */}
          {/* {mainCharacterImage && console.log('Rendering main character image:', mainCharacterImage)} */}
          {mainCharacterImage && (
            <Image
              key={mainCharacterImage} // Re-render on change
              src={mainCharacterImage} // e.g., /game/characters/ali.png
              alt="Current Character"
              width={250} height={400}
              className="object-contain max-h-full animate-fade-in"
              priority
              onError={(e) => console.error(`Error loading image: ${mainCharacterImage}`, (e.target as HTMLImageElement).src)}
              unoptimized={process.env.NODE_ENV === 'development'} // Helps bypass Next.js optimization in dev
            />
          )}
        </div>

        {/* Scrollable Chat History Area */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent mb-2">
          {staggeredMessages.map((msg) => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.character === "User" ? "justify-end" : "justify-start"}`}>
              {msg.character !== "User" && msg.pfp && (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 shadow border border-white/20 mb-1 self-start">
                  <Image src={msg.pfp} alt={`${msg.character} pfp`} width={40} height={40} className="object-cover"/>
                </div>
              )}
              {msg.character === "User" && <div className="w-8 md:w-10 shrink-0"></div>}
              <div className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md transition-colors duration-300 ${
                  msg.character === "User" ? "bg-blue-600 text-white rounded-br-none"
                  : msg.isTyping ? "bg-gray-300 text-gray-600 rounded-bl-none"
                  : "bg-white/90 text-gray-900 rounded-bl-none" }`}
                 style={{ border: msg.character !== "User" && !msg.isTyping ? '1px solid #e5e7eb' : 'none', backgroundColor: msg.character === "User" ? '#2563eb' : (msg.isTyping ? '#D1D5DB' : '#f9fafb'), color: msg.character === "User" ? '#ffffff' : (msg.isTyping ? '#4B5563' : '#1f2937'), }}>
                {msg.character !== "User" && !msg.isTyping && (<p className="text-xs font-semibold mb-0.5 text-indigo-700">{msg.character}</p>)}
                <p className={`text-sm leading-relaxed break-words ${msg.isTyping ? 'animate-pulse' : ''}`}>{msg.text}</p>
              </div>
            </div>
          ))}
           {isLoadingApi && !isInitialLoading && (
                <div className="flex items-end gap-2 justify-start">
                   <div className="w-8 h-8 md:w-10 md:h-10 rounded-full shrink-0 bg-gray-300 animate-pulse"></div>
                   <div className="max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md bg-gray-300 rounded-bl-none">
                       <span className="animate-pulse text-sm text-gray-500">...</span>
                   </div>
                </div>
           )}
          <div ref={messagesEndRef} />
        </div>

        {/* Interaction Area */}
        <div className={`relative p-3 bg-black/20 backdrop-blur-sm border-t border-white/10 shrink-0 min-h-[100px] flex flex-col justify-center transition-opacity duration-300 ${showInteractionArea ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

            {/* Decision Point Options */}
            {isShowingDecisionOptions && currentStepData?.decisionPoint && (
                <div className="w-full max-w-lg mx-auto animate-fade-in">
                    <p className="font-semibold text-sm mb-3 text-center text-white">{currentStepData.decisionPoint.question}</p>
                    {/* Check for exactly 4 options */}
                    {currentStepData.decisionPoint.options?.length === 4 ? (
                        <>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                                {currentStepData.decisionPoint.options.map((opt, idx) => (
                                    <button key={idx} onClick={() => handleSelectDecisionOption(idx)} className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ${ selectedDecisionOption === idx ? 'border-yellow-400 bg-yellow-400/20 shadow-lg scale-105 text-yellow-100 ring-2 ring-yellow-300' : 'border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500' }`} >
                                        {opt.text} {/* Renders text property */}
                                    </button>
                                ))}
                            </div>
                            <button onClick={submitDecision} disabled={selectedDecisionOption === null || isLoadingApi || isDisplayingMessages} className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transform hover:scale-102 transition-transform" >
                                Confirm Choice
                            </button>
                        </>
                    ) : (
                         <p className="text-center text-red-400 text-sm">Error: Invalid number of decision options ({currentStepData.decisionPoint.options?.length || 0} received).</p>
                    )}
                </div>
            )}

             {/* Final MCQ Options */}
            {isShowingMcqOptions && currentStepData?.mcq && (
                <div className="w-full max-w-lg mx-auto animate-fade-in">
                    <p className="font-semibold text-sm mb-3 text-center text-white">{currentStepData.mcq.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {currentStepData.mcq.options.map((opt, idx) => ( // opt is expected to be a string
                         <button key={idx} onClick={() => handleSelectMcqOption(idx)} className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ${ selectedMcqOption === idx ? 'border-cyan-400 bg-cyan-400/20 shadow-lg scale-105 text-cyan-100 ring-2 ring-cyan-300' : 'border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500' }`} >
                            {opt} {/* Render string directly */}
                        </button>
                    ))}
                    </div>
                    <button onClick={submitMcqAnswer} disabled={selectedMcqOption === null || isLoadingApi || isDisplayingMessages} className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transform hover:scale-102 transition-transform" >
                        Submit Answer
                    </button>
                </div>
            )}

             {/* Feedback Display */}
             {isShowingFeedback && currentStepData?.feedback && currentStepData?.mcq && (
                 <div className="text-sm text-center max-w-lg mx-auto animate-fade-in">
                    {selectedMcqOption === currentStepData.mcq.correctOptionIndex ? ( <p className="font-medium mb-3 p-2 rounded border bg-green-700/80 border-green-500 text-green-100"> <strong>Correct!</strong> {currentStepData.feedback.correctFeedback} </p> )
                    : ( <p className="font-medium mb-3 p-2 rounded border bg-red-700/80 border-red-500 text-red-100"> <strong>Incorrect.</strong> {currentStepData.feedback.incorrectFeedback} </p> )}
                 </div>
             )}

            {/* Scenario Completion Message */}
            {isShowingCompletion && (
                 <div className="text-center max-w-lg mx-auto animate-fade-in">
                    <p className="font-semibold text-lg text-yellow-300 mb-4">Scenario Complete!</p>
                    {currentStepData?.narrativeSteps && currentStepData.narrativeSteps.length > 0 && !currentStepData.feedback && (
                        <p className="text-white mb-4 text-sm">{currentStepData.narrativeSteps[0].text}</p> // Show potential final message
                    )}
                    <button onClick={handleEndScenario} className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 shadow-lg transform hover:scale-105 transition-transform" >
                       Return to Dashboard
                    </button>
                 </div>
            )}

        </div> {/* End Interaction Area */}
      </div> {/* End Main Content Area */}
    </div> // End Main container
  );
}

