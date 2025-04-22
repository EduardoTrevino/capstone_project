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

interface DecisionPointOption { // Define structure for options if they contain more than text
    text: string;
    // nextStep?: string; // Include if your API sends this and you need it later
}

interface DecisionPoint {
  question: string;
  options: DecisionPointOption[]; // Use the defined structure
}

interface MCQ {
  question: string;
  options: string[]; // Assuming MCQ options are just strings
  correctOptionIndex: number;
}

interface Feedback {
  correctFeedback: string;
  incorrectFeedback: string;
}

// Represents the data received for a single step in the scenario
interface ScenarioStep {
  narrativeSteps: NarrativeDialogue[];
  mainCharacterImage: string | null;
  decisionPoint: DecisionPoint | null;
  mcq: MCQ | null;
  feedback: Feedback | null;
  scenarioComplete: boolean;
  error?: string;
}

// Represents a message displayed in the chat history
interface DisplayMessage {
  id: number; // Unique ID for mapping
  character: string;
  pfp: string | null;
  text: string;
  isDecision?: boolean; // Flag if this message represents a user decision
  isTyping?: boolean; // Flag for typing indicator
}

// --- Constants ---
const NARRATIVE_STEP_DELAY_MS = 1500; // Delay between narrative steps (adjust as needed)
const TYPING_INDICATOR_DELAY_MS = 500; // How long the "..." shows before text appears
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
    if (displayTimeoutRef.current) {
      clearTimeout(displayTimeoutRef.current);
      displayTimeoutRef.current = null;
    }
    if (textUpdateTimeoutRef.current) {
        clearTimeout(textUpdateTimeoutRef.current);
        textUpdateTimeoutRef.current = null;
    }
  }, []);

  // --- Effects ---

  // Initial Load: Get User ID, Set Initial Narrator Message, Trigger API Call
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) {
      router.push("/");
      return;
    }
    setUserId(storedUserId);

    // Start with only the narrator typing indicator
    setStaggeredMessages([{
      id: messageIdCounter.current++,
      character: "Narrator",
      pfp: "/game/character_pfp/narrator.png", // Ensure this path is correct
      text: TYPING_INDICATOR,
      isTyping: true, // Mark as typing
    }]);

    loadScenarioStep(null, storedUserId);

    // Cleanup timeouts on unmount
    return () => {
      clearDisplayTimeouts();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // Only run on mount (loadScenarioStep is wrapped in useCallback)

  // Process API Response -> Start Message Queue Processing
  useEffect(() => {
    if (currentStepData && !isLoadingApi) {
      clearDisplayTimeouts(); // Stop any previous display process
      setShowInteractionArea(false); // Hide interactions until new steps are shown

      // If this is the *very first* valid response, clear the initial placeholder
      if (isInitialLoading && Array.isArray(currentStepData.narrativeSteps) && currentStepData.narrativeSteps.length > 0) {
        setStaggeredMessages([]); // Clear placeholder before starting queue
      }
      setIsInitialLoading(false); // Initial load complete

      // Update main character image *before* starting the queue
      if (currentStepData.mainCharacterImage) {
        setMainCharacterImage(currentStepData.mainCharacterImage);
      } else if (currentStepData.mainCharacterImage === null) {
        // Decide if null should clear the image or keep the previous one
        // setMainCharacterImage(null); // Option to clear
      }

      // Queue up the new narrative steps
      if (Array.isArray(currentStepData.narrativeSteps) && currentStepData.narrativeSteps.length > 0) {
        setMessageQueue([...currentStepData.narrativeSteps]);
        setIsDisplayingMessages(true); // Start processing the queue
      } else {
        // No narrative steps, directly check for interactions
        setMessageQueue([]);
        setIsDisplayingMessages(false);
        if (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete) {
          setShowInteractionArea(true);
        }
      }

      // Handle immediate state updates
      if (currentStepData.scenarioComplete) setIsComplete(true);
      if (currentStepData.feedback) setHasAnsweredMcq(true); // Feedback implies MCQ was answered
      if (currentStepData.error) setError(currentStepData.error);
    }
     // This effect should trigger whenever new data arrives from the API
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepData, isLoadingApi]);

  // Process Message Queue for Staggered Display
  useEffect(() => {
    if (!isDisplayingMessages || messageQueue.length === 0) {
      // If queue is done, check if interactions should appear
      if (!isDisplayingMessages && messageQueue.length === 0 && currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
          setShowInteractionArea(true);
      }
      return; // Stop if not displaying or queue is empty
    }

    // Function to display the next message from the queue
    const displayNextMessage = () => {
      setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const nextMessageToShow = queue.shift(); // Take the next message

        if (nextMessageToShow) {
          const newMessageId = messageIdCounter.current++;
          // 1. Add the message placeholder with typing indicator
          const typingMessage: DisplayMessage = {
            id: newMessageId,
            character: nextMessageToShow.character,
            pfp: nextMessageToShow.pfp,
            text: TYPING_INDICATOR,
            isTyping: true,
            isDecision: false,
          };
          setStaggeredMessages(prev => [...prev, typingMessage]);

          // 2. Schedule update to replace "..." with actual text
          textUpdateTimeoutRef.current = setTimeout(() => {
            setStaggeredMessages(prev =>
              prev.map(msg =>
                msg.id === newMessageId ? { ...msg, text: nextMessageToShow.text, isTyping: false } : msg
              )
            );

            // 3. If more messages exist, schedule the *next* full display cycle
            if (queue.length > 0) {
              displayTimeoutRef.current = setTimeout(displayNextMessage, NARRATIVE_STEP_DELAY_MS);
            } else {
              // Queue finished
              setIsDisplayingMessages(false);
              // Show interactions now if applicable based on the *final* currentStepData
               if (currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
                   setShowInteractionArea(true);
               }
            }
          }, TYPING_INDICATOR_DELAY_MS); // Time the "..." is visible
        } else {
           // Queue became empty unexpectedly
           setIsDisplayingMessages(false);
            if (currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
               setShowInteractionArea(true);
           }
        }
        return queue; // Return the remaining queue
      });
    };

    // Start the first message display (or the next one if already running)
    // Add a slight initial delay before the very first message appears
    displayTimeoutRef.current = setTimeout(displayNextMessage, staggeredMessages.length > 0 ? NARRATIVE_STEP_DELAY_MS : 100);

    // Cleanup function for this effect instance
    return () => {
      clearDisplayTimeouts();
    };
    // Dependencies: trigger when display starts/stops or the queue changes
  }, [isDisplayingMessages, messageQueue, currentStepData, clearDisplayTimeouts]);


  // Update progress based on game state
  useEffect(() => {
    let currentProgress = 5;
    if (decisionCount === 1) currentProgress = 25;
    else if (decisionCount === 2) currentProgress = 50;
    else if (decisionCount === 3) currentProgress = 75;
    if (currentStepData?.mcq) currentProgress = 90; // MCQ presented
    if (hasAnsweredMcq) currentProgress = 95; // MCQ answered (includes feedback stage)
    if (isComplete) currentProgress = 100; // Scenario marked complete
    setProgress(currentProgress);
  }, [decisionCount, currentStepData, hasAnsweredMcq, isComplete]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [staggeredMessages]); // Scroll when displayed messages change


  // --- Core Logic Functions ---

  // Fetch Scenario Step from API (wrapped in useCallback)
  const loadScenarioStep = useCallback(async (decisionIndex: number | null, userIdParam: string) => {
    if (!userIdParam) {
      setError("User ID is missing.");
      setIsInitialLoading(false);
      return;
    }
    setIsLoadingApi(true);
    setError(null);
    setShowInteractionArea(false); // Hide interactions during load
    clearDisplayTimeouts(); // Stop any ongoing display
    setIsDisplayingMessages(false);

    const requestBody = { userId: userIdParam, decisionIndex };

    try {
      const res = await fetch("/api/lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(requestBody) });

      if (!res.ok) {
        let errData; try { errData = await res.json(); } catch { /* ignore */ }
        throw new Error(`HTTP Error ${res.status}: ${errData?.error || res.statusText}`);
      }

      const data = await res.json();
      if (data?.error) { throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error)); }

      const nextStep: ScenarioStep = data.scenarioStep;
      if (!nextStep || typeof nextStep !== 'object') { throw new Error("Invalid scenario data received from server."); }

      // Update current step data, triggering the useEffect to process it
      setCurrentStepData(nextStep);

    } catch (err: any) {
      console.error("Error loading scenario step:", err);
      setError(err.message || "An unknown error occurred loading the scenario.");
      setIsInitialLoading(false);
    } finally {
      setIsLoadingApi(false); // Mark API call as finished
    }
  }, [clearDisplayTimeouts]); // Include helpers used inside

  // Select Decision Option
  function handleSelectDecisionOption(index: number) {
    if (isLoadingApi || isDisplayingMessages || currentStepData?.mcq || isComplete) return;
    setSelectedDecisionOption(index);
  }

  // Submit Decision
  async function submitDecision() {
    if (selectedDecisionOption === null || isLoadingApi || isDisplayingMessages || !userId || !currentStepData?.decisionPoint) return;

    const decisionText = currentStepData.decisionPoint.options[selectedDecisionOption]?.text;
    if (!decisionText) { console.error("Selected option text not found"); return; }

    const userDecisionMessage: DisplayMessage = {
        id: messageIdCounter.current++,
        character: "User",
        pfp: null,
        text: `I choose: "${decisionText}"`,
        isDecision: true,
    };
    setStaggeredMessages(prev => [...prev, userDecisionMessage]); // Add immediately
    const currentDecisionIndex = selectedDecisionOption; // Store before resetting
    setDecisionCount(prev => prev + 1);
    setSelectedDecisionOption(null);
    setShowInteractionArea(false); // Hide options
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

     const answerText = currentStepData.mcq.options[selectedMcqOption];
     const userAnswerMessage: DisplayMessage = {
         id: messageIdCounter.current++,
         character: "User",
         pfp: null,
         text: `My answer: "${answerText}"`,
         isDecision: false,
     };
     setStaggeredMessages(prev => [...prev, userAnswerMessage]); // Add immediately

    setHasAnsweredMcq(true); // Mark answered locally
    setShowInteractionArea(false); // Hide options
    await loadScenarioStep(null, userId); // decisionIndex is null for MCQ
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
          <button
            onClick={() => { setError(null); router.push("/dashboard"); /* Or retry logic */ }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          > Go to Dashboard </button>
        </div>
      </div>
    );
  }

  // Determine visibility flags based on state *after* potential loading/displaying
  const isShowingDecisionOptions = showInteractionArea && !isDisplayingMessages && !isLoadingApi && currentStepData?.decisionPoint && !currentStepData.mcq && !hasAnsweredMcq && !isComplete;
  const isShowingMcqOptions = showInteractionArea && !isDisplayingMessages && !isLoadingApi && currentStepData?.mcq && !hasAnsweredMcq && !isComplete;
  const isShowingFeedback = showInteractionArea && !isDisplayingMessages && !isLoadingApi && currentStepData?.feedback && hasAnsweredMcq && !isComplete;
  const isShowingCompletion = showInteractionArea && !isDisplayingMessages && !isLoadingApi && isComplete;

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden" style={{ backgroundImage: `url(/game/bgs/bg_1.png)`, backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* Top Bar: Progress and Book Icon */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4">
         {/* Progress Bar */}
         <div className="flex-grow flex items-center gap-2 bg-black/30 backdrop-blur-sm p-2 rounded-full shadow">
            <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden border border-gray-600">
                <div
                 className="bg-gradient-to-r from-orange-400 to-yellow-500 h-4 rounded-full transition-all duration-500 ease-out"
                 style={{ width: `${progress}%` }}
                 role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
                />
            </div>
            <span className="text-xs font-medium text-yellow-200 w-8 text-right">{progress}%</span>
         </div>
         {/* Book Icon */}
         <div className="shrink-0 bg-black/30 backdrop-blur-sm p-2 rounded-full shadow">
            <Image src="/game/book.svg" alt="Scenario Log" width={28} height={28} />
         </div>
      </div>


      {/* Main Content Area */}
      <div className="flex-grow flex flex-col overflow-hidden pt-16"> {/* Padding top for absolute header */}

        {/* Character Image Area */}
        <div className="relative flex-shrink-0 h-[35vh] md:h-[40vh] w-full flex justify-center items-end pointer-events-none">
          {mainCharacterImage && (
            <Image
              key={mainCharacterImage} // Add key to force re-render on change if needed
              src={mainCharacterImage}
              alt="Current Character"
              width={250}
              height={400}
              className="object-contain max-h-full animate-fade-in" // Simple fade-in animation
              priority
            />
          )}
          {/* Optional: Placeholder if no image and loading initially */}
          {/* {isInitialLoading && !mainCharacterImage && (
             <div className="absolute inset-0 flex items-center justify-center">
                 <span className="text-white/50">Loading character...</span>
             </div>
           )} */}
        </div>

        {/* Scrollable Chat History Area - uses staggeredMessages */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent mb-2">
          {staggeredMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${
                msg.character === "User" ? "justify-end" : "justify-start"
              }`}
            >
              {/* PFP */}
              {msg.character !== "User" && msg.pfp && (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 shadow border border-white/20 mb-1 self-start"> {/* Align PFP top */}
                  <Image src={msg.pfp} alt={`${msg.character} pfp`} width={40} height={40} className="object-cover"/>
                </div>
              )}
              {/* User Placeholder */}
              {msg.character === "User" && <div className="w-8 md:w-10 shrink-0"></div>}

              {/* Message Bubble */}
              <div
                className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md transition-colors duration-300 ${
                  msg.character === "User"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : msg.isTyping ? "bg-gray-300 text-gray-600 rounded-bl-none" : "bg-white/90 text-gray-900 rounded-bl-none" // Style for typing indicator
                }`}
                 style={{
                     border: msg.character !== "User" && !msg.isTyping ? '1px solid #e5e7eb' : 'none',
                     backgroundColor: msg.character === "User" ? '#2563eb' : (msg.isTyping ? '#D1D5DB' : '#f9fafb'),
                     color: msg.character === "User" ? '#ffffff' : (msg.isTyping ? '#4B5563' : '#1f2937'),
                 }}
              >
                {/* Character Name (only if not user and not typing) */}
                {msg.character !== "User" && !msg.isTyping && (
                    <p className="text-xs font-semibold mb-0.5 text-indigo-700">{msg.character}</p>
                )}
                {/* Message Text */}
                <p className={`text-sm leading-relaxed break-words ${msg.isTyping ? 'animate-pulse' : ''}`}>{msg.text}</p>
              </div>
            </div>
          ))}
          {/* API Loading indicator (shows when fetching next step, but not during initial load) */}
           {isLoadingApi && !isInitialLoading && (
                <div className="flex items-end gap-2 justify-start">
                   <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 bg-gray-300 animate-pulse"></div>
                   <div className="max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md bg-gray-300 rounded-bl-none">
                       <span className="animate-pulse text-sm text-gray-500">...</span>
                   </div>
                </div>
           )}
          <div ref={messagesEndRef} />
        </div>


        {/* Interaction Area - visibility controlled */}
        <div className={`relative p-3 bg-black/20 backdrop-blur-sm border-t border-white/10 shrink-0 min-h-[100px] flex flex-col justify-center transition-opacity duration-300 ${showInteractionArea ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>

            {/* Decision Point Options */}
            {isShowingDecisionOptions && currentStepData?.decisionPoint && (
                <div className="w-full max-w-lg mx-auto animate-fade-in">
                    <p className="font-semibold text-sm mb-3 text-center text-white">{currentStepData.decisionPoint.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {currentStepData.decisionPoint.options.map((opt, idx) => (
                        <button
                        key={idx}
                        onClick={() => handleSelectDecisionOption(idx)}
                        // Disable button if another option is already selected (optional visual cue)
                        // disabled={selectedDecisionOption !== null && selectedDecisionOption !== idx}
                        className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ${
                            selectedDecisionOption === idx
                            ? 'border-yellow-400 bg-yellow-400/20 shadow-lg scale-105 text-yellow-100 ring-2 ring-yellow-300' // Highlight selected
                            : 'border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500'
                            // : (selectedDecisionOption !== null ? 'border-gray-400 bg-white/40 text-gray-500 opacity-70 cursor-not-allowed' : 'border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500') // Style for disabled other options
                        }`}
                        >
                           {opt.text} {/* Fixed: Use text property */}
                        </button>
                    ))}
                    </div>
                    <button
                        onClick={submitDecision}
                        disabled={selectedDecisionOption === null || isLoadingApi || isDisplayingMessages} // Disable if no selection or loading/displaying
                        className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transform hover:scale-102 transition-transform"
                    >
                    Confirm Choice
                    </button>
                </div>
            )}

             {/* Final MCQ Options */}
            {isShowingMcqOptions && currentStepData?.mcq && (
                <div className="w-full max-w-lg mx-auto animate-fade-in">
                    <p className="font-semibold text-sm mb-3 text-center text-white">{currentStepData.mcq.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {currentStepData.mcq.options.map((opt, idx) => (
                         <button
                            key={idx}
                            onClick={() => handleSelectMcqOption(idx)}
                            className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ${
                                selectedMcqOption === idx
                                ? 'border-cyan-400 bg-cyan-400/20 shadow-lg scale-105 text-cyan-100 ring-2 ring-cyan-300' // Highlight selected
                                : 'border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500'
                            }`}
                            >
                            {opt} {/* Assuming MCQ options are strings */}
                        </button>
                    ))}
                    </div>
                    <button
                        onClick={submitMcqAnswer}
                        disabled={selectedMcqOption === null || isLoadingApi || isDisplayingMessages} // Disable if no selection or loading/displaying
                        className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg transform hover:scale-102 transition-transform"
                    >
                    Submit Answer
                    </button>
                </div>
            )}

             {/* Feedback Display */}
             {isShowingFeedback && currentStepData?.feedback && currentStepData?.mcq && (
                 <div className="text-sm text-center max-w-lg mx-auto animate-fade-in">
                    {selectedMcqOption === currentStepData.mcq.correctOptionIndex ? (
                      <p className="font-medium mb-3 p-2 rounded border bg-green-700/80 border-green-500 text-green-100">
                         <strong>Correct!</strong> {currentStepData.feedback.correctFeedback}
                      </p>
                    ) : (
                      <p className="font-medium mb-3 p-2 rounded border bg-red-700/80 border-red-500 text-red-100">
                         <strong>Incorrect.</strong> {currentStepData.feedback.incorrectFeedback}
                      </p>
                    )}
                    {/* Feedback display implies completion is next, button handled below */}
                 </div>
             )}

            {/* Scenario Completion Message */}
            {isShowingCompletion && (
                 <div className="text-center max-w-lg mx-auto animate-fade-in">
                    <p className="font-semibold text-lg text-yellow-300 mb-4">Scenario Complete!</p>
                    {/* Optional final summary message (check if API provides one in narrativeSteps on completion) */}
                    {currentStepData?.narrativeSteps && currentStepData.narrativeSteps.length > 0 && !currentStepData.feedback && (
                        <p className="text-white mb-4 text-sm">{currentStepData.narrativeSteps[0].text}</p>
                    )}
                    <button
                        onClick={handleEndScenario}
                        className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 shadow-lg transform hover:scale-105 transition-transform"
                    >
                       Return to Dashboard
                    </button>
                 </div>
            )}

            {/* Loading indicator can be removed from here if covered by the chat area indicator */}

        </div> {/* End Interaction Area */}
      </div> {/* End Main Content Area */}
    </div> // End Main container
  );
}

// Add simple fade-in animation CSS (e.g., in your global.css)
/*
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.animate-fade-in {
  animation: fadeIn 0.5s ease-in-out;
}
*/