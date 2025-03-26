"use client"

import { useState, useEffect, FormEvent } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"

// We'll define a type for our local messages:
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// We'll define a type for the "phase" data from the server:
interface LessonPhase {
  phaseName: string;
  messages: string[];
  mcq?: {
    question: string;
    options: string[];
    correctOptionIndex: number;
  };
  feedback?: {
    correctFeedback: string;
    incorrectFeedback: string;
  };
  summary?: string;
}

export default function DroneGamePage() {
  const router = useRouter()

  // Full conversation so far
  const [messages, setMessages] = useState<ChatMessage[]>([])

  // The current "phase" from the AI
  const [phase, setPhase] = useState<LessonPhase | null>(null)

  // Loading states
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // For MCQ
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [isQuizDone, setIsQuizDone] = useState(false)

  // For user input text area
  const [userInput, setUserInput] = useState("")

  // On mount, we call the API once to get the "initial" phase
  useEffect(() => {
    loadNextPhase([]) // no prior messages yet
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A helper function that calls our /api/lessons route with the current conversation
  async function loadNextPhase(updatedMessages: ChatMessage[]) {
    try {
      setIsLoading(true)
      setError(null)

      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedMessages }),
      })

      if (!res.ok) {
        // If the server gave a 4xx or 5xx error, parse it
        let errData
        try {
          errData = await res.json()
        } catch {
          throw new Error(`HTTP Error ${res.status}`)
        }
        throw new Error(
          typeof errData?.error === "string"
            ? errData.error
            : JSON.stringify(errData.error)
        )
      }

      const data = await res.json()

      if (data?.error) {
        // data.error might be an object
        setError(
          typeof data.error === "string"
            ? data.error
            : JSON.stringify(data.error)
        )
        setIsLoading(false)
        return
      }

      const nextPhase: LessonPhase = data.nextPhase
      if (!nextPhase) {
        setError("No nextPhase returned from the server.")
        setIsLoading(false)
        return
      }

      // We'll just store the user-friendly lines in the conversation for record
      const combinedAssistantContent = nextPhase.messages.join("\n")

      // Add the assistant message to our local conversation
      const newMessages = [
        ...updatedMessages,
        { role: "assistant" as const, content: combinedAssistantContent },
      ]
      setMessages(newMessages)
      setPhase(nextPhase)
      setIsLoading(false)
    } catch (err: any) {
      // Make sure we convert err.message to a string
      const msg = typeof err.message === "string" ? err.message : JSON.stringify(err.message)
      setError(msg)
      setIsLoading(false)
    }
  }

  // Submit user text -> update messages -> call the API
  async function handleUserSubmit(e: FormEvent) {
    e.preventDefault()
    if (!userInput.trim()) return

    // Add user's message
    const updated = [...messages, { role: "user" as const, content: userInput }]
    setMessages(updated)
    setUserInput("") // clear the input

    // Now fetch the next phase from the model
    await loadNextPhase(updated)
  }

  // If we have an MCQ:
  function handleSelectOption(idx: number) {
    setSelectedOption(idx)
  }

  async function handleSubmitQuiz() {
    if (selectedOption == null || !phase?.mcq) return

    // The user answered -> store that as a user message
    // We'll do something like "I select option #2" so the model can produce feedback
    const userAnswer = `User selected option index = ${selectedOption}`
    const updated = [...messages, { role: "user" as const, content: userAnswer }]
    setMessages(updated)
    setHasAnswered(true)

    // Then we ask the model for the feedback
    await loadNextPhase(updated)
  }

  // If we see `phase.feedback` or a `phase.summary`, that means the model
  // gave feedback or ended the lesson. We can handle that in the UI:
  useEffect(() => {
    if (!phase) return
    // If the model just returned feedback or summary, we might set isQuizDone to true, etc.
    if (phase.summary) {
      setIsQuizDone(true)
    }
  }, [phase])

  // If there's an error, show it
  if (error) {
    return (
      <div className="relative w-full min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="bg-white p-4 rounded shadow">
          <p className="text-red-600">
            Error:
            <br />
            {error}
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-2 px-4 py-2 bg-gray-200 rounded"
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  // Render the background and character
  // We'll always show the background, even if loading
  return (
    <div className="relative w-full min-h-screen bg-blue-50">
      {/* Go Back */}
      <button
        onClick={() => router.push("/dashboard")}
        className="absolute top-4 left-4 px-4 py-2 bg-white rounded z-10"
      >
        Back
      </button>

      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <Image
          src="/game/drone-agriculture.png"
          alt="Drone farmland"
          fill
          className="object-cover"
        />
      </div>

      {/* Outer container */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-center items-end px-4 pb-6">
        <div className="relative flex flex-col md:flex-row items-end max-w-4xl w-full">
          {/* Character */}
          <div className="relative w-40 h-40 md:w-48 md:h-48">
            <Image
              src="/game/Amar_transp_bg.png"
              alt="Drone Teacher"
              fill
              className="object-contain"
            />
          </div>

          {/* Speech bubble */}
          <div className="relative bg-white p-4 rounded-xl shadow-md ml-3 mb-14 max-w-md min-h-[120px]">
            {/* pointer */}
            <div className="absolute -left-2 bottom-4 w-4 h-4 bg-white rotate-45" />

            {/* If loading, show "..." else show the latest phase messages */}
            {isLoading ? (
              <div className="flex items-center justify-center h-full w-full">
                <span className="animate-pulse text-2xl">...</span>
              </div>
            ) : phase ? (
              <>
                {phase.messages.map((msg, idx) => (
                  <p key={idx} className="mb-3 text-sm text-gray-700">
                    {msg}
                  </p>
                ))}

                {/* If we have an MCQ and not answered yet, show the quiz */}
                {phase.mcq && !hasAnswered && !isQuizDone && (
                  <div className="mt-4">
                    <p className="font-semibold">{phase.mcq.question}</p>
                    <div className="flex flex-col gap-2 mt-2">
                      {phase.mcq.options.map((opt, idx) => (
                        <label key={idx} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="mcq"
                            checked={selectedOption === idx}
                            onChange={() => handleSelectOption(idx)}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      onClick={handleSubmitQuiz}
                      className="mt-2 px-3 py-1 bg-blue-200 rounded"
                    >
                      Submit
                    </button>
                  </div>
                )}

                {/* If we see feedback or summary from the model, show that */}
                {phase.feedback && (hasAnswered || isQuizDone) && (
                  <div className="mt-3">
                    <p className="text-green-700">
                      Correct: {phase.feedback.correctFeedback}
                    </p>
                    <p className="text-red-700">
                      Incorrect: {phase.feedback.incorrectFeedback}
                    </p>
                  </div>
                )}

                {phase.summary && (
                  <div className="mt-3">
                    <p className="font-semibold text-gray-800">{phase.summary}</p>
                    <button
                      onClick={() => router.push("/dashboard")}
                      className="mt-3 px-3 py-1 bg-blue-200 rounded"
                    >
                      Done
                    </button>
                  </div>
                )}
              </>
            ) : (
              // If there's no data or we haven't loaded
              <div className="text-sm text-gray-500">No lesson data yet.</div>
            )}
          </div>
        </div>
      </div>

      {/* If we have a phase that expects user input (like the knowledge gauge),
          show a text area + "send" button, instead of a “Continue” button. 
          We'll guess that any phaseName except "final" might want user input. 
          Adjust logic as needed. */}
      {phase && !phase.mcq && !phase.summary && !isLoading && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center">
          <form
            onSubmit={handleUserSubmit}
            className="flex gap-2 items-center max-w-xl w-full px-4"
          >
            <textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Type your response here..."
              className="resize-none w-full p-2 rounded-md border border-gray-300 text-sm"
              rows={2}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-300 rounded-md text-sm font-medium"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
