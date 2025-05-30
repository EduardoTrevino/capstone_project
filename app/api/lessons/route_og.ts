import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // client with insert/update perms

// Define the structure for the JSON response we expect from OpenAI
const scenarioStepSchema = {
  type: "object",
  properties: {
    narrativeSteps: {
      type: "array",
      description: "Dialogue exchanges for this step. Should contain at least one step unless it's only feedback/completion.",
      items: {
        type: "object",
        properties: {
          character: { type: "string", description: "Name of the character speaking (e.g., Rani, Ali, Yash, Nisha, Narrator).", enum: ["Rani", "Ali", "Yash", "Nisha", "Narrator"] },
          pfp: { type: "string", description: "Full path to the character's profile picture (e.g., /game/character_pfp/rani.png)." },
          text: { type: "string", description: "The dialogue text." },
        },
        required: ["character", "pfp", "text"],
        additionalProperties: false,
      },
    },
    mainCharacterImage: {
      type: ["string", "null"],
      description: "Full path to the main character image (e.g., /game/characters/ali.png) or null.",
    },
    decisionPoint: {
      type: ["object", "null"],
      description: "Present if the user needs to make a choice (max 3 per scenario).",
      properties: {
        question: { type: "string", description: "The question prompting the decision." },
        options: {
          type: "array",
          description: "Exactly 4 distinct options for the user to choose from.",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "The text content of the option." }
            },
            required: ["text"],
            additionalProperties: false
          },
        },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
    scenarioComplete: {
      type: "boolean",
      description: "Set to true when the entire scenario (narrative, 3 decisions) is finished.",
    },
  },
  required: [
    "narrativeSteps",
    "mainCharacterImage",
    "decisionPoint",
    "scenarioComplete",
  ],
  additionalProperties: false,
};

// Helper to get current game state from dialogue history
function getCurrentGameState(history: any[]) {
    let decisionCount = 0;
    let lastDecisionIndex: number | null = null;
    let correctedDecisionCount = 0;

    // First pass: Count decisions presented by assistant
    history.forEach(entry => {
        if (entry.role === 'assistant') {
            try {
                const stepData = JSON.parse(entry.content);
                if (stepData.decisionPoint) correctedDecisionCount++;
            } catch (e) { /* ignore parse errors */ }
        }
    });

    // Second pass: Correlate user actions for last decision index and count user decisions made
    history.forEach(entry => {
        if (entry.role === 'user') {
            if (entry.content?.includes("chose decision index")) {
                 const match = entry.content.match(/index: (\d+)/);
                 if (match) lastDecisionIndex = parseInt(match[1], 10);
                 decisionCount++; // Count user *actions*
            }
        }
    });

    // Return the count based on *user actions* as it's more reliable for progression
    // Keep correctedDecisionCount potentially for debugging/validation if needed
    console.log(`State Check: User Decisions Made = ${decisionCount}, Assistant Decisions Presented = ${correctedDecisionCount}, Last User Choice = ${lastDecisionIndex}`);
    return { decisionCount, lastDecisionIndex };
}

export async function POST(req: NextRequest) {
  try {
    // --- Steps 1-5 (Setup, Parse Request, Get User/Goal, Get History, Calc State) ---
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    const { userId, decisionIndex } = (await req.json()) as { userId?: string; decisionIndex?: number | null; };
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    console.log(`[/api/lesson] Request for user ${userId}, decisionIndex: ${decisionIndex}`);
    const { data: userRow, error: userError } = await supabase.from("users").select("name, focused_goal_id").eq("id", userId).single();
    if (userError || !userRow || !userRow.focused_goal_id) return NextResponse.json({ error: "User or goal setup invalid" }, { status: 404 });
    const userName = userRow.name; const focusedGoalId = userRow.focused_goal_id;
    const { data: goalRow, error: goalError } = await supabase.from("goals").select("name, description").eq("id", focusedGoalId).single();
    if (goalError || !goalRow) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    const goalName = goalRow.name; const goalDescription = goalRow.description || "No description provided.";
    const { data: userGoalsRow } = await supabase.from("user_goals").select("dialogue_history").eq("user_id", userId).eq("goal_id", focusedGoalId).single();
    const dialogueHistory = userGoalsRow?.dialogue_history ?? [];
    const previousGameState = getCurrentGameState(dialogueHistory);
    console.log("[/api/lesson] Previous Game State:", previousGameState);
    const currentDecisionCount = previousGameState.decisionCount + (decisionIndex !== null ? 1 : 0);
    console.log(`[/api/lesson] Calculated current state for prompt: Decisions=${currentDecisionCount}`)

    // --- Step 6: Build the dynamic system prompt ---
    const systemPrompt = `
You are a scenario generator for an educational game. The player is "${userName}".
The current learning goal is "${goalName}". Goal Description: "${goalDescription}".
Note: The player already knows who the characters are so they do not need to introduce themselves. 

Scenario Characters & Assets:
- Rani: pfp=/game/character_pfp/rani.png, image=/game/characters/rani.png
- Ali: pfp=/game/character_pfp/ali.png, image=/game/characters/ali.png
- Santosh: pfp=/game/character_pfp/santosh.png, image=/game/characters/santosh.png
- Manju: pfp=/game/character_pfp/manju.png, image=/game/characters/manju.png
- Rajesh: pfp=/game/character_pfp/rajesh.png, image=/game/characters/rajesh.png
- Narrator: pfp=/game/character_pfp/narrator.png, image=/game/characters/narrator.png

Scenario Characters:
- Rani: Enthusiastic Mentor
- Ali: Apprentice/Partner
- Manju: Govt. Associate/Investor
- Rajesh: The Competitor 
- Narrator: Narrates scenario

Scenario Structure & State Tracking:
1. Start: narrativeSteps + FIRST decisionPoint (count 0->1).
2. Decision 1->2: narrativeSteps + SECOND decisionPoint (count 1->2).
3. Decision 2->3: narrativeSteps + THIRD decisionPoint (count 2->3).
4. Decision 3->Conclusion: FINAL narrativeSteps + scenarioComplete=true. No further decisions.

Current State (Reflects state *after* the user's latest action):
- Decisions made so far (by user): ${currentDecisionCount}
${previousGameState.lastDecisionIndex !== null ? `- Previous decision index chosen by user: ${previousGameState.lastDecisionIndex}`: ''}
${decisionIndex !== null ? `- User just chose decision option index: ${decisionIndex}` : ''}

Your Task: Generate the JSON for the *next* step based on the 'Current State'.

Instructions:
- Progression Logic:
    - If currentDecisionCount < 3: Respond with narrativeSteps and the *next* decisionPoint. Ensure decisionPoint is not null. Set scenarioComplete=false.
    - If currentDecisionCount == 3: Respond with the FINAL concluding narrativeSteps ONLY. Set scenarioComplete=true. Ensure decisionPoint is null.
- Content: Use characters naturally. Dialogue engaging & relevant. Keep segments concise. Paths EXACTLY as specified. Use null for mainCharacterImage if no change. The final narrative step should provide a sense of closure based on the scenario and path taken.
- *** CRITICAL SCHEMA ADHERENCE ***:
    - Response MUST be a single valid JSON object matching the provided schema (enforced by \`response_format\`).
    - Decision Points MUST have exactly 4 options. Each option MUST be an object \`{ "text": "Option text" }\`. decisionPoint MUST be null in the final step.
    - Remove any reference to 'mcq' or 'feedback' properties in your response.
    - \`narrativeSteps\` should not be empty unless it's the final feedback step.
- Output: Ensure all required fields are present, using null where appropriate. No extra text outside the JSON.
`.trim();

    // --- Step 7: Combine messages ---
    const messagesForOpenAI = [
      { role: "system", content: systemPrompt },
      ...(dialogueHistory.length > 0 ? [dialogueHistory[dialogueHistory.length - 1]] : []),
      ...(decisionIndex !== null ? [{ role: "user", content: `User chose decision index: ${decisionIndex}` }]
          : dialogueHistory.length === 0 ? [{ role: "user", content: "Start the scenario."}] : []),
    ];
    console.log("[/api/lesson] Messages for OpenAI =>", JSON.stringify(messagesForOpenAI, null, 2));

    // --- Step 8: Call OpenAI with Strict JSON Schema Enforcement ---
    const payload = {
      model: "gpt-4o-2024-08-06",
      messages: messagesForOpenAI,
      response_format: {
        type: "json_schema",
        json_schema: { name: "scenario_step", description: "A single step in the narrative scenario.", schema: scenarioStepSchema, strict: true }
      },
      temperature: 0.7,
    };
    console.log("[/api/lesson] OpenAI Payload =>", JSON.stringify(payload, null, 2));
    const response = await fetch("https://api.openai.com/v1/chat/completions", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify(payload) });
    console.log("[/api/lesson] OpenAI response status:", response.status);

    // --- Step 9: Extract and Parse JSON content (Improved error handling for non-OK status) ---
    if (!response.ok) {
        const errorText = await response.text();
        console.error("[/api/lesson] OpenAI error response text:", errorText);
        let errorJson; try { errorJson = JSON.parse(errorText); } catch { /* ignore */ }
        return NextResponse.json({ error: errorJson?.error?.message || `OpenAI API Error: ${response.statusText}` }, { status: response.status });
    }
    const data = await response.json();
    console.log("[/api/lesson] OpenAI response data =>", JSON.stringify(data, null, 2));
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
        console.error("[/api/lesson] No content returned from AI model even though status was OK.");
        return NextResponse.json({ error: "No content returned from AI model (Status OK)" }, { status: 500 });
    }
    let parsedScenarioStep;
    try { parsedScenarioStep = JSON.parse(content); }
    catch (err) { return NextResponse.json({ error: "Could not parse valid JSON returned by AI", content }, { status: 500 }); }
    console.log("[/api/lesson] Parsed Scenario Step =>", JSON.stringify(parsedScenarioStep, null, 2));
    if (!parsedScenarioStep || typeof parsedScenarioStep !== 'object' || !('narrativeSteps' in parsedScenarioStep)) {
      return NextResponse.json({ error: "Received invalid data structure from AI." }, { status: 500 });
    }

    // --- Step 10 & 11: Prepare log entry & Upsert Supabase ---
    const userActionEntry = decisionIndex !== null ? { role: "user", content: `User chose decision index: ${decisionIndex}` }
         : { role: "user", content: "User initiated scenario or continued." };
    const assistantEntry = { role: "assistant", content };
    const updatedDialogue = [...dialogueHistory];
    if (decisionIndex !== null) { updatedDialogue.push(userActionEntry); }
    updatedDialogue.push(assistantEntry);
    const currentProgressValue = parsedScenarioStep.scenarioComplete ? 100
        : Math.min(95, 5 + (currentDecisionCount * 25));
    const { error: upsertError } = await supabase.from("user_goals").upsert({
        user_id: userId, goal_id: focusedGoalId, dialogue_history: updatedDialogue,
        updated_at: new Date().toISOString(), progress: currentProgressValue,
    }, { onConflict: "user_id,goal_id" });
    if (upsertError) console.error("Error upserting user_goals:", upsertError);

    // --- Step 12: Return the parsed scenario step ---
    return NextResponse.json({ scenarioStep: parsedScenarioStep });

  } catch (err: any) {
    console.error("[/api/lesson] Unhandled Route error =>", err);
    return NextResponse.json({ error: err.message || "An internal server error occurred." }, { status: 500 });
  }
}
