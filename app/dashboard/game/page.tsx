"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// --- Interfaces (unchanged) ---
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
  isTyping?: boolean;
}

// --- Constants ---
const NARRATIVE_STEP_DELAY_MS = 2500;
const TYPING_INDICATOR_DELAY_MS = 500;
const TYPING_INDICATOR = "...";

// --- Helper Function to Map Character Name to Image Path ---
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

  // 🔧 NEW – remember last MCQ so we can grade even after it disappears
  const lastMcqRef = useRef<MCQ | null>(null);

  // --- Helpers ---
  const clearDisplayTimeouts = useCallback(() => {
    if (displayTimeoutRef.current) clearTimeout(displayTimeoutRef.current);
    if (textUpdateTimeoutRef.current) clearTimeout(textUpdateTimeoutRef.current);
    displayTimeoutRef.current = null;
    textUpdateTimeoutRef.current = null;
  }, []);

  // 🔧 NEW – finish any lingering typing bubbles
  const flushTypingIndicators = () => {
    setStaggeredMessages(prev =>
      prev.map(m => m.isTyping ? { ...m, isTyping: false, text: "" } : m)
    );
  };

  // --- Effects ---

  // Initial load
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    if (!storedUserId) { router.push("/"); return; }
    setUserId(storedUserId);
    setStaggeredMessages([{
      id: messageIdCounter.current++,
      character: "Narrator",
      pfp: "/game/character_pfp/narrator.png",
      text: TYPING_INDICATOR,
      isTyping: true
    }]);
    loadScenarioStep(null, storedUserId);
    return () => { clearDisplayTimeouts(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // Handle new scenario step
  useEffect(() => {
    if (!currentStepData || isLoadingApi) return;

    clearDisplayTimeouts();
    setShowInteractionArea(false);

    if (isInitialLoading &&
        Array.isArray(currentStepData.narrativeSteps) &&
        currentStepData.narrativeSteps.length > 0) {
      setStaggeredMessages([]);
    }
    setIsInitialLoading(false);

    if (currentStepData.mainCharacterImage !== undefined) {
      if (currentStepData.mainCharacterImage &&
          currentStepData.mainCharacterImage.startsWith("/")) {
        setMainCharacterImage(currentStepData.mainCharacterImage);
      }
    }

    if (currentStepData.mcq) {          // 🔧 NEW – keep reference
      lastMcqRef.current = currentStepData.mcq;
    }

    if (Array.isArray(currentStepData.narrativeSteps) &&
        currentStepData.narrativeSteps.length > 0) {
      setMessageQueue([...currentStepData.narrativeSteps]);
      setIsDisplayingMessages(true);
    } else {
      setMessageQueue([]);
      setIsDisplayingMessages(false);
      if (currentStepData.decisionPoint || currentStepData.mcq ||
          currentStepData.feedback || currentStepData.scenarioComplete) {
        setShowInteractionArea(true);
      }
    }

    if (currentStepData.scenarioComplete) setIsComplete(true);
    if (currentStepData.feedback) setHasAnsweredMcq(true);
    if (currentStepData.error) setError(currentStepData.error);
  }, [currentStepData, isLoadingApi, clearDisplayTimeouts]);

  // Process message queue (unchanged except for comments)
  useEffect(() => {
    if (!isDisplayingMessages || messageQueue.length === 0) {
      if (!isDisplayingMessages && messageQueue.length === 0 &&
          currentStepData && (currentStepData.decisionPoint ||
          currentStepData.mcq || currentStepData.feedback ||
          currentStepData.scenarioComplete)) {
        setShowInteractionArea(true);
      }
      return;
    }

    const displayNextMessage = () => {
      setMessageQueue(prevQueue => {
        const queue = [...prevQueue];
        const next = queue.shift();
        if (!next) return queue;

        const newId = messageIdCounter.current++;

        // image logic
        const imageFromStep = currentStepData?.mainCharacterImage;
        const resolvedImage = imageFromStep && imageFromStep.startsWith("/")
          ? imageFromStep
          : getCharacterImagePath(next.character);
        if (resolvedImage !== mainCharacterImage) setMainCharacterImage(resolvedImage);

        // placeholder
        setStaggeredMessages(prev => [
          ...prev,
          { id: newId, character: next.character, pfp: next.pfp,
            text: TYPING_INDICATOR, isTyping: true }
        ]);

        // replace after delay
        textUpdateTimeoutRef.current = setTimeout(() => {
          setStaggeredMessages(prevMsgs =>
            prevMsgs.map(m =>
              m.id === newId ? { ...m, text: next.text, isTyping: false } : m
            ));
          if (queue.length > 0) {
            displayTimeoutRef.current =
              setTimeout(displayNextMessage, NARRATIVE_STEP_DELAY_MS);
          } else {
            setIsDisplayingMessages(false);
            if (currentStepData && (currentStepData.decisionPoint ||
                currentStepData.mcq || currentStepData.feedback ||
                currentStepData.scenarioComplete)) {
              setShowInteractionArea(true);
            }
          }
        }, TYPING_INDICATOR_DELAY_MS);

        return queue;
      });
    };

    displayTimeoutRef.current = setTimeout(
      displayNextMessage,
      staggeredMessages.length === 1 && staggeredMessages[0].isTyping ? 100
                                                                      : NARRATIVE_STEP_DELAY_MS
    );

    return () => { clearDisplayTimeouts(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisplayingMessages, messageQueue, currentStepData,
      staggeredMessages, mainCharacterImage, clearDisplayTimeouts]);

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
    flushTypingIndicators();
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

        {/* chat history */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-thin
                        scrollbar-thumb-gray-400 scrollbar-track-transparent mb-2">
          {staggeredMessages.map(msg => (
            <div key={msg.id}
                 className={`flex items-end gap-2 ${msg.character === "User"
                   ? "justify-end" : "justify-start"}`}>

              {msg.character !== "User" && msg.pfp && (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 shadow border border-white/20 mb-1 self-start">
                  <Image src={msg.pfp} alt={`${msg.character} pfp`}
                         width={40} height={40} className="object-cover" />
                </div>
              )}
              {msg.character === "User" && <div className="w-8 md:w-10 shrink-0"></div>}

              <div className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md
                               ${msg.character === "User"
                                 ? "bg-blue-600 text-white rounded-br-none"
                                 : msg.isTyping
                                   ? "bg-gray-300 text-gray-600 rounded-bl-none"
                                   : "bg-white/90 text-gray-900 rounded-bl-none"}`}>
                {msg.character !== "User" && !msg.isTyping && (
                  <p className="text-xs font-semibold mb-0.5 text-indigo-700">
                    {msg.character}
                  </p>
                )}
                <p className={`text-sm leading-relaxed break-words
                               ${msg.isTyping ? "animate-pulse" : ""}`}>
                  {msg.text}
                </p>
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
