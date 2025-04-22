// app/dashboard/game/page.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// --- Interfaces ---
interface NarrativeDialogue {
  character: "Rani" | "Ali" | "Yash" | "Nisha" | "Narrator"; // Added Narrator for flexibility
  pfp: string; // Path to profile picture, e.g., /game/characters_pfp/rani.png
  text: string;
}

interface DecisionPoint {
  question: string;
  options: string[];
}

interface MCQ {
  question: string;
  options: string[];
  correctOptionIndex: number;
}

interface Feedback {
  correctFeedback: string;
  incorrectFeedback: string;
}

// Represents the data received for a single step in the scenario
interface ScenarioStep {
  narrativeSteps: NarrativeDialogue[];
  mainCharacterImage: string | null; // Path to main character image, e.g., /game/characters/ali.png
  decisionPoint: DecisionPoint | null;
  mcq: MCQ | null;
  feedback: Feedback | null; // Only present after MCQ submission
  scenarioComplete: boolean;
  error?: string; // Optional error message from backend
}

// Represents a message displayed in the chat history
interface DisplayMessage {
  id: number; // Unique ID for mapping
  character: string; // Character name or "User"
  pfp: string | null; // Path to PFP or null for user
  text: string;
  isDecision?: boolean; // Flag if this message represents a user decision
}

export default function NarrativeGamePage() {
  const router = useRouter();

  // --- State Variables ---
  const [currentStepData, setCurrentStepData] = useState<ScenarioStep | null>(null);
  const [displayMessages, setDisplayMessages] = useState<DisplayMessage[]>([]);
  const [mainCharacterImage, setMainCharacterImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start loading initially
  const [error, setError] = useState<string | null>(null);
  const [selectedDecisionOption, setSelectedDecisionOption] = useState<number | null>(null); // For Decision Points
  const [selectedMcqOption, setSelectedMcqOption] = useState<number | null>(null); // For Final MCQ
  const [hasAnsweredMcq, setHasAnsweredMcq] = useState(false);
  const [userId, setUserId] = useState<string>("");
  const [progress, setProgress] = useState(0); // Example progress, might need adjustment logic
  const [decisionCount, setDecisionCount] = useState(0); // Track how many decisions made
  const [isComplete, setIsComplete] = useState(false); // Track if scenario is fully complete

  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const messageIdCounter = useRef(0); // For unique message keys

  // --- Effects ---
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) {
      router.push("/"); // Redirect if no user ID
      return;
    }
    setUserId(storedUserId);
    loadScenarioStep(null, storedUserId); // Load the first step
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // Only run on mount

  // Update progress based on game state
  useEffect(() => {
    let currentProgress = 5;
    if (decisionCount === 1) currentProgress = 25;
    else if (decisionCount === 2) currentProgress = 50;
    else if (decisionCount === 3) currentProgress = 75;
    if (currentStepData?.mcq) currentProgress = 90;
    if (hasAnsweredMcq) currentProgress = 95;
    if (isComplete) currentProgress = 100;
    setProgress(currentProgress);
  }, [decisionCount, currentStepData, hasAnsweredMcq, isComplete]);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages]);

  // Process new step data from API
  useEffect(() => {
    if (currentStepData) {
      // ---> START: Added Safety Check <---
      // Check if narrativeSteps exists and is an array before processing
      if (Array.isArray(currentStepData.narrativeSteps)) {
          if (currentStepData.narrativeSteps.length > 0) {
              // Add new narrative messages to display ONLY if the array is not empty
              const newMessages: DisplayMessage[] = currentStepData.narrativeSteps.map(
                (step) => ({
                  id: messageIdCounter.current++,
                  // Add checks for step properties too, just in case AI misses something
                  character: step?.character || "Narrator", // Default to Narrator if missing
                  pfp: step?.pfp || "/game/characters_pfp/narrator.png", // Default PFP
                  text: step?.text || "...", // Default text
                  isDecision: false, // Ensure this default is set
                })
              );
              setDisplayMessages((prev) => [...prev, ...newMessages]);
          }
          // If narrativeSteps is an empty array, we simply do nothing with it here.
      } else {
          // Log a warning if narrativeSteps is missing or not an array.
          // This might indicate an issue with the API response structure.
          console.warn("Received scenario step where narrativeSteps is missing or not an array:", currentStepData);
          // We don't try to map it, preventing the error.
      }
      // ---> END: Added Safety Check <---


      // Update main character image if provided (this can happen even without new narrative steps)
      if (currentStepData.mainCharacterImage) {
        setMainCharacterImage(currentStepData.mainCharacterImage);
      } else if (currentStepData.mainCharacterImage === null) {
        // If explicitly null is received, you might want to clear the image
        // setMainCharacterImage(null); // Uncomment this if you want null to clear the image
      }

      // Reset selections for the new step
      setSelectedDecisionOption(null);

      // Handle MCQ state based on feedback presence
      if (currentStepData.feedback) {
          // Feedback is present, meaning MCQ was just answered.
          setHasAnsweredMcq(true);
          // Don't reset selectedMcqOption here, we need it to show the feedback correctly.
      } else {
          // No feedback in this step. Reset MCQ selection if appropriate.
          // Only reset if the scenario isn't already marked as complete.
          if (!currentStepData.scenarioComplete) {
             setSelectedMcqOption(null);
             // Only reset hasAnswered if we are clearly before the feedback stage.
             // If mcq is present now, we haven't answered it *yet*.
             if (!currentStepData.mcq) {
                setHasAnsweredMcq(false);
             }
          }
      }

      // Set completion status (can happen with or without feedback, e.g., final narrative step)
      if (currentStepData.scenarioComplete) {
        setIsComplete(true);
        // Ensure MCQ state reflects completion
        setHasAnsweredMcq(true);
      }

      // Handle potential errors passed from the backend
      if (currentStepData.error) {
          setError(currentStepData.error);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepData]); // Triggered when new step data arrives


  // --- Core Logic Functions ---
  async function loadScenarioStep(
    decisionIndex: number | null,
    userIdParam: string
  ) {
    if (!userIdParam) {
      setError("User ID is missing.");
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);

    // Construct the message history to send (only relevant parts if needed)
    // For simplicity now, let's just send the decision made
    const requestBody = {
      userId: userIdParam,
      decisionIndex: decisionIndex, // Send null for the first step or after MCQ
      // Optionally send previous messages if context is needed, but keep it simple for now
      // messages: displayMessages.map(m => ({ role: m.character === 'User' ? 'user' : 'assistant', content: m.text })),
    };

    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        let errData;
        try { errData = await res.json(); } catch { /* ignore */ }
        throw new Error(`HTTP Error ${res.status}: ${errData?.error || res.statusText}`);
      }

      const data = await res.json();
      if (data?.error) {
        throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
      }

      // The API now returns the whole step data in 'scenarioStep'
      const nextStep: ScenarioStep = data.scenarioStep;

      if (!nextStep) { // Basic validation
          throw new Error("Invalid scenario data received from server.");
      }

      setCurrentStepData(nextStep);

    } catch (err: any) {
      console.error("Error loading scenario step:", err);
      setError(err.message || "An unknown error occurred loading the scenario.");
    } finally {
      setIsLoading(false);
    }
  }

  // Handle user selecting a decision point option
  function handleSelectDecisionOption(index: number) {
    if (isLoading || currentStepData?.mcq || isComplete) return; // Don't allow during loading, MCQ, or completion
    setSelectedDecisionOption(index);
  }

  // Handle user submitting their chosen decision
  async function submitDecision() {
    if (selectedDecisionOption === null || isLoading || !userId || !currentStepData?.decisionPoint) return;

    // Add user's choice to the display messages
    const decisionText = currentStepData.decisionPoint.options[selectedDecisionOption];
    const userDecisionMessage: DisplayMessage = {
        id: messageIdCounter.current++,
        character: "User",
        pfp: null, // No PFP for user
        text: `I choose: "${decisionText}"`,
        isDecision: true,
    };
    setDisplayMessages(prev => [...prev, userDecisionMessage]);

    setDecisionCount(prev => prev + 1); // Increment decision count
    await loadScenarioStep(selectedDecisionOption, userId);
  }

  // Handle user selecting an MCQ option
  function handleSelectMcqOption(index: number) {
    if (hasAnsweredMcq || isLoading || isComplete) return;
    setSelectedMcqOption(index);
  }

  // Handle user submitting their MCQ answer
  async function submitMcqAnswer() {
    if (selectedMcqOption === null || isLoading || !userId || !currentStepData?.mcq || hasAnsweredMcq) return;

     // Add user's answer to display messages
     const answerText = currentStepData.mcq.options[selectedMcqOption];
     const userAnswerMessage: DisplayMessage = {
         id: messageIdCounter.current++,
         character: "User",
         pfp: null,
         text: `My answer: "${answerText}"`,
     };
     setDisplayMessages(prev => [...prev, userAnswerMessage]);

    setHasAnsweredMcq(true); // Mark MCQ as answered
    // Send a request to get feedback/completion status
    // We pass 'null' for decisionIndex as this is not a decision point submission
    await loadScenarioStep(null, userId);
  }

  // Handle ending the scenario
  function handleEndScenario() {
    router.push("/dashboard"); // Navigate back to the dashboard
  }

  // --- Render Logic ---

  // Loading state for the entire page initially
  if (isLoading && displayMessages.length === 0 && !error) {
    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100">
            <p className="text-lg font-semibold animate-pulse">Loading Scenario...</p>
        </div>
    );
  }

  // Error display
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100">
        <div className="bg-white p-6 rounded shadow-lg text-center max-w-md">
          <h2 className="text-xl font-semibold text-red-700 mb-4">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => {
              setError(null);
              if (displayMessages.length === 0 && userId) {
                 setIsLoading(true); // Reset loading state for retry
                 loadScenarioStep(null, userId); // Retry loading first step
              } else {
                 router.push("/dashboard"); // Go back if already started
              }
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {displayMessages.length === 0 ? "Retry" : "Go to Dashboard"}
          </button>
        </div>
      </div>
    );
  }

  const isShowingDecisionOptions = currentStepData?.decisionPoint && !isLoading && !currentStepData.mcq && !hasAnsweredMcq && !isComplete;
  const isShowingMcqOptions = currentStepData?.mcq && !hasAnsweredMcq && !isLoading && !isComplete;
  const isShowingFeedback = currentStepData?.feedback && hasAnsweredMcq && !isLoading && !isComplete;
  const isShowingCompletion = isComplete && !isLoading;


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
      <div className="flex-grow flex flex-col overflow-hidden pt-16"> {/* Added padding-top to avoid overlap with absolute header */}

        {/* Character Image Area */}
        <div className="relative flex-shrink-0 h-[35vh] md:h-[40vh] w-full flex justify-center items-end pointer-events-none">
          {mainCharacterImage && (
            <Image
              src={mainCharacterImage}
              alt="Current Character"
              width={250} // Adjust size as needed
              height={400} // Adjust size as needed
              className="object-contain max-h-full"
              priority // Load main character image faster
            />
          )}
           {/* Loading overlay for character area (optional) */}
           {isLoading && !mainCharacterImage && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-white/50">Loading character...</span>
                </div>
            )}
        </div>

        {/* Scrollable Chat History Area */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent mb-2">
          {displayMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex items-end gap-2 ${
                msg.character === "User" ? "justify-end" : "justify-start"
              }`}
            >
              {/* PFP for non-user messages */}
              {msg.character !== "User" && msg.pfp && (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 shadow border border-white/20 mb-1">
                  <Image
                    src={msg.pfp}
                    alt={`${msg.character} pfp`}
                    width={40}
                    height={40}
                    className="object-cover"
                  />
                </div>
              )}
               {/* Placeholder for user messages PFP side */}
               {msg.character === "User" && <div className="w-8 md:w-10 shrink-0"></div>}

              {/* Message Bubble */}
              <div
                className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md ${
                  msg.character === "User"
                    ? "bg-blue-600 text-white rounded-br-none" // User bubble style
                    : "bg-white/90 text-gray-900 rounded-bl-none" // Character bubble style
                }`}
                style={{
                    // Custom style like the example image
                    border: msg.character !== "User" ? '1px solid #e5e7eb' : 'none',
                    backgroundColor: msg.character !== "User" ? '#f9fafb' : '#2563eb', // Example background colors matching screenshot
                    color: msg.character !== "User" ? '#1f2937' : '#ffffff',
                }}
              >
                {/* Optional: Display character name above their message */}
                {msg.character !== "User" && (
                    <p className="text-xs font-semibold mb-0.5 text-indigo-700">{msg.character}</p>
                )}
                {/* Message Text */}
                <p className="text-sm leading-relaxed break-words">{msg.text}</p>
              </div>
            </div>
          ))}

           {/* Loading indicator within chat */}
           {isLoading && (
                 <div className="flex items-end gap-2 justify-start">
                    <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 bg-gray-300 animate-pulse"></div>
                    <div className="max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md bg-white/90 rounded-bl-none">
                        <span className="animate-pulse text-sm text-gray-500">... thinking ...</span>
                    </div>
                 </div>
            )}
          <div ref={messagesEndRef} />
        </div>


        {/* Interaction Area (Decision Point / MCQ / Feedback / Completion) */}
        <div className="relative p-3 bg-black/20 backdrop-blur-sm border-t border-white/10 shrink-0 min-h-[100px] flex flex-col justify-center">
            {/* Decision Point Options */}
            {isShowingDecisionOptions && currentStepData?.decisionPoint && (
                <div className="w-full max-w-lg mx-auto">
                    <p className="font-semibold text-sm mb-3 text-center text-white">{currentStepData.decisionPoint.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {currentStepData.decisionPoint.options.map((opt, idx) => (
                        <button
                        key={idx}
                        onClick={() => handleSelectDecisionOption(idx)}
                        className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ${
                            selectedDecisionOption === idx
                            ? 'border-yellow-400 bg-yellow-400/20 shadow-lg scale-105 text-yellow-100'
                            : 'border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500'
                        }`}
                        >
                        {opt}
                        </button>
                    ))}
                    </div>
                    <button
                        onClick={submitDecision}
                        disabled={selectedDecisionOption === null || isLoading}
                        className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 shadow-lg transform hover:scale-102 transition-transform"
                    >
                    Confirm Choice
                    </button>
                </div>
            )}

             {/* Final MCQ Options */}
            {isShowingMcqOptions && currentStepData?.mcq && (
                <div className="w-full max-w-lg mx-auto">
                    <p className="font-semibold text-sm mb-3 text-center text-white">{currentStepData.mcq.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                    {currentStepData.mcq.options.map((opt, idx) => (
                         <button
                            key={idx}
                            onClick={() => handleSelectMcqOption(idx)}
                            className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ${
                                selectedMcqOption === idx
                                ? 'border-cyan-400 bg-cyan-400/20 shadow-lg scale-105 text-cyan-100'
                                : 'border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500'
                            }`}
                            >
                            {opt}
                        </button>
                    ))}
                    </div>
                    <button
                        onClick={submitMcqAnswer}
                        disabled={selectedMcqOption === null || isLoading}
                        className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50 shadow-lg transform hover:scale-102 transition-transform"
                    >
                    Submit Answer
                    </button>
                </div>
            )}

             {/* Feedback Display */}
             {isShowingFeedback && currentStepData?.feedback && currentStepData?.mcq && (
                 <div className="text-sm text-center max-w-lg mx-auto">
                    {selectedMcqOption === currentStepData.mcq.correctOptionIndex ? (
                      <p className="font-medium mb-3 p-2 rounded border bg-green-700/80 border-green-500 text-green-100">
                         <strong>Correct!</strong> {currentStepData.feedback.correctFeedback}
                      </p>
                    ) : (
                      <p className="font-medium mb-3 p-2 rounded border bg-red-700/80 border-red-500 text-red-100">
                         <strong>Incorrect.</strong> {currentStepData.feedback.incorrectFeedback}
                      </p>
                    )}
                     {/* Continue button might appear here leading to summary/completion */}
                     {/* Or the backend automatically sends the completion step next */}
                 </div>
             )}

            {/* Scenario Completion Message */}
            {isShowingCompletion && (
                 <div className="text-center max-w-lg mx-auto">
                    <p className="font-semibold text-lg text-yellow-300 mb-4">Scenario Complete!</p>
                     {/* Optionally display a final summary message if provided by API */}
                     {currentStepData?.narrativeSteps && currentStepData.narrativeSteps.length > 0 && !currentStepData.feedback && (
                         <p className="text-white mb-4 text-sm">{currentStepData.narrativeSteps[0].text}</p> // Assuming final message is here
                     )}
                    <button
                        onClick={handleEndScenario}
                        className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 shadow-lg transform hover:scale-105 transition-transform"
                    >
                       Return to Dashboard
                    </button>
                 </div>
            )}

            {/* General Loading Indicator for this section */}
             {isLoading && !isShowingDecisionOptions && !isShowingMcqOptions && !isShowingFeedback && !isShowingCompletion && (
                 <div className="flex justify-center items-center h-full">
                    <span className="animate-pulse text-sm text-white/70">Loading next step...</span>
                 </div>
             )}

        </div> {/* End Interaction Area */}
      </div> {/* End Main Content Area */}
    </div> // End Main container
  );
}