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
          character: {
            type: "string",
            description: "Name of the character speaking (e.g., Rani, Ali, Yash, Nisha, Narrator).",
            enum: ["Rani", "Ali", "Yash", "Nisha", "Narrator"]
          },
          pfp: {
            type: "string",
            description: "Full path to the character's profile picture (e.g., /game/character_pfp/rani.png). Use /game/character_pfp/narrator.png for Narrator.",
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
  let correctedDecisionCount = 0; // Track based on assistant responses

  // First pass: Count decisions presented by assistant and check for MCQ
  history.forEach(entry => {
      if (entry.role === 'assistant') {
          try {
              const stepData = JSON.parse(entry.content);
              if (stepData.decisionPoint) {
                  correctedDecisionCount++; // Count decisions the AI *sent*
              }
              if (stepData.mcq) {
                  mcqPresented = true;
              }
               if (stepData.feedback) { // If feedback was given, MCQ must have been answered
                  mcqAnswered = true;
               }
          } catch (e) { /* ignore parse errors */ }
      }
  });

  // Second pass: Correlate user actions for last indices and potentially refine mcqAnswered
  history.forEach(entry => {
      if (entry.role === 'user') {
          if (entry.content?.includes("chose decision index")) { // More robust check
               const match = entry.content.match(/index: (\d+)/);
               if (match) lastDecisionIndex = parseInt(match[1], 10);
               decisionCount++; // Count user *actions* separately
          } else if (entry.content?.includes("answered MCQ index")) { // More robust check
               mcqAnswered = true; // Mark as answered based on user action too
               const match = entry.content.match(/index: (\d+)/);
               if (match) lastMcqAnswerIndex = parseInt(match[1], 10);
          }
      }
  });

  // Use the count of decisions the user actually *made* for progression logic
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
     const previousGameState = getCurrentGameState(dialogueHistory);
     console.log("[/api/lesson] Previous Game State:", previousGameState);

     // 6) Calculate the state *after* this user action (important for prompt)
     const isMcqAnswerSubmission = previousGameState.mcqPresented && !previousGameState.mcqAnswered && decisionIndex === null; // User submitted MCQ answer
     const currentDecisionCount = previousGameState.decisionCount + (decisionIndex !== null ? 1 : 0); // Increment if a decision was made *now*
     const currentMcqAnswered = previousGameState.mcqAnswered || isMcqAnswerSubmission;

     console.log(`[/api/lesson] Calculated current state for prompt: Decisions=${currentDecisionCount}, MCQ Answered=${currentMcqAnswered}`);

    // 6) Build the dynamic system prompt for the narrative scenario
    const systemPrompt = `
You are a scenario generator for an educational game. The player is "${userName}".
The current learning goal is "${goalName}". Goal Description: "${goalDescription}".

Scenario Characters:
- Rani Singh (Mentor, drone business owner): pfp=/game/character_pfp/rani.png, image=/game/characters/rani.png
- Ali Shetty (Business Partner): pfp=/game/character_pfp/ali.png, image=/game/characters/ali.png
- Yash Patel (Wise Villager, ethical compass): pfp=/game/character_pfp/yash.png, image=/game/characters/yash.png
- Nisha Kapoor (Government Official, stakeholder): pfp=/game/character_pfp/nisha.png, image=/game/characters/nisha.png
- Narrator (Sets scene, provides context): pfp=/game/character_pfp/narrator.png, image=/game/characters/narrator.png

Scenario Structure & State Tracking:
1.  **Start:** Begin with narrativeSteps and the FIRST decisionPoint (decisionCount = 0 going to 1).
2.  **Decision 1 -> 2:** User chooses (decisionIndex provided). Generate narrativeSteps reflecting choice, then the SECOND decisionPoint (decisionCount = 1 going to 2).
3.  **Decision 2 -> 3:** User chooses. Generate narrativeSteps, then the THIRD decisionPoint (decisionCount = 2 going to 3).
4.  **Decision 3 -> MCQ:** User chooses. Generate narrativeSteps, then the FINAL mcq (decisionCount = 3, mcqPresented = false).
5.  **MCQ -> Feedback:** User answers MCQ (decisionIndex is null). Generate feedback and set scenarioComplete=true. Add a final concluding narrativeStep.
6.  **Completion:** Scenario is complete.

Current State (Reflects state *after* the user's latest action):
- Decisions made so far (by user): ${currentDecisionCount}
- MCQ presented in previous step: ${previousGameState.mcqPresented}
- MCQ answered now (by user): ${currentMcqAnswered}
${decisionIndex !== null ? `- User just chose decision option index: ${decisionIndex}` : ''}
${isMcqAnswerSubmission ? `- User just submitted an answer for the MCQ.` : ''}

Your Task: Generate the JSON for the *next* step based on the 'Current State'.

Instructions:
- **Progression:**
    - If currentDecisionCount < 3 AND previousGameState.mcqPresented == false: Generate narrativeSteps and the *next* decisionPoint.
    - If currentDecisionCount == 3 AND previousGameState.mcqPresented == false: Generate narrativeSteps and the *mcq*.
    - If previousGameState.mcqPresented == true AND currentMcqAnswered == true: Generate *feedback* and set scenarioComplete=true. Include a final concluding narrativeStep.
- **Content:** Use characters naturally. Dialogue should be engaging and relevant. Keep narrative segments concise. Ensure 'pfp' and 'mainCharacterImage' paths are EXACTLY as specified. Use null for mainCharacterImage if no change.
- **Output:** MUST be a single JSON object matching the schema. No extra text. Ensure all required fields (narrativeSteps, mainCharacterImage, decisionPoint, mcq, feedback, scenarioComplete) are present, using null where appropriate. narrativeSteps should not be empty unless it's the very final feedback/completion step where only feedback is needed.
`.trim();

    // 8) Combine system prompt and history (keep it simple)
    const messagesForOpenAI = [
      { role: "system", content: systemPrompt },
      // Give the AI the immediate context of the last thing *it* said, and the user's response
      ...(dialogueHistory.length > 0 ? [dialogueHistory[dialogueHistory.length - 1]] : []), // Last assistant message
       ...(decisionIndex !== null
            ? [{ role: "user", content: `User chose decision index: ${decisionIndex}` }]
            : isMcqAnswerSubmission
              ? [{ role: "user", content: `User answered MCQ.` }] // Don't necessarily need the index here for the AI's next step
              : dialogueHistory.length === 0 ? [{ role: "user", content: "Start the scenario."}] : []), // Initial or non-action step
    ];


    console.log("[/api/lesson] Messages for OpenAI =>", JSON.stringify(messagesForOpenAI, null, 2));

    // 8) Call OpenAI
    const payload = {
      model: "gpt-4o-2024-08-06",
      messages: messagesForOpenAI,
      response_format: { type: "json_object" },
      temperature: 0.7,
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

    // Basic validation of the parsed step (crucial if not using strict schema)
    if (!parsedScenarioStep || typeof parsedScenarioStep !== 'object' || !('narrativeSteps' in parsedScenarioStep)) {
      console.error("[/api/lesson] Invalid structure in parsed JSON:", parsedScenarioStep);
      return NextResponse.json({ error: "Received invalid data structure from AI." }, { status: 500 });
  }

     // 10) Prepare data for Supabase logging (use more descriptive user action)
     const userActionEntry = decisionIndex !== null
         ? { role: "user", content: `User chose decision index: ${decisionIndex}` }
         : isMcqAnswerSubmission
           ? { role: "user", content: `User answered MCQ.` } // Log simple action
           : { role: "user", content: "User initiated scenario or continued." };

     const assistantEntry = { role: "assistant", content }; // Store the raw JSON string

     // Log user action IF it's a decision or MCQ answer
     const updatedDialogue = [...dialogueHistory];
     if (decisionIndex !== null || isMcqAnswerSubmission) {
         updatedDialogue.push(userActionEntry);
     }
     updatedDialogue.push(assistantEntry); // Always log the assistant response

    // 11) Upsert dialogue history in Supabase (update progress calculation slightly)
    const currentProgressValue = parsedScenarioStep.scenarioComplete
        ? 100
        : Math.min(95, 5 + (currentDecisionCount * 25) + (previousGameState.mcqPresented ? 15 : 0) + (currentMcqAnswered ? 5 : 0));

    const { error: upsertError } = await supabase
      .from("user_goals")
      .upsert(
        {
          user_id: userId,
          goal_id: focusedGoalId,
          dialogue_history: updatedDialogue,
          updated_at: new Date().toISOString(),
          progress: currentProgressValue,
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