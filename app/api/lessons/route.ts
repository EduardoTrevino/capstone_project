import { NextRequest, NextResponse } from "next/server"

// We'll define a simpler schema for the *next* chunk of the lesson:
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
    // Must list all keys in properties under required, 
    // to satisfy "strict": true
    required: ["phaseName", "messages", "mcq", "feedback", "summary"],
    additionalProperties: false,
  }

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    // The client sends us the conversation so far as array of { role: string, content: string }
    // We also expect the "latestInstruction" or something that we want to do next
    const { messages } = await req.json()

    // Build ChatCompletion
    // We'll keep a system prompt that instructs the model:
    const systemPrompt = `You are a friendly tutor for kids learning Drone Basics (especially "What is a Drone in Agriculture"). 
We are conducting a multi-phase lesson. 
Each response you give should be valid JSON abiding by this schema:
1) "phaseName": can be "initial", "middle", "final", etc.
2) "messages": an array of short strings showing the text that the tutor says in that phase
3) "mcq" (only if we are in final quiz phase) with question, options[], correctOptionIndex
4) "feedback" (only if user answered the quiz) with correctFeedback, incorrectFeedback
5) "summary" (only if the lesson is truly complete)
We are having a back-and-forth conversation with the user, so read all prior messages to see user input. 
If the user is still in the "initial" knowledge check, ask them about their prior knowledge. 
If they have answered, move on to the next phase. 
Stop once we have the final quiz, feedback, and summary. 
All responses must be purely JSON with no additional text outside the JSON.
If the user has not reached the final quiz stage, set "mcq": null, "feedback": null, "summary": null.`

    // We'll compose the messages for the chat:
    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages, // user + assistant messages so far
    ]

    // We'll use the same "gpt-4o-2024-08-06" with structured outputs
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
      max_tokens: 900,
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json({ error }, { status: response.status })
    }

    const data = await response.json()
    // The raw JSON is probably in data.choices[0].message.content
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      return NextResponse.json({ error: "No content returned from model" }, { status: 500 })
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      return NextResponse.json({ error: "Could not parse JSON", content }, { status: 500 })
    }

    return NextResponse.json({ nextPhase: parsed })
  } catch (err: any) {
    console.error("Error in POST /api/lessons:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}