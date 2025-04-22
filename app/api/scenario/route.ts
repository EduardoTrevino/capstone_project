import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ScenarioStep } from "@/lib/gameSchemas";
import { supabase } from "@/lib/supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const MODEL = "gpt-4o-2024-08-06";

export async function POST(req: NextRequest) {
  try {
    /* ---------- body ---------- */
    const { userId, scenarioId, messages = [], scaffoldUsed = false } =
      await req.json();
    if (!userId || !scenarioId)
      return NextResponse.json({ error: "userId & scenarioId required" }, { status: 400 });

    /* ---------- learner & metrics ---------- */
    const { data: user } = await supabase.from("users").select("name").eq("id", userId).single();
    if (!user) throw new Error("User not found");

    const { data: um } = await supabase
      .from("user_metrics")
      .select("metrics(name), value")
      .eq("user_id", userId);
    const metricSnapshot: Record<string, number> = {};
    (um ?? []).forEach((r: any) => (metricSnapshot[r.metrics.name] = Number(r.value)));

    

    /* ---------- system prompt ---------- */
    const system = {
      role: "system" as const,
      content: `
You are the narrative engine for an entrepreneurship game.
Return ONLY JSON that matches the provided schema.
Rules:
• Produce exactly 3 decision steps (4 options, 1 with "isScaffold":true).
• Use characters Rani, Ali, Yash, Nisha in short Hinglish chat.
• After decisions, emit one MCQ, then feedback if needed, then summary.
• Do not output any markdown or keys outside the schema.

Learner name: ${user.name}
Current metrics: ${JSON.stringify(metricSnapshot)}
Scaffold already used in this scenario: ${scaffoldUsed}
`.trim()
    };

    const completion = await openai.beta.chat.completions.parse({
      model: MODEL,
      messages: [system, ...messages],   // messages array comes straight from FE
      temperature: 0.7,
      response_format: zodResponseFormat(ScenarioStep, "scenario_step") // STRICT ✅
    });

    const step = completion.choices[0].message.parsed; // <TScenarioStep>

    /* ---------- if learner JUST MADE a decision, persist deltas ---------- */
    if (messages.length) {
      const lastUser = messages[messages.length - 1];
      if (lastUser.role === "user" && lastUser.content.startsWith("decision:")) {
        const decisionIdx = Number(lastUser.content.split(":")[1]);
        const dpIdx = Number(lastUser.content.split(":")[2]); // we send both
        const option = (step as any).previousDecision ?? null; // optional echo
        const metricDeltas = option?.metricDeltas ?? {};
        // upsert user_metrics
        for (const [metric, delta] of Object.entries<number>(metricDeltas)) {
          await supabase.rpc("increment_metric", {
            p_user_id: userId,
            p_metric_name: metric,
            p_delta: delta
          }); // simple SQL func you add (adds if missing)
        }
        // log
        await supabase.from("user_decisions").insert({
          user_id: userId,
          scenario_id: scenarioId,
          decision_index: dpIdx,
          option_index: decisionIdx,
          is_scaffold: option?.isScaffold ?? false,
          metric_deltas: metricDeltas
        });
      }
    }

    return NextResponse.json({ nextStep: step });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
