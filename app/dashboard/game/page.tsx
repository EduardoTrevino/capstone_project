"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useRouter } from "next/navigation";
import type { TScenarioStep } from "@/lib/gameSchemas";

type Chat = { role: "user" | "assistant"; content: string };

export default function DroneGame() {
  const router = useRouter();
  const userId = typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  const [msgs, setMsgs] = useState<Chat[]>([]);
  const [step, setStep] = useState<TScenarioStep | null>(null);
  const [loading, setLoading] = useState(false);
  const [scaffoldUsed, setScaffoldUsed] = useState(false);
  const scenarioId = useRef(uuidv4()).current;
  const endRef = useRef<HTMLDivElement>(null);
  const [picked, setPicked] = useState<number | null>(null); // for MCQ

  /* auto‑scroll */
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  /* first load */
  useEffect(() => { if (userId) send([]); }, [userId]);

  async function send(newMsgs: Chat[]) {
    if (!userId) return;
    setLoading(true);
    const res = await fetch("/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, scenarioId, messages: newMsgs, scaffoldUsed })
    });
    const data = await res.json();
    setStep(data.nextStep as TScenarioStep);
    if (data.nextStep.messages.length)
      setMsgs([...newMsgs, { role: "assistant", content: data.nextStep.messages.join("\n") }]);
    else setMsgs(newMsgs);
    setLoading(false);
  }

  /* decision click */
  async function choose(optIdx: number, dpIdx: number, isScaffold: boolean) {
    if (loading) return;
    if (isScaffold) setScaffoldUsed(true);
    const tag = `decision:${optIdx}:${dpIdx}`;
    await send([...msgs, { role: "user", content: tag }]);
  }

  /* submit MCQ */
  async function submit() {
    if (picked === null || loading) return;
    await send([...msgs, { role: "user", content: `mcq:${picked}` }]);
    setPicked(null);
  }

  /* render helpers */
  const progress =
    step?.summary ? 100 :
    step?.stepType === "mcq" ? 80 :
    step?.stepType === "decision" ? 20 + (msgs.filter(m=>m.content.startsWith("decision:")).length)*20 : 10;

  return (
    <div className="relative h-screen flex flex-col overflow-hidden">
      <Image src="/game/bgs/bg_1.png" fill alt="" className="object-cover -z-10"/>
      {/* TOP BAR */}
      <div className="flex items-center gap-2 bg-black/70 p-2">
        <button onClick={()=>router.push("/dashboard")} className="text-white text-sm">Back</button>
        <div className="flex-1 h-2 bg-white/30 rounded">
          <div className="h-full bg-lime-400" style={{ width:`${progress}%` }}/>
        </div>
        <Image src="/game/book.svg" alt="" width={24} height={24}/>
      </div>
      {/* CHAT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgs.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
            <div className={`px-3 py-2 rounded-lg text-sm ${m.role==="user"?"bg-green-600 text-white":"bg-white"}`}>
              {m.content.split("\n").map((l,j)=><p key={j}>{l}</p>)}
            </div>
          </div>
        ))}
        {loading && <p className="text-xs text-gray-200">…</p>}
        <div ref={endRef}/>
      </div>
      {/* INTERACTION PANEL */}
      <div className="p-3 bg-black/80 space-y-2">
        {/* DECISION */}
        {step?.stepType==="decision" && step.decision && (
          <div className="grid grid-cols-1 gap-2">
            {step.decision.options.map((o,idx)=>(
              <button key={idx}
                disabled={o.isScaffold && scaffoldUsed}
                onClick={()=>choose(idx,
                    msgs.filter(m=>m.content.startsWith("decision:")).length, o.isScaffold)}
                className={`p-3 rounded text-left text-sm border
                  ${o.isScaffold?"border-amber-400":"border-lime-400"} ${
                  o.isScaffold && scaffoldUsed ? "opacity-40 cursor-not-allowed" : "hover:bg-white/10"}`}>
                {o.text}{o.isScaffold && "  ✨"}
              </button>
            ))}
          </div>
        )}

        {/* MCQ */}
        {step?.stepType==="mcq" && step.mcq && (
          <div className="space-y-2">
            <p className="text-white text-sm">{step.mcq.question}</p>
            {step.mcq.options.map((op,i)=>(
              <label key={i} className="flex items-center gap-2 text-sm text-white">
                <input type="radio" checked={picked===i} onChange={()=>setPicked(i)}/>
                {op}
              </label>
            ))}
            <button onClick={submit} className="bg-lime-500 px-3 py-1 rounded text-sm">Submit</button>
          </div>
        )}

        {/* FEEDBACK */}
        {step?.stepType==="feedback" && step.feedback && (
          <div className="text-sm text-white space-y-2">
            <p>{step.feedback.correctFeedback || step.feedback.incorrectFeedback}</p>
            <button onClick={()=>send([...msgs,{role:"user",content:"continue"}])}
              className="bg-sky-500 px-3 py-1 rounded text-sm">Continue</button>
          </div>
        )}

        {/* SUMMARY */}
        {step?.stepType==="summary" && step.summary && (
          <div className="text-sm text-white space-y-2">
            <p>{step.summary}</p>
            <button onClick={()=>router.push("/dashboard") }
              className="bg-pink-500 px-3 py-1 rounded text-sm">Finish</button>
          </div>
        )}
      </div>
    </div>
  );
}
