import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // client with insert/update perms

// Define the structure for the JSON response we expect from OpenAI
const scenarioStepSchema = {
  type: "object",
  properties: {
    narrativeSteps: {
      type: "array",
      description: "Dialogue exchanges for this step.",
      items: {
        type: "object",
        properties: {
          character: {
            type: "string",
            description: "Name of the character speaking (e.g., Rani, Ali, Yash, Nisha, Narrator).",
            enum: ["Rani", "Ali", "Yash", "Nisha", "Narrator"]
          },
          pfp: {
            type: "string",
            description: "Full path to the character's profile picture (e.g., /game/characters_pfp/rani.png). Use /game/characters_pfp/narrator.png for Narrator.",
          },
          text: {
            type: "string",
            description: "The dialogue text.",
          },
        },
        required: ["character", "pfp", "text"],
        additionalProperties: false,
      },
    },
    mainCharacterImage: {
      type: ["string", "null"],
      description: "Full path to the main character image to display for this scene (e.g., /game/characters/ali.png) or null if no change.",
    },
    decisionPoint: {
      type: ["object", "null"],
      description: "Present if the user needs to make a choice (max 3 per scenario).",
      properties: {
        question: {
          type: "string",
          description: "The question prompting the decision.",
        },
        options: {
          type: "array",
          description: "Exactly 4 string options for the user to choose from.",
          items: { type: "string" },
          minItems: 4,
          maxItems: 4,
        },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
    mcq: {
      type: ["object", "null"],
      description: "Present only for the final multiple-choice question.",
      properties: {
        question: { type: "string" },
        options: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 4 }, // Usually 3-4 options
        correctOptionIndex: { type: "integer", description: "0-based index of the correct option." },
      },
      required: ["question", "options", "correctOptionIndex"],
      additionalProperties: false,
    },
    feedback: {
        type: ["object", "null"],
        description: "Feedback provided AFTER the user answers the MCQ.",
        properties: {
            correctFeedback: { type: "string" },
            incorrectFeedback: { type: "string" },
        },
        required: ["correctFeedback", "incorrectFeedback"],
        additionalProperties: false,
    },
    scenarioComplete: {
      type: "boolean",
      description: "Set to true when the entire scenario (narrative, 3 decisions, MCQ, feedback) is finished.",
    },
  },
  required: [
    "narrativeSteps",
    "mainCharacterImage",
    "decisionPoint",
    "mcq",
    "feedback",
    "scenarioComplete",
  ],
  additionalProperties: false,
};

// Helper to get current game state from dialogue history
// (This is a simplified version; a more robust implementation might parse the history more deeply)
function getCurrentGameState(history: any[]) {
    let decisionCount = 0;
    let mcqPresented = false;
    let mcqAnswered = false;
    let lastDecisionIndex: number | null = null;
    let lastMcqAnswerIndex: number | null = null;

    history.forEach(entry => {
        if (entry.role === 'assistant') {
            try {
                const stepData = JSON.parse(entry.content);
                if (stepData.decisionPoint) {
                    decisionCount++;
                }
                if (stepData.mcq) {
                    mcqPresented = true;
                }
            } catch (e) { /* ignore parse errors */ }
        } else if (entry.role === 'user') {
            // Very basic check for user actions based on text content
             if (entry.content?.startsWith("I choose:")) {
                 // Extract index if possible, otherwise just note a decision was made
                 const match = entry.content.match(/Option index (\d+)/); // Assuming FE sends index
                 if (match) lastDecisionIndex = parseInt(match[1], 10);
             } else if (entry.content?.startsWith("My answer:")) {
                 mcqAnswered = true;
                 const match = entry.content.match(/Option index (\d+)/); // Assuming FE sends index
                 if (match) lastMcqAnswerIndex = parseInt(match[1], 10);
             }
        }
    });

     // Adjust decision count based on user actions if Assistant log is unreliable
     const userDecisions = history.filter(m => m.role === 'user' && m.content?.startsWith("I choose:")).length;
     decisionCount = Math.max(decisionCount, userDecisions);


    return { decisionCount, mcqPresented, mcqAnswered, lastDecisionIndex, lastMcqAnswerIndex };
}


export async function POST(req: NextRequest) {
  try {
    // 1) Verify environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    // 2) Parse the request body
    const { userId, decisionIndex } = (await req.json()) as {
      userId?: string;
      decisionIndex?: number | null; // Index of the decision made by the user
    };

    if (!userId) {
      return NextResponse.json({ error: "Missing userId in request" }, { status: 400 });
    }

    console.log(`[/api/lesson] Request for user ${userId}, decisionIndex: ${decisionIndex}`);

    // 3) Get user and goal info from Supabase
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("name, focused_goal_id")
      .eq("id", userId)
      .single();

    if (userError || !userRow) {
      console.error("Could not find user:", userError);
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const userName = userRow.name;
    const focusedGoalId = userRow.focused_goal_id;
    if (!focusedGoalId) {
      return NextResponse.json({ error: "User has no focused_goal_id" }, { status: 400 });
    }

    const { data: goalRow, error: goalError } = await supabase
      .from("goals")
      .select("name, description") // Fetch description too
      .eq("id", focusedGoalId)
      .single();

    if (goalError || !goalRow) {
      console.error("Could not find goal:", goalError);
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    const goalName = goalRow.name;
    const goalDescription = goalRow.description || "No description provided."; // Use description

     // 4) Fetch existing dialogue history
     const { data: userGoalsRow, error: userGoalsError } = await supabase
       .from("user_goals")
       .select("dialogue_history")
       .eq("user_id", userId)
       .eq("goal_id", focusedGoalId)
       .single();

     const dialogueHistory = userGoalsRow?.dialogue_history ?? [];

     // 5) Determine current game state from history
     const gameState = getCurrentGameState(dialogueHistory);
     console.log("[/api/lesson] Current Game State:", gameState);

    // 6) Build the dynamic system prompt for the narrative scenario
    const systemPrompt = `
You are a scenario generator for an educational game. The player is "${userName}".
The current learning goal is "${goalName}". Goal Description: "${goalDescription}".

Scenario Characters:
- Rani Singh (Mentor, drone business owner): pfp=/game/characters_pfp/rani.png, image=/game/characters/rani.png
- Ali Shetty (Business Partner): pfp=/game/characters_pfp/ali.png, image=/game/characters/ali.png
- Yash Patel (Wise Villager, ethical compass): pfp=/game/characters_pfp/yash.png, image=/game/characters/yash.png
- Nisha Kapoor (Government Official, stakeholder): pfp=/game/characters_pfp/nisha.png, image=/game/characters/nisha.png
- Narrator (Sets scene, provides context): pfp=/game/characters_pfp/narrator.png, image=null

Scenario Structure:
1. Start with an engaging narrative scene related to the goal, involving 1-2 characters. Use the Narrator if needed. Show the main character speaking using 'mainCharacterImage'.
2. Present the user with the FIRST decision point (a question with 4 distinct options).
3. Based on the user's choice (decisionIndex), continue the narrative, showing consequences or reactions.
4. Present the user with the SECOND decision point.
5. Based on the choice, continue the narrative.
6. Present the user with the THIRD decision point.
7. Based on the choice, continue the narrative, leading towards a conclusion.
8. Present a final Multiple Choice Question (MCQ) testing the core learning from the scenario. It should have 1 correct answer.
9. If the user has just answered the MCQ, provide feedback ('feedback' object). Check their answer (lastMcqAnswerIndex) against the correct index you defined for the MCQ.
10. After feedback, set 'scenarioComplete' to true and provide a brief concluding narrative message (in narrativeSteps).

Current State:
- Decisions made so far: ${gameState.decisionCount}
- MCQ presented: ${gameState.mcqPresented}
- MCQ answered: ${gameState.mcqAnswered}
${decisionIndex !== null ? `- User just chose decision option index: ${decisionIndex}` : ''}
${gameState.lastMcqAnswerIndex !== null ? `- User just answered MCQ with option index: ${gameState.lastMcqAnswerIndex}` : ''}

Instructions:
- Generate the *next step* of the scenario based on the Current State.
- If decisionCount < 3 and mcqPresented is false, the next step should likely contain a decisionPoint (unless you are mid-narrative flow).
- If decisionCount == 3 and mcqPresented is false, the next step *must* contain the 'mcq'.
- If mcqPresented is true and mcqAnswered is true, the next step *must* contain 'feedback' and set 'scenarioComplete' to true.
- Use the characters naturally. Make the dialogue engaging and relevant to the goal.
- Ensure 'pfp' and 'mainCharacterImage' paths are exactly as specified above. Use null for mainCharacterImage if the character display shouldn't change from the previous step.
- The 'narrativeSteps' array should contain the dialogue for the *current* step only.
- Keep narrative segments between decisions relatively concise.
- Ensure all required fields in the JSON schema are present.

Your response MUST be a single JSON object matching the provided schema. Do not include any text outside the JSON structure.
`.trim();

    // 7) Combine system prompt and simplified history (or just the last user action)
    // Sending full history can make the context too long/expensive. Let's rely on the state tracking.
    const messagesForOpenAI = [
      { role: "system", content: systemPrompt },
      // Optionally add the last user message if it's relevant context beyond the index
       ...(dialogueHistory.length > 0 ? [dialogueHistory[dialogueHistory.length - 1]] : []),
    ];
     // If the user just made a decision, add a simplified user message for context
     if (decisionIndex !== null && gameState.decisionCount <= 3) {
         messagesForOpenAI.push({ role: "user", content: `I chose decision option index ${decisionIndex}. What happens next?` });
     }
     // If the user just answered the MCQ
     if (gameState.mcqPresented && gameState.lastMcqAnswerIndex !== null && !gameState.mcqAnswered) { // Check ensures we don't double-add
        messagesForOpenAI.push({ role: "user", content: `I answered the MCQ with option index ${gameState.lastMcqAnswerIndex}. Was I correct?` });
     }


    console.log("[/api/lesson] Messages for OpenAI =>", JSON.stringify(messagesForOpenAI, null, 2));

    // 8) Call OpenAI
    const payload = {
      model: "gpt-4o-2024-08-06", // Use a capable model like GPT-4o
      messages: messagesForOpenAI,
      response_format: {
        type: "json_object", // Use json_object mode if schema isn't strictly required by the model version/API access level
        // Use json_schema mode if available and preferred for strictness:
        // type: "json_schema",
        // json_schema: {
        //   name: "narrative_scenario_step",
        //   description: "A single step in the narrative scenario.",
        //   schema: scenarioStepSchema,
        //   strict: true, // Enforce schema compliance strictly
        // },
      },
      temperature: 0.7, // Adjust for creativity vs consistency
    };

    console.log("[/api/lesson] OpenAI Payload =>", JSON.stringify(payload, null, 2));
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    console.log("[/api/lesson] OpenAI response status:", response.status);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("[/api/lesson] OpenAI error response:", errorText);
      try {
          const errorJson = JSON.parse(errorText);
          return NextResponse.json({ error: errorJson.error || errorText }, { status: response.status });
      } catch {
         return NextResponse.json({ error: `OpenAI request failed with status ${response.status}: ${errorText}` }, { status: response.status });
      }
    }

    const data = await response.json();
    console.log("[/api/lesson] OpenAI response data =>", JSON.stringify(data, null, 2));

    // 9) Extract and Parse JSON content
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      console.error("[/api/lesson] No content in OpenAI response.");
      return NextResponse.json({ error: "No content returned from AI model" }, { status: 500 });
    }

    let parsedScenarioStep;
    try {
      parsedScenarioStep = JSON.parse(content);
      // TODO: Add validation against scenarioStepSchema here if not using strict mode in OpenAI call
    } catch (err) {
      console.error("[/api/lesson] Could not parse JSON from AI =>", content);
      return NextResponse.json({ error: "Could not parse JSON response from AI", content }, { status: 500 });
    }

    console.log("[/api/lesson] Parsed Scenario Step =>", JSON.stringify(parsedScenarioStep, null, 2));


     // 10) Prepare data for Supabase logging
     const userActionEntry = decisionIndex !== null
         ? { role: "user", content: `User chose decision index: ${decisionIndex}` }
         : gameState.mcqPresented && gameState.lastMcqAnswerIndex !== null
           ? { role: "user", content: `User answered MCQ index: ${gameState.lastMcqAnswerIndex}` }
           : { role: "user", content: "User initiated scenario or continued." }; // Fallback/initial

     const assistantEntry = { role: "assistant", content }; // Store the raw JSON string

     // Only add user action if it's not already the last entry (prevents duplicates on retry/refresh)
     const updatedDialogue = [...dialogueHistory];
     if (updatedDialogue.length === 0 || JSON.stringify(updatedDialogue[updatedDialogue.length - 1]) !== JSON.stringify(userActionEntry)) {
         // Or better: check if the *specific action* (decision/MCQ answer) for this step is already logged
         // This simple check is okay for now but could be improved
         updatedDialogue.push(userActionEntry);
     }
     updatedDialogue.push(assistantEntry);


    // 11) Upsert dialogue history in Supabase
    const { error: upsertError } = await supabase
      .from("user_goals")
      .upsert(
        {
          user_id: userId,
          goal_id: focusedGoalId,
          dialogue_history: updatedDialogue,
          updated_at: new Date().toISOString(),
          // Optionally update progress based on scenarioComplete flag or decision count
           progress: parsedScenarioStep.scenarioComplete
             ? 100
             : Math.min(95, (gameState.decisionCount + (decisionIndex !== null ? 1: 0)) * 25 + (parsedScenarioStep.mcq ? 15 : 0) + (parsedScenarioStep.feedback ? 5: 0)), // Rough progress calculation
        },
        { onConflict: "user_id,goal_id" }
      );

    if (upsertError) {
      console.error("Error upserting user_goals:", upsertError);
      // Decide if this should be a blocking error for the user
      // return NextResponse.json({ error: "Failed to save progress." }, { status: 500 });
    }

    // 12) Return the parsed scenario step to the frontend
    return NextResponse.json({ scenarioStep: parsedScenarioStep });

  } catch (err: any) {
    console.error("[/api/lesson] Unhandled Route error =>", err);
    return NextResponse.json({ error: err.message || "An internal server error occurred." }, { status: 500 });
  }
}