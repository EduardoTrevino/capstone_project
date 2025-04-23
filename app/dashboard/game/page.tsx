"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

// ---------- Interfaces ----------
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

// ---------- Timings ----------
const MSG_DELAY_MS    = 500;   // delay before each new bubble
const STEP_DELAY_MS   = 2200;  // pause after a bubble before next one

// ---------- Helper ----------
const getCharacterImagePath = (name: string | null): string | null => {
  if (!name) return null;
  const p = "/game/characters/";
  switch (name.toLowerCase()) {
    case "rani":     return `${p}rani.png`;
    case "ali":      return `${p}ali.png`;
    case "yash":     return `${p}yash.png`;
    case "nisha":    return `${p}nisha.png`;
    case "narrator": return `${p}narrator.png`;
    default:         return null;
  }
};

// ===================================================================

export default function NarrativeGamePage() {
  const router = useRouter();

  // ---------- State ----------
  const [currentStepData, setCurrentStepData] = useState<ScenarioStep | null>(null);
  const [staggeredMessages, setStaggeredMessages] = useState<DisplayMessage[]>([]);
  const [messageQueue, setMessageQueue] = useState<NarrativeDialogue[]>([]);
  const [isDisplaying, setIsDisplaying]   = useState(false);
  const [showInteraction, setShowInteraction] = useState(false);
  const [isLoadingApi, setIsLoadingApi]   = useState(false);
  const [mainImg, setMainImg]             = useState<string | null>(null);
  const [error, setError]                 = useState<string | null>(null);

  const [selectedDecision, setSelectedDecision] = useState<number | null>(null);
  const [selectedMcq, setSelectedMcq] = useState<number | null>(null);
  const [hasAnsweredMcq, setHasAnsweredMcq] = useState(false);
  const [isComplete, setIsComplete] = useState(false);

  const [progress, setProgress] = useState(0);
  const [decisionCount, setDecisionCount] = useState(0);

  const userIdRef   = useRef<string>("");
  const lastMcqRef  = useRef<MCQ | null>(null);
  const idCounter   = useRef(0);
  const timers      = useRef<NodeJS.Timeout[]>([]);
  const endRef      = useRef<HTMLDivElement | null>(null);

  // ---------- Utils ----------
  const clearTimers = () => {
    timers.current.forEach(t => clearTimeout(t));
    timers.current = [];
  };

  // ---------- Initial load ----------
  useEffect(() => {
    const id = localStorage.getItem("userId");
    if (!id) { router.push("/"); return; }
    userIdRef.current = id;
    loadScenarioStep(null);
    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- handle new step ----------
  useEffect(() => {
    if (!currentStepData || isLoadingApi) return;

    setShowInteraction(false);
    lastMcqRef.current = currentStepData.mcq ?? lastMcqRef.current;

    if (currentStepData.mainCharacterImage?.startsWith("/"))
      setMainImg(currentStepData.mainCharacterImage);

    if (currentStepData.narrativeSteps?.length) {
      setMessageQueue(currentStepData.narrativeSteps);
      setIsDisplaying(true);
    } else {
      // nothing to narrate – show choices/feedback directly
      setMessageQueue([]);
      setIsDisplaying(false);
      setShowInteraction(true);
    }

    setIsComplete(currentStepData.scenarioComplete);
    if (currentStepData.feedback) setHasAnsweredMcq(true);
  }, [currentStepData, isLoadingApi]);

  // ---------- sequentially render queue ----------
  useEffect(() => {
    if (!isDisplaying || messageQueue.length === 0) {
      if (!isDisplaying && messageQueue.length === 0 && currentStepData)
        setShowInteraction(true);
      return;
    }

    const showNext = () => {
      setMessageQueue(prev => {
        const q = [...prev]; const next = q.shift(); if (!next) return q;

        timers.current.push(setTimeout(() => {
          const img = currentStepData?.mainCharacterImage?.startsWith("/")
            ? currentStepData.mainCharacterImage
            : getCharacterImagePath(next.character);
          if (img && img !== mainImg) setMainImg(img);

          const newMsg: DisplayMessage = {
            id: idCounter.current++,
            character: next.character,
            pfp: next.pfp,
            text: next.text
          };
          setStaggeredMessages(m => [...m, newMsg]);

          if (q.length)
            timers.current.push(setTimeout(showNext, STEP_DELAY_MS));
          else
            setIsDisplaying(false);
        }, MSG_DELAY_MS));

        return q;
      });
    };

    showNext();
    return clearTimers;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDisplaying, messageQueue]);

  // ---------- scroll ----------
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); },
            [staggeredMessages]);

  // ---------- progress ----------
  useEffect(() => {
    let p = 5 + decisionCount * 25;
    if (currentStepData?.mcq && !hasAnsweredMcq) p = 90;
    if (hasAnsweredMcq && !isComplete) p = 95;
    if (isComplete) p = 100;
    setProgress(p);
  }, [decisionCount, currentStepData, hasAnsweredMcq, isComplete]);

  // ---------- API ----------
  const loadScenarioStep = useCallback(
    async (decisionIndex: number | null) => {
      clearTimers();
      setIsLoadingApi(true);
      setShowInteraction(false);

      try {
        const res = await fetch("/api/lessons", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: userIdRef.current, decisionIndex })
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(txt);
        const data = JSON.parse(txt);
        if (data.error) throw new Error(data.error);
        setCurrentStepData(data.scenarioStep);
      } catch (e:any) {
        setError(e.message || "Unknown error");
      } finally {
        setIsLoadingApi(false);
      }
    }, []);

  // ---------- decision handlers ----------
  const submitDecision = async () => {
    if (selectedDecision === null || !currentStepData?.decisionPoint) return;
    const text = currentStepData.decisionPoint.options[selectedDecision].text;
    setStaggeredMessages(m => [...m, {
      id: idCounter.current++, character: "User", pfp: null,
      text: `I choose: "${text}"`, isDecision: true
    }]);
    setDecisionCount(c => c + 1);
    setSelectedDecision(null);
    await loadScenarioStep(selectedDecision);
  };
  const submitMcq = async () => {
    if (selectedMcq === null || !currentStepData?.mcq || hasAnsweredMcq) return;
    const text = currentStepData.mcq.options[selectedMcq];
    setStaggeredMessages(m => [...m, {
      id: idCounter.current++, character: "User", pfp: null,
      text: `My answer: "${text}"`
    }]);
    setHasAnsweredMcq(true);
    await loadScenarioStep(null);
  };

  // ---------- visibility ----------
  const canInteract     = showInteraction && !isDisplaying && !isLoadingApi;
  const showDecisionOpt = canInteract && currentStepData?.decisionPoint;
  const showMcqOpt      = canInteract && currentStepData?.mcq && !hasAnsweredMcq;
  const showFeedback    = canInteract && currentStepData?.feedback && hasAnsweredMcq;
  const showComplete    = canInteract && isComplete && !showFeedback;

  // ---------- render ----------
  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-red-100">
      <div className="bg-white p-6 rounded shadow-lg text-center max-w-md">
        <h2 className="text-xl font-semibold text-red-700 mb-4">Error</h2>
        <p className="text-red-600 mb-4">{error}</p>
        <button onClick={()=>router.push("/dashboard")}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="relative w-full h-screen flex flex-col overflow-hidden"
         style={{backgroundImage:`url(/game/bgs/bg_1.png)`,
                 backgroundSize:"cover",backgroundPosition:"center"}}>

      {/* progress bar */}
      <div className="absolute top-0 left-0 right-0 z-20 p-3 flex items-center gap-4">
        <div className="flex-grow flex items-center gap-2 bg-black/30 backdrop-blur-sm p-2 rounded-full shadow">
          <div className="w-full bg-gray-700 rounded-full h-4 overflow-hidden border border-gray-600">
            <div className="bg-gradient-to-r from-orange-400 to-yellow-500 h-4 rounded-full transition-all duration-500 ease-out"
                 style={{width:`${progress}%`}}/>
          </div>
          <span className="text-xs font-medium text-yellow-200 w-8 text-right">{progress}%</span>
        </div>
        <div className="shrink-0 bg-black/30 backdrop-blur-sm p-2 rounded-full shadow">
          <Image src="/game/book.svg" alt="Log" width={28} height={28}/>
        </div>
      </div>

      {/* body */}
      <div className="flex-grow flex flex-col overflow-hidden pt-16">

        {/* main character */}
        <div className="relative flex-shrink-0 h-[35vh] md:h-[40vh] flex justify-center items-end pointer-events-none">
          {mainImg && (
            <Image key={mainImg} src={mainImg} alt="Character"
                   width={250} height={400}
                   className="object-contain max-h-full animate-fade-in" priority/>
          )}
        </div>

        {/* chat */}
        <div className="flex-grow overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent mb-2">
          {staggeredMessages.map(m => (
            <div key={m.id} className={`flex items-end gap-2 ${m.character==="User"?"justify-end":"justify-start"}`}>
              {m.character!=="User" && m.pfp && (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden shrink-0 shadow border border-white/20 mb-1 self-start">
                  <Image src={m.pfp} alt={`${m.character} pfp`} width={40} height={40} className="object-cover"/>
                </div>
              )}
              {m.character==="User" && <div className="w-8 md:w-10 shrink-0"/>}

              <div className={`max-w-[75%] md:max-w-[65%] px-3 py-2 rounded-xl shadow-md
                               ${m.character==="User"
                                 ?"bg-blue-600 text-white rounded-br-none"
                                 :"bg-white/90 text-gray-900 rounded-bl-none"}`}>
                {m.character!=="User" && (
                  <p className="text-xs font-semibold mb-0.5 text-indigo-700">{m.character}</p>
                )}
                <p className="text-sm leading-relaxed break-words">{m.text}</p>
              </div>
            </div>
          ))}
          <div ref={endRef}/>
        </div>

        {/* interaction area */}
        <div className={`relative p-3 bg-black/20 backdrop-blur-sm border-t border-white/10
                         shrink-0 flex flex-col justify-center
                         transition-opacity duration-300 ${showInteraction
                         ?"opacity-100":"opacity-0 pointer-events-none"}`}>

          {/* decision choices */}
          {showDecisionOpt && currentStepData?.decisionPoint && (
            <div className="w-full max-w-lg mx-auto animate-fade-in">
              <p className="font-semibold text-sm mb-3 text-center text-white">
                {currentStepData.decisionPoint.question}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {currentStepData.decisionPoint.options.map((o,i)=>(
                  <button key={i} onClick={()=>setSelectedDecision(i)}
                          className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all
                            ${selectedDecision===i
                              ?"border-yellow-400 bg-yellow-400/20 shadow-lg scale-105 text-yellow-100 ring-2 ring-yellow-300"
                              :"border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500"}`}>
                    {o.text}
                  </button>
                ))}
              </div>
              <button onClick={submitDecision} disabled={selectedDecision===null || isLoadingApi}
                      className="w-full px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg text-sm font-bold hover:from-green-600 hover:to-emerald-700 disabled:opacity-50">
                Confirm Choice
              </button>
            </div>
          )}

          {/* MCQ */}
          {showMcqOpt && currentStepData?.mcq && (
            <div className="w-full max-w-lg mx-auto animate-fade-in">
              <p className="font-semibold text-sm mb-3 text-center text-white">
                {currentStepData.mcq.question}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {currentStepData.mcq.options.map((o,i)=>(
                  <button key={i} onClick={()=>setSelectedMcq(i)}
                          className={`p-2.5 rounded-lg border-2 text-sm text-left transition-all
                            ${selectedMcq===i
                              ?"border-cyan-400 bg-cyan-400/20 shadow-lg scale-105 text-cyan-100 ring-2 ring-cyan-300"
                              :"border-gray-400 bg-white/70 hover:bg-white/90 text-gray-800 hover:border-gray-500"}`}>
                    {o}
                  </button>
                ))}
              </div>
              <button onClick={submitMcq} disabled={selectedMcq===null || isLoadingApi}
                      className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg text-sm font-bold hover:from-blue-600 hover:to-indigo-700 disabled:opacity-50">
                Submit Answer
              </button>
            </div>
          )}

          {/* feedback */}
          {showFeedback && currentStepData?.feedback && (
            <div className="text-sm text-center max-w-lg mx-auto animate-fade-in">
              {selectedMcq === lastMcqRef.current?.correctOptionIndex ? (
                <p className="font-medium mb-3 p-2 rounded border bg-green-700/80 border-green-500 text-green-100">
                  <strong>Correct!</strong> {currentStepData.feedback.correctFeedback}
                </p>
              ) : (
                <p className="font-medium mb-3 p-2 rounded border bg-red-700/80 border-red-500 text-red-100">
                  <strong>Incorrect.</strong> {currentStepData.feedback.incorrectFeedback}
                </p>
              )}
              {isComplete && (
                <button onClick={()=>router.push("/dashboard")}
                        className="mt-2 px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700">
                  Return to Dashboard
                </button>
              )}
            </div>
          )}

          {/* completion */}
          {showComplete && (
            <div className="text-center max-w-lg mx-auto animate-fade-in">
              <p className="font-semibold text-lg text-yellow-300 mb-4">Scenario Complete!</p>
              <button onClick={()=>router.push("/dashboard")}
                      className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700">
                Return to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
