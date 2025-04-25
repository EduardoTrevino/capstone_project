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

interface DisplayMessage {
  id: number;
  character: string;
  pfp: string | null;
  text: string;
  isDecision?: boolean; // To identify user choices/answers in the chat log
}

// TODO:
// [x] Change to on click instead of narrative delay (remove).
// [ ] Have "setting of scene" pop up like star wars / once upon a time popup dialog. to set the setting (Separate feature request)
// [ ] finish figma format matching
// [ ] 1 goal, 2 scenarios (arrays), 3KC's (array)

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
            return null; // Or a default placeholder image path
    }
};


export default function NarrativeGamePage() {
  const router = useRouter();

  // --- State ---
  const [currentStepData, setCurrentStepData] = useState<ScenarioStep | null>(null);
  const [staggeredMessages, setStaggeredMessages] = useState<DisplayMessage[]>([]);
  const [messageQueue, setMessageQueue] = useState<NarrativeDialogue[]>([]);
  const [showInteractionArea, setShowInteractionArea] = useState(false); // Controls visibility of specific interactions (decision, MCQ, feedback)
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

  // --- Refs ---
  const messagesEndRef = useRef<null | HTMLDivElement>(null);
  const messageIdCounter = useRef(0);
  const lastMcqRef = useRef<MCQ | null>(null); // To remember correct MCQ answer for feedback grading


  // --- Effects ---

  // Initial load: Get userId and fetch the first scenario step
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) {
      console.error("User ID not found, redirecting.");
      router.push("/"); // Redirect if no user ID
      return;
    }
    setUserId(storedUserId);
    setStaggeredMessages([]); // Start with a clean slate
    setIsInitialLoading(true); // Set loading state
    loadScenarioStep(null, storedUserId); // Fetch the initial step
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]); // Only run once on mount (router shouldn't change often)

  // Handle new scenario step data arriving from the API
  useEffect(() => {
    if (!currentStepData || isLoadingApi) return; // Don't process if no data or still loading previous step

    setShowInteractionArea(false); // Hide interaction area until narrative (if any) is done
    setIsInitialLoading(false); // Data received, initial load is complete

    // --- Main Character Image Logic ---
    let stepImage = null;
    if (currentStepData.mainCharacterImage && currentStepData.mainCharacterImage.startsWith('/')) {
        stepImage = currentStepData.mainCharacterImage; // Use image directly from step data if provided
    } else if (Array.isArray(currentStepData.narrativeSteps) && currentStepData.narrativeSteps.length > 0) {
       const firstCharacter = currentStepData.narrativeSteps[0]?.character;
       stepImage = getCharacterImagePath(firstCharacter); // Fallback to first narrative character's image
    }
    // Only update state if the image path actually changes
    if (stepImage !== mainCharacterImage) {
        setMainCharacterImage(stepImage);
    }
    // --- End Main Character Image Logic ---

    // Remember the MCQ if one exists in this step (for feedback grading later)
    if (currentStepData.mcq) {
      lastMcqRef.current = currentStepData.mcq;
    }

    // Reset MCQ answered state if this step contains a new MCQ
    if (currentStepData.mcq) {
        setHasAnsweredMcq(false);
        setSelectedMcqOption(null);
    }
     // Reset decision selection if this step contains a new decision
    if (currentStepData.decisionPoint) {
        setSelectedDecisionOption(null);
    }


    // Queue up narrative steps
    if (Array.isArray(currentStepData.narrativeSteps) && currentStepData.narrativeSteps.length > 0) {
      setMessageQueue([...currentStepData.narrativeSteps]);
      // Don't automatically show interactions yet, wait for user clicks via handleNextStep
    } else {
      // No narrative steps in this part. Interactions should appear immediately.
      setMessageQueue([]);
      if (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete) {
         setShowInteractionArea(true); // Show interactions right away
      }
    }

    // Update overall completion status
    if (currentStepData.scenarioComplete) {
      setIsComplete(true);
    }
    // Handle feedback state (important for showing feedback correctly *after* answering MCQ)
    if (currentStepData.feedback) {
        // Only set showInteractionArea if hasAnsweredMcq is true, otherwise feedback waits
        if (hasAnsweredMcq) {
             setShowInteractionArea(true);
        }
    }

    // Handle potential errors from the API response
    if (currentStepData.error) {
      setError(currentStepData.error);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStepData, isLoadingApi]); // Rerun when new step data arrives or loading state changes

  // Update progress bar based on game state
  useEffect(() => {
    let p = 5; // Starting progress
    if (decisionCount === 1) p = 25;
    else if (decisionCount === 2) p = 50;
    else if (decisionCount === 3) p = 75;

    // Progress bumps for MCQ stages
    if (currentStepData?.mcq && !hasAnsweredMcq) p = Math.max(p, 90); // Show MCQ
    if (hasAnsweredMcq && !isComplete) p = Math.max(p, 95); // Answered MCQ, waiting for completion

    if (isComplete) p = 100; // Scenario finished

    setProgress(p);
  }, [decisionCount, currentStepData, hasAnsweredMcq, isComplete]);

  // Auto-scroll chat history to the bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [staggeredMessages]);


  // --- Core Logic Functions ---

  // Fetch Scenario Step from API
  const loadScenarioStep = useCallback(async (decisionIndex: number | null, uid: string) => {
    if (!uid) {
      setError("User ID is missing. Cannot load scenario.");
      setIsInitialLoading(false); // Stop initial loading state if userId is missing
      return;
    }

    setIsLoadingApi(true); // Set loading flag
    setError(null); // Clear previous errors
    setShowInteractionArea(false); // Hide interactions during load
    setMessageQueue([]); // Clear any leftover message queue

    // Keep the user's choice/answer message if we are loading based on a decision/answer
    if (decisionIndex !== null || hasAnsweredMcq) {
        // Find the last user message (decision or MCQ answer) and keep only that one + previous narrative
        // This prevents the user message from disappearing during load.
        // A simpler approach might be to just *not* clear staggeredMessages here,
        // but let's try filtering for clarity.
        // setStaggeredMessages(prev => prev.filter((msg, index, arr) => index !== arr.length - 1 || !msg.isDecision));
        // Actually, let's keep all messages for history, the new step's messages will just append.
    } else {
        // If it's the very first load or not triggered by a decision/MCQ, maybe clear?
        // Let's stick to keeping history for now.
        // setStaggeredMessages([]); // Optional: Clear history on non-decision loads
    }

    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, decisionIndex })
      });

      const responseText = await res.text(); // Read response body once

      if (!res.ok) {
        // Try to parse error message from JSON, fallback to text
        let errorMessage = `HTTP error! status: ${res.status}`;
        try {
            const errorJson = JSON.parse(responseText);
            errorMessage = errorJson.error || errorJson.message || responseText;
        } catch (parseError) {
             errorMessage = responseText || errorMessage; // Use raw text if JSON parsing fails
        }
         throw new Error(errorMessage);
      }

      const data = JSON.parse(responseText); // Parse JSON only if response is ok
      if (data.error) {
        throw new Error(data.error); // Handle application-level errors
      }

      // Reset MCQ answered state ONLY when loading based on a *decision*, not after submitting an MCQ answer.
      if (decisionIndex !== null) {
          setHasAnsweredMcq(false);
          setSelectedMcqOption(null);
      }

      setCurrentStepData(data.scenarioStep); // Set the new step data

    } catch (err: any) {
      console.error("loadScenarioStep error:", err);
      setError(err.message || "Failed to load scenario step. Please try again.");
      setCurrentStepData(null); // Clear data on error to prevent stale state
    } finally {
      setIsLoadingApi(false); // Clear loading flag
    }
  }, [userId, hasAnsweredMcq]); // Include userId and hasAnsweredMcq as dependencies

  // Handle clicks on the "Next" button to show narrative messages one by one
  const handleNextStep = useCallback(() => {
    if (isLoadingApi || messageQueue.length === 0) return; // Don't proceed if loading or queue empty

    setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const nextMessageToShow = queue.shift(); // Get the next message

        if (nextMessageToShow) {
            // Update main character image based on the current speaker, if needed
            const stepImageProvided = currentStepData?.mainCharacterImage && currentStepData.mainCharacterImage.startsWith('/');
            if (!stepImageProvided) {
                const charImage = getCharacterImagePath(nextMessageToShow.character);
                if (charImage !== mainCharacterImage) {
                    setMainCharacterImage(charImage); // Update image immediately
                }
            }

            // Add the narrative message to the display list
            setStaggeredMessages(prev => [...prev, {
                id: messageIdCounter.current++,
                character: nextMessageToShow.character,
                pfp: nextMessageToShow.pfp,
                text: nextMessageToShow.text,
                isDecision: false // It's a narrative message
            }]);

            setShowInteractionArea(false); // Ensure interactions remain hidden

            // If this was the *last* message in the queue, check if interactions should show *now*
             if (queue.length === 0 && currentStepData && (currentStepData.decisionPoint || currentStepData.mcq || currentStepData.feedback || currentStepData.scenarioComplete)) {
                // Show interaction immediately after the last narrative message is displayed
                 if (!currentStepData.feedback || hasAnsweredMcq || isComplete) { // Show feedback only if answered/complete
                    setShowInteractionArea(true);
                }
             }

            return queue; // Return the updated (shorter) queue
        }
        // Should generally not reach here if button is only visible when queue > 0, but handle defensively
        return queue;
    });
  }, [isLoadingApi, messageQueue, currentStepData, mainCharacterImage, hasAnsweredMcq, isComplete]);

  // --- Interaction Handlers ---

  // Select a decision option (visual selection only)
  function handleSelectDecisionOption(index: number) {
    if (isLoadingApi || currentStepData?.mcq || isComplete || !showInteractionArea) return; // Prevent selection when not appropriate
    setSelectedDecisionOption(index);
  }

  // Confirm and submit the selected decision
  async function submitDecision() {
    if (selectedDecisionOption === null || !userId || !currentStepData?.decisionPoint || isLoadingApi) return;

    const choiceText = currentStepData.decisionPoint.options[selectedDecisionOption]?.text;
    // Add user's choice to the message list for visual confirmation
    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++,
      character: "User", // Special identifier for user actions
      pfp: null, // No profile picture for the user
      text: `I choose: "${choiceText}"`,
      isDecision: true // Mark this as a user decision message
    }]);

    setDecisionCount(c => c + 1); // Increment decision counter for progress
    const decisionIndexToSubmit = selectedDecisionOption; // Store before resetting
    setSelectedDecisionOption(null); // Reset selection visually
    setShowInteractionArea(false); // Hide decision options

    await loadScenarioStep(decisionIndexToSubmit, userId); // Load the next step based on the decision
  }

  // Select an MCQ option (visual selection only)
  function handleSelectMcqOption(index: number) {
    if (hasAnsweredMcq || isLoadingApi || isComplete || !showInteractionArea) return; // Prevent selection when not appropriate
    setSelectedMcqOption(index);
  }

  // Submit the selected MCQ answer
  async function submitMcqAnswer() {
    if (selectedMcqOption === null || !userId || !currentStepData?.mcq || hasAnsweredMcq || isLoadingApi) return;

    const answerText = currentStepData.mcq.options[selectedMcqOption];
    // Add user's answer to the message list
    setStaggeredMessages(prev => [...prev, {
      id: messageIdCounter.current++,
      character: "User",
      pfp: null,
      text: `My answer: "${answerText}"`,
      isDecision: true // Use isDecision flag to indicate it's a user response
    }]);

    setHasAnsweredMcq(true); // Mark MCQ as answered *before* loading next step (important for feedback logic)
    // Note: We don't reset selectedMcqOption here so feedback can use it for comparison.
    setShowInteractionArea(false); // Hide MCQ options

    // Load the next step (usually feedback). Pass null for decisionIndex as it's an MCQ answer.
    await loadScenarioStep(null, userId);
  }

  // Navigate back to the dashboard after completion or error
  function handleEndScenario() {
    router.push("/dashboard");
  }

  // --- Visibility Flags for Rendering ---
  const hasPendingNarrative = messageQueue.length > 0 && !isLoadingApi;
  // The interaction container holds the "Next" button OR the actual interactions
  const showInteractionContainer = (hasPendingNarrative || showInteractionArea) && !isLoadingApi;

  // Determine which specific interaction to show (only one at a time, after narrative)
  const isShowingDecisionOpt = showInteractionArea && currentStepData?.decisionPoint && !hasAnsweredMcq && !isComplete;
  const isShowingMcqOpt      = showInteractionArea && currentStepData?.mcq && !hasAnsweredMcq && !isComplete;
  // Show feedback *only if* an MCQ was just answered OR if feedback is part of the step data and MCQ was previously answered
  const isShowingFeedback    = showInteractionArea && currentStepData?.feedback && hasAnsweredMcq;
  // Show completion message if the scenario is marked complete AND we are not showing feedback instead
  const isShowingCompletion  = showInteractionArea && isComplete && !isShowingFeedback;


  // --- Render ---

  // Render Error State
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100 text-gray-800">
        <div className="bg-white p-6 rounded-lg shadow-xl text-center max-w-md border border-red-300">
          <h2 className="text-xl font-semibold text-red-700 mb-4">An Error Occurred</h2>
          <p className="text-red-600 mb-5">{error}</p>
          <button
            onClick={handleEndScenario} // Use the end scenario function to navigate back
            className="px-5 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out">
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render Initial Loading State
   if (isInitialLoading) {
     return (
         <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white text-xl font-semibold">
             Loading Scenario...
         </div>
     );
   }

  // Render Main Game UI
  return (
    <div
      className="relative w-full h-screen flex flex-col overflow-hidden bg-gray-800" // Fallback bg color
      style={{ backgroundImage: `url(/game/bgs/bg_1.png)`,
               backgroundSize: 'cover', backgroundPosition: 'center' }}>

      {/* Top Bar (Progress, Log Button) */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4 backdrop-blur-sm bg-black/10">
        <div className="flex-grow flex items-center gap-2 bg-black/30 p-2 rounded-full shadow">
          {/* Progress Bar */}
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden border border-gray-600">
            <div
              className="bg-gradient-to-r from-orange-400 to-yellow-500 h-4 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          {/* Progress Percentage */}
          <span className="text-xs font-medium text-yellow-200 w-8 text-right shrink-0">
            {progress}%
          </span>
        </div>
        {/* Scenario Log Button (Placeholder) */}
        <div className="shrink-0 bg-black/30 p-2 rounded-full shadow cursor-pointer hover:bg-black/50 transition-colors">
          <Image src="/game/book.svg" alt="Scenario Log" width={28} height={28} />
        </div>
      </div>

      {/* Main Content Area (Character + Chat + Interaction) */}
      <div className="flex-grow flex flex-col overflow-hidden pt-16 md:pt-20"> {/* Added more padding top */}

        {/* Character Image Area */}
        <div className="relative flex-shrink-0 h-[35vh] md:h-[40vh] flex justify-center items-end pointer-events-none mb-2">
          {mainCharacterImage ? (
            <Image
              key={mainCharacterImage} // Force re-render if src changes
              src={mainCharacterImage}
              alt="Current Character"
              width={250} // Adjust size as needed
              height={400} // Adjust size as needed
              className="object-contain max-h-full animate-fade-in drop-shadow-lg" // Added fade-in and shadow
              priority // Load main character image faster
            />
          ) : (
            // Optional: Placeholder if no image is available
            <div className="w-[250px] h-[400px] max-h-full"></div>
          )}
        </div>

        {/* Chat History */}
        <div className="flex-grow overflow-y-auto p-3 md:p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400/50 scrollbar-track-transparent mb-2">
          {staggeredMessages.map(msg => (
            <div key={msg.id} className={`flex items-end gap-2 ${msg.character === "User" ? "justify-end" : "justify-start"} animate-fade-in-short`}>
              {/* Profile Picture (for non-user) */}
              {msg.character !== "User" && msg.pfp && (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 shadow border border-white/20 mb-1 self-start">
                    <Image src={msg.pfp} alt={`${msg.character} pfp`} width={40} height={40} className="object-cover"/>
                </div>
              )}
              {/* Spacer (for user messages to align) */}
              {msg.character === "User" && <div className="w-8 md:w-10 shrink-0"></div>}

              {/* Message Bubble */}
              <div className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md ${
                 msg.character === "User"
                   ? "bg-blue-600 text-white rounded-br-none" // User message style
                   : "bg-white/95 text-gray-900 rounded-bl-none" // NPC message style
                }`}
              >
                {/* Character Name (for non-user) */}
                {msg.character !== "User" && (
                  <p className="text-xs font-semibold mb-0.5 text-indigo-700">{msg.character}</p>
                )}
                {/* Message Text */}
                <p className={`text-sm leading-relaxed break-words`}>{msg.text}</p>
              </div>
            </div>
          ))}

          {/* API Loading Indicator in Chat Area */}
          {isLoadingApi && !isInitialLoading && (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
              <span className="text-sm text-gray-400 italic ml-2">Loading...</span>
            </div>
          )}

          {/* Invisible element to scroll to */}
          <div ref={messagesEndRef} />
        </div>

        {/* Interaction Area (Next Button or Options/Feedback/Completion) */}
        <div className={`relative p-3 bg-black/30 backdrop-blur-md border-t border-white/10
                         shrink-0 min-h-[90px] md:min-h-[100px] flex flex-col justify-center items-center
                         transition-opacity duration-300 ease-in-out ${
                         showInteractionContainer ? "opacity-100" : "opacity-0 pointer-events-none"
                         }`}>

          {/* "Next" Button (shown when narrative messages are waiting) */}
          {hasPendingNarrative && (
              <button
                  onClick={handleNextStep}
                  className="px-8 py-2.5 bg-gradient-to-r from-gray-600 to-gray-800 text-white
                             rounded-lg text-sm font-bold hover:from-gray-700 hover:to-gray-900
                             shadow-lg transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50
                             transition-all duration-150 ease-in-out animate-fade-in">
                  Next →
              </button>
          )}

          {/* Decision Point Options */}
          {isShowingDecisionOpt && currentStepData?.decisionPoint && (
             <div className="w-full max-w-xl mx-auto animate-fade-in space-y-3">
              <p className="font-semibold text-sm mb-2 text-center text-white px-4">
                {currentStepData.decisionPoint.question}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentStepData.decisionPoint.options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSelectDecisionOption(idx)}
                    className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none
                      ${selectedDecisionOption === idx
                        ? "border-yellow-400 bg-yellow-500/30 shadow-lg scale-[1.03] text-yellow-100 ring-2 ring-yellow-300/70" // Selected style
                        : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500 hover:scale-[1.02]"}`}> {/* Default style */}
                    {opt.text}
                  </button>
                ))}
              </div>
              <button
                onClick={submitDecision}
                disabled={selectedDecisionOption === null || isLoadingApi}
                className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white
                           rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50
                           disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-green-500
                           shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out">
                Confirm Choice
              </button>
             </div>
          )}

          {/* MCQ Options */}
          {isShowingMcqOpt && currentStepData?.mcq && (
             <div className="w-full max-w-xl mx-auto animate-fade-in space-y-3">
               <p className="font-semibold text-sm mb-2 text-center text-white px-4">
                 {currentStepData.mcq.question}
               </p>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                 {currentStepData.mcq.options.map((opt, idx) => (
                   <button
                    key={idx}
                    onClick={() => handleSelectMcqOption(idx)}
                    className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all duration-150 ease-in-out w-full focus:outline-none
                      ${selectedMcqOption === idx
                        ? "border-cyan-400 bg-cyan-500/30 shadow-lg scale-[1.03] text-cyan-100 ring-2 ring-cyan-300/70" // Selected style
                        : "border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500 hover:scale-[1.02]"}`}> {/* Default style */}
                     {opt}
                   </button>
                 ))}
               </div>
               <button
                 onClick={submitMcqAnswer}
                 disabled={selectedMcqOption === null || isLoadingApi}
                 className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white
                           rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                           disabled:opacity-60 disabled:cursor-not-allowed disabled:scale-100 disabled:hover:from-blue-500
                           shadow-lg transform hover:scale-[1.03] transition-all duration-150 ease-in-out">
                 Submit Answer
               </button>
             </div>
          )}

          {/* Feedback Display */}
          {isShowingFeedback && currentStepData?.feedback && lastMcqRef.current && (
            <div className="text-sm text-center max-w-lg mx-auto animate-fade-in w-full px-4">
              {selectedMcqOption === lastMcqRef.current.correctOptionIndex ? (
                // Correct Feedback
                <div className="font-medium mb-3 p-3 rounded-lg border bg-green-800/80 border-green-600 text-green-100 shadow-md">
                  <strong className="block text-base mb-1">Correct!</strong> {currentStepData.feedback.correctFeedback}
                </div>
              ) : (
                // Incorrect Feedback
                <div className="font-medium mb-3 p-3 rounded-lg border bg-red-800/80 border-red-600 text-red-100 shadow-md">
                  <strong className="block text-base mb-1">Incorrect.</strong> {currentStepData.feedback.incorrectFeedback}
                  {/* Optionally show the correct answer */}
                   {typeof lastMcqRef.current.correctOptionIndex === 'number' && (
                      <span className="block mt-2 text-xs text-red-200 opacity-90">
                           (Correct Answer: "{lastMcqRef.current.options[lastMcqRef.current.correctOptionIndex]}")
                      </span>
                   )}
                </div>
              )}

              {/* Button after feedback (only if scenario is now complete) */}
              {isComplete && (
                <button onClick={handleEndScenario}
                  className="mt-2 px-6 py-2 bg-gradient-to-r
                             from-purple-500 to-pink-600 text-white rounded-lg
                             text-sm font-bold hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50
                             shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">
                  Finish Scenario
                </button>
              )}
               {/* If feedback is shown but scenario is NOT complete, user needs to click "Next" if available, or it might auto-load */}
                {!isComplete && hasPendingNarrative && (
                     <p className="text-xs text-gray-400 mt-2">Click 'Next' to continue.</p>
                 )}
            </div>
          )}

          {/* Scenario Completion Message */}
          {isShowingCompletion && (
            <div className="text-center max-w-lg mx-auto animate-fade-in w-full px-4">
              <p className="font-semibold text-lg text-yellow-300 mb-4 drop-shadow">
                Scenario Complete!
              </p>
              <button onClick={handleEndScenario}
                className="px-8 py-2.5 bg-gradient-to-r from-purple-500 to-pink-600 text-white
                           rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50
                           shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out">
                Return to Dashboard
              </button>
            </div>
          )}

        </div> {/* End Interaction Area */}

      </div> {/* End Main Content Area */}

    </div> // End Page Container
  );
}