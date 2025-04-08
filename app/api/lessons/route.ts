import { NextRequest, NextResponse } from "next/server"
import { supabase } from "@/lib/supabase" // client with insert/update perms

const nextPhaseSchema = {
  type: "object",
  properties: {
    phaseName: { type: "string" },
    messages: {
      type: "array",
      items: { type: "string" },
    },
    mcq: {
      type: ["object", "null"],
      properties: {
        question: { type: "string" },
        options: {
          type: "array",
          items: { type: "string" },
        },
        correctOptionIndex: { type: "integer" },
      },
      required: ["question", "options", "correctOptionIndex"],
      additionalProperties: false,
    },
    feedback: {
      type: ["object", "null"],
      properties: {
        correctFeedback: { type: "string" },
        incorrectFeedback: { type: "string" },
      },
      required: ["correctFeedback", "incorrectFeedback"],
      additionalProperties: false,
    },
    summary: {
      type: ["string", "null"],
    },
  },
  required: ["phaseName", "messages", "mcq", "feedback", "summary"],
  additionalProperties: false,
}

export async function POST(req: NextRequest) {
  try {
    // 1) Verify environment
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    // 2) Parse the request body
    const { userId, messages } = await req.json() as {
      userId?: string
      messages?: { role: string; content: string }[]
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing userId in request" }, { status: 400 })
    }

    console.log("[/api/lesson] Received messages:", JSON.stringify(messages, null, 2))

    // 3) Get user from Supabase to find name + focused_goal_id
    const { data: userRow, error: userError } = await supabase
      .from("users")
      .select("name, focused_goal_id")
      .eq("id", userId)
      .single()

    if (userError || !userRow) {
      console.error("Could not find user:", userError)
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const userName = userRow.name
    const focusedGoalId = userRow.focused_goal_id
    if (!focusedGoalId) {
      return NextResponse.json({ error: "User has no focused_goal_id" }, { status: 400 })
    }

    // 4) Get the goal
    const { data: goalRow, error: goalError } = await supabase
      .from("goals")
      .select("name")
      .eq("id", focusedGoalId)
      .single()

    if (goalError || !goalRow) {
      console.error("Could not find goal:", goalError)
      return NextResponse.json({ error: "Goal not found" }, { status: 404 })
    }

    const goalName = goalRow.name

    // 5) Build a dynamic system prompt
    const systemPrompt = `
You are a friendly tutor for a student named "${userName}", who is currently focusing on the goal "${goalName}".
We have a multi-phase lesson:
- If the user is still in initial knowledge check, ask them about prior knowledge.
- Move on to middle content.
- Then a final single quiz with exactly 1 correct answer => Provide feedback once user answers.
- Then show a short "summary" to finish the lesson.

Your answer must match this JSON schema:
1) "phaseName": "initial" | "middle" | "final" ...
2) "messages": short text lines for this phase
3) "mcq": { question, options[], correctOptionIndex } or null if not in final quiz
4) "feedback": { correctFeedback, incorrectFeedback } or null if not at feedback stage
5) "summary": string or null if not done

Stop after 1 final quiz + feedback + summary.
Return only JSON, no extra text.
If quiz not reached => "mcq": null, "feedback": null, "summary": null
`.trim()

    // 6) Combine system + user messages
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
    ]
    console.log("[/api/lesson] chatMessages to model =>", JSON.stringify(chatMessages, null, 2))

    const payload = {
      model: "gpt-4o-2024-08-06",
      messages: chatMessages,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "lesson_next_phase",
          description: "Single-phase chunk of the lesson, in JSON format.",
          schema: nextPhaseSchema,
          strict: true,
        },
      },
      temperature: 0.7,
    }

    // 7) Call OpenAI
    console.log("[/api/lesson] Payload =>", JSON.stringify(payload, null, 2))
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    console.log("[/api/lesson] OpenAI responded with status:", response.status)
    if (!response.ok) {
      const error = await response.json()
      console.error("[/api/lesson] OpenAI error =>", error)
      return NextResponse.json({ error }, { status: response.status })
    }

    const data = await response.json()
    console.log("[/api/lesson] data =>", JSON.stringify(data, null, 2))

    // 8) Extract assistant's raw JSON
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      console.error("[/api/lesson] No content in data.choices[0].message.")
      return NextResponse.json({ error: "No content returned from model" }, { status: 500 })
    }

    // 9) Parse JSON
    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      console.error("[/api/lesson] Could not parse JSON =>", content)
      return NextResponse.json({ error: "Could not parse JSON", content }, { status: 500 })
    }

    console.log("[/api/lesson] final parsed =>", JSON.stringify(parsed, null, 2))

    // 10) Upsert new conversation snippet into user_goals.dialogue_history
    //     First, fetch existing conversation.
    const { data: userGoalsRow, error: userGoalsError } = await supabase
      .from("user_goals")
      .select("dialogue_history")
      .eq("user_id", userId)
      .eq("goal_id", focusedGoalId)
      .single()

    // If there's no existing row, userGoalsRow might be null, but let's handle it.
    const existingDialogue = userGoalsRow?.dialogue_history ?? []

    // We'll append the newly-arrived user messages + the new assistant chunk
    // Note that "messages" from request might have multiple user entries
    // We'll store them as-is. We also store the entire `content` from the assistant.
    const newDialogueEntries = [
      ...(messages || []), // user messages
      { role: "assistant", content }, // the AI's raw JSON
    ]

    const updatedDialogue = [...existingDialogue, ...newDialogueEntries]

    // 11) Upsert the row in user_goals
    //     (If the row doesn’t exist, this will create it.)
    const { error: upsertError } = await supabase
      .from("user_goals")
      .upsert({
        user_id: userId,
        goal_id: focusedGoalId,
        dialogue_history: updatedDialogue, // must be valid JSON
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,goal_id" }
    )

    if (upsertError) {
      console.error("Error upserting user_goals:", upsertError)
      // Not critical to block returning, but you might handle it if needed.
    }

    // 12) Return the parsed JSON as { nextPhase: parsed }
    return NextResponse.json({ nextPhase: parsed })
  } catch (err: any) {
    console.error("[/api/lesson] Route error =>", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
