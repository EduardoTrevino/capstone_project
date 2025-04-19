// game/page.tsx
"use client"

import { useState, useEffect, FormEvent, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

// --- Interfaces (keep as they are) ---
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface LessonPhase {
  phaseName: string;
  messages: string[];
  mcq: {
    question: string;
    options: string[];
    correctOptionIndex: number;
  } | null;
  feedback: {
    correctFeedback: string;
    incorrectFeedback: string;
  } | null;
  summary: string | null;
}

// Simple SVG Send Icon Component
const SendIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
      <path d="M3.105 3.105a.5.5 0 01.814-.39l14.396 7.198a.5.5 0 010 .784L3.919 17.285a.5.5 0 01-.814-.39V11.5a.5.5 0 01.468-.496l8.04-.804a.5.5 0 000-.992l-8.04-.804A.5.5 0 013.105 8.5v-5.395z" />
    </svg>
);


export default function DroneGamePage() {
  const router = useRouter()

  // --- State Variables ---
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [phase, setPhase] = useState<LessonPhase | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [userInput, setUserInput] = useState("")
  const [userId, setUserId] = useState<string>("")
  const [progress, setProgress] = useState(0)
  const messagesEndRef = useRef<null | HTMLDivElement>(null)

  // --- Effects (keep as they are) ---
  useEffect(() => {
    const storedUserId = localStorage.getItem("userId")
    if (!storedUserId) { router.push("/"); return; }
    setUserId(storedUserId);
    loadNextPhase([], storedUserId);
  }, [router]);

  useEffect(() => {
    if (!phase) { setProgress(0); return; }
    let currentProgress = 5;
    switch (phase.phaseName?.toLowerCase()) {
      case "initial": currentProgress = 15; break;
      case "middle": currentProgress = 40; break;
      case "final": case "final_quiz": currentProgress = 65; break;
      default: if (phase.mcq) currentProgress = 65; break;
    }
    if (phase.feedback && hasAnswered) currentProgress = 85;
    if (phase.summary) currentProgress = 100;
    setProgress(currentProgress);
  }, [phase, hasAnswered]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Core Logic Functions (keep as they are) ---
  async function loadNextPhase(updatedMessages: ChatMessage[], userIdParam: string) {
    if (!userIdParam) { setError("User ID is missing."); return; }
    setIsLoading(true); setError(null); setSelectedOption(null); setHasAnswered(false);
    try {
      const res = await fetch("/api/lessons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: userIdParam, messages: updatedMessages }), });
      if (!res.ok) { let errData; try { errData = await res.json() } catch { /* ignore */ } throw new Error(`HTTP Error ${res.status}: ${errData?.error || res.statusText}`); }
      const data = await res.json();
      if (data?.error) { throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error)); }
      const nextPhase: LessonPhase = data.nextPhase;
      if (!nextPhase || !nextPhase.messages || !nextPhase.phaseName) { throw new Error("Invalid phase data received from server."); }
      setPhase(nextPhase);
      if (nextPhase.messages && nextPhase.messages.length > 0) {
         const combinedAssistantContent = nextPhase.messages.join("\n");
         setMessages([...updatedMessages, { role: "assistant", content: combinedAssistantContent },]);
      } else { setMessages(updatedMessages); }
    } catch (err: any) { console.error("Error loading next phase:", err); setError(err.message || "An unknown error occurred."); }
    finally { setIsLoading(false); }
  }
  async function handleUserSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userInput.trim() || isLoading || !userId) return;
    const newUserMessage: ChatMessage = { role: "user", content: userInput.trim() };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages); setUserInput("");
    await loadNextPhase(updatedMessages, userId);
  }
  function handleSelectOption(idx: number) { if (hasAnswered) return; setSelectedOption(idx); }
  async function handleSubmitQuiz() {
    if (selectedOption === null || isLoading || !phase?.mcq || !userId) return;
    const userAnswerContent = `Selected answer: "${phase.mcq.options[selectedOption]}" (Option index ${selectedOption})`;
    const newUserMessage: ChatMessage = { role: "user", content: userAnswerContent };
    const updatedMessages = [...messages, newUserMessage];
    setMessages(updatedMessages); setHasAnswered(true);
    await loadNextPhase(updatedMessages, userId);
  }
  async function handleContinue(isEndOfLesson: boolean = false) {
    if (isLoading || !userId) return;
    if (isEndOfLesson) { router.push("/dashboard"); return; }
    const continueMessage: ChatMessage = { role: "user", content: "Okay, continue." };
    const updatedMessages = [...messages, continueMessage];
    setMessages(updatedMessages); setSelectedOption(null); setHasAnswered(false);
    await loadNextPhase(updatedMessages, userId);
  }

  // --- Render Logic ---

  if (error) { /* Error handling remains the same */
    return (
      <div className="flex items-center justify-center min-h-screen bg-red-100">
        <div className="bg-white p-6 rounded shadow-lg text-center">
          <h2 className="text-xl font-semibold text-red-700 mb-4">Error</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <button onClick={() => { setError(null); if(messages.length === 0 && userId) loadNextPhase([], userId); else router.push("/dashboard"); }} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" > {messages.length === 0 ? "Retry" : "Go to Dashboard"} </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-screen bg-gray-800 flex flex-col overflow-hidden"> {/* Darker bg */}

      {/* Background Image - adjusted opacity */}
      <div className="absolute inset-0 z-0">
        <Image src="/game/drone-agriculture.png" alt="Drone farmland background" fill style={{ objectFit: 'cover', opacity: 0.3 }} priority />
        {/* Removed explicit overlay, using opacity on image instead */}
      </div>

      {/* Top Bar: Back Button and GAMIFIED Progress */}
      <div className="relative z-10 p-3 bg-slate-700/80 backdrop-blur-sm shadow-lg flex items-center gap-4 shrink-0 border-b border-slate-600">
        <button onClick={() => router.push("/dashboard")} className="px-3 py-1 bg-slate-500 text-white rounded text-sm hover:bg-slate-400 shadow" aria-label="Go back to dashboard"> Back </button>
        <div className="flex-grow flex items-center gap-2">
           <span className="text-xs font-medium text-yellow-300">EXP:</span> {/* Changed label */}
           {/* --- GAMIFIED Progress Bar --- */}
           <div className="w-full bg-slate-900 rounded-full h-4 shadow-inner border border-slate-500 overflow-hidden">
             <div
               className="bg-gradient-to-r from-orange-400 via-amber-400 to-yellow-500 h-4 rounded-full transition-all duration-500 ease-out shadow-md border-r-2 border-white/50 flex items-center justify-end pr-1" // Brighter gradient, added right border for shine
               style={{ width: `${progress}%` }}
               role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}
             >
                {/* Sparkle effect (optional) */}
                {/* {progress > 5 && <div className="w-1 h-2 bg-white rounded-full opacity-70 animate-pulse"></div>} */}
             </div>
           </div>
           {/* --- END GAMIFIED Progress Bar --- */}
           <span className="text-xs font-medium text-yellow-300 w-8 text-right">{progress}%</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col overflow-hidden relative z-10 pt-2">

          {/* Chat History Area - Avatar integrated */}
          <div className="flex-grow overflow-y-auto p-4 space-y-4 mb-2 scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-700/50"> {/* Added scrollbar styling */}
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex items-end gap-2 ${ // Use items-end for vertical alignment
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {/* Conditionally render Avatar for assistant */}
                {msg.role === "assistant" && (
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 shadow-md border-2 border-slate-500 mb-1"> {/* Added border */}
                    <Image
                      src="/game/Amar_transp_bg.png" // Ensure this path is correct
                      alt="Tutor Avatar"
                      width={40}
                      height={40}
                      className="object-cover"
                    />
                  </div>
                )}

                {/* Message Bubble */}
                <div
                  className={`max-w-[75%] md:max-w-[65%] px-3.5 py-2 rounded-lg shadow-md ${ // Slightly different padding
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-br-none" // User bubble style (pointy edge)
                      : "bg-slate-200 text-slate-900 rounded-bl-none" // Assistant bubble style (pointy edge)
                  }`}
                >
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed break-words">{line}</p> // Added break-words
                  ))}
                </div>

                 {/* Placeholder for user messages to maintain structure (optional but can help) */}
                 {msg.role === "user" && <div className="w-10 shrink-0"></div>}
              </div>
            ))}

            {/* Loading indicator aligned with assistant */}
            {isLoading && messages.length > 0 && (
                 <div className="flex items-end gap-2 justify-start">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                       {/* Placeholder or smaller avatar if needed */}
                       <div className="w-full h-full bg-slate-600 animate-pulse"></div>
                    </div>
                    <div className="max-w-[75%] md:max-w-[65%] px-3.5 py-2 rounded-lg shadow-md bg-slate-200 text-slate-900 rounded-bl-none">
                        <span className="animate-pulse text-sm">...</span>
                    </div>
                 </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* GAMIFIED Interaction Area (Bottom) */}
          <div className="relative p-3 bg-gradient-to-b from-slate-700 to-slate-800 border-t-2 border-yellow-400 shadow-[-0px_-4px_10px_rgba(0,0,0,0.3)] shrink-0">
            {/* Loading indicator */}
            {isLoading && messages.length === 0 && (
                 <div className="flex justify-center items-center min-h-[76px]"> {/* Match typical input height */}
                    <span className="animate-pulse text-lg text-slate-400">Loading Mission...</span> {/* Gamified text */}
                 </div>
            )}

            {/* Conditional Rendering for MCQ, Feedback, Summary */}
            {/* Add some game-like styling to these too */}
             {!isLoading && phase?.mcq && !hasAnswered && !phase.summary && (
              <div className="bg-slate-600/50 p-3 rounded-lg border border-slate-500">
                <p className="font-semibold text-sm mb-2 text-yellow-200">{phase.mcq.question}</p>
                <div className="flex flex-col gap-2 mb-3">
                  {phase.mcq.options.map((opt, idx) => (
                    <label key={idx} className={`flex items-center gap-2 p-2 rounded border-2 transition-all duration-150 ${selectedOption === idx ? 'border-yellow-400 bg-slate-700 shadow-md scale-105' : 'border-slate-500 bg-slate-600 hover:bg-slate-500'} cursor-pointer`}>
                      <input type="radio" name="mcq" checked={selectedOption === idx} onChange={() => handleSelectOption(idx)} className="form-radio text-yellow-500 focus:ring-yellow-400 bg-slate-800 border-slate-600" />
                      <span className="text-sm text-white">{opt}</span>
                    </label>
                  ))}
                </div>
                <button onClick={handleSubmitQuiz} disabled={selectedOption === null || isLoading} className="w-full px-4 py-2 bg-gradient-to-r from-lime-500 to-green-600 text-white rounded-lg text-sm font-bold hover:from-lime-600 hover:to-green-700 disabled:opacity-50 shadow-lg transform hover:scale-105 transition-transform" > Submit Answer </button>
              </div>
            )}

            {!isLoading && phase?.feedback && hasAnswered && !phase.summary && (
               <div className="text-sm bg-slate-600/50 p-3 rounded-lg border border-slate-500">
                    {selectedOption === phase.mcq?.correctOptionIndex ? (
                      <p className="font-medium mb-3 p-2 rounded border bg-green-800/80 border-green-600 text-green-100"> <strong>Correct!</strong> {phase.feedback.correctFeedback} </p>
                    ) : (
                      <p className="font-medium mb-3 p-2 rounded border bg-red-800/80 border-red-600 text-red-100"> <strong>Incorrect.</strong> {phase.feedback.incorrectFeedback} </p>
                    )}
                    <button onClick={() => handleContinue()} disabled={isLoading} className="w-full px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg text-sm font-bold hover:from-sky-600 hover:to-blue-700 disabled:opacity-50 shadow-lg transform hover:scale-105 transition-transform" > Next Objective </button> {/* Gamified text */}
               </div>
            )}

            {!isLoading && phase?.summary && (
               <div className="text-sm bg-slate-600/50 p-3 rounded-lg border border-slate-500">
                   {phase.feedback && hasAnswered && ( /* Feedback shown above summary */
                          <div className="mb-3">
                            {selectedOption === phase.mcq?.correctOptionIndex ? (
                              <p className="font-medium p-2 rounded border bg-green-800/80 border-green-600 text-green-100"> <strong>Correct!</strong> {phase.feedback.correctFeedback} </p>
                            ) : (
                              <p className="font-medium p-2 rounded border bg-red-800/80 border-red-600 text-red-100"> <strong>Incorrect.</strong> {phase.feedback.incorrectFeedback} </p>
                            )}
                          </div>
                     )}
                    <p className="font-semibold text-yellow-200 mb-3 p-2 rounded border bg-indigo-800/80 border-indigo-600">{phase.summary}</p>
                    <button onClick={() => handleContinue(true)} disabled={isLoading} className="w-full px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg text-sm font-bold hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 shadow-lg transform hover:scale-105 transition-transform" > Mission Complete </button> {/* Gamified text */}
               </div>
            )}

             {/* GAMIFIED Text Input */}
             {!isLoading && phase && !phase.mcq && !phase.feedback && !phase.summary && (
              <form onSubmit={handleUserSubmit} className="flex gap-2 items-center">
                <textarea
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Enter transmission..." // Gamified placeholder
                  className="resize-none flex-grow p-2.5 rounded-lg border-2 border-slate-500 bg-slate-100 text-slate-900 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 shadow-inner placeholder-slate-500" // More styled textarea
                  rows={1} // Start with 1 row, expands slightly with text
                  style={{ maxHeight: '80px', minHeight: '44px' }} // Control height better
                  disabled={isLoading}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleUserSubmit(e as any); } }}
                />
                <button
                  type="submit"
                  disabled={isLoading || !userInput.trim()}
                  className="p-2.5 bg-gradient-to-br from-lime-400 to-green-600 text-white rounded-lg disabled:opacity-50 shadow-lg transform hover:scale-110 transition-all duration-150 flex items-center justify-center" // Icon button style
                  aria-label="Send message"
                >
                  <SendIcon />
                </button>
              </form>
            )}

          </div> {/* End Interaction Area */}
      </div> {/* End Main Content Area */}
    </div> // End Main container
  )
}