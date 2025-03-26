import { NextRequest, NextResponse } from "next/server"

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
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 })
    }

    const { messages } = await req.json()
    console.log("[/api/lesson] Received messages:", JSON.stringify(messages, null, 2))

    const systemPrompt = `
You are a friendly tutor for kids learning Drone Basics ("What is a Drone in Agriculture"). 
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
`

    const chatMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
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
    //   max_tokens: 900,
    }
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

    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      console.error("[/api/lesson] No content in data.choices[0].message.")
      return NextResponse.json({ error: "No content returned from model" }, { status: 500 })
    }

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (err) {
      console.error("[/api/lesson] Could not parse JSON =>", content)
      return NextResponse.json({ error: "Could not parse JSON", content }, { status: 500 })
    }

    console.log("[/api/lesson] final parsed =>", JSON.stringify(parsed, null, 2))

    return NextResponse.json({ nextPhase: parsed })
  } catch (err: any) {
    console.error("[/api/lesson] Route error =>", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
