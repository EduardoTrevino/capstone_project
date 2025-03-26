"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
// If streaming, you might import a custom useChat hook or SSE approach

export default function DroneGamePage() {
  const router = useRouter()
  
  // In production, you'd fetch from your server or call OpenAI with your structured schema.
  // For demonstration, let's hardcode a typical *parsed* result from the LLM:
  const mockStructuredOutput = {
    phases: [
      {
        phaseName: "initial",
        messages: [
          "Hey there! Before we start, do you know anything about how drones are used in agriculture?"
        ],
      },
      {
        phaseName: "middle",
        messages: [
          "Great! Let’s dive in. A drone in agriculture is basically a small aircraft (usually quadcopters) that farmers use for tasks like mapping fields, spraying crops, and monitoring plant health.",
          "They help reduce labor, gather data quickly, and improve yields. They’ve become a friend to many modern farmers."
        ],
      },
      {
        phaseName: "final",
        messages: [
          "Now that you’ve got a sense of what drones do in agriculture, let’s see if you can answer a quick question!"
        ],
      },
    ],
    mcq: {
      question: "Which of the following best describes an agricultural drone?",
      options: [
        "A small flying device used to play video games in the sky",
        "A specialized aircraft that helps farmers monitor and manage crops",
        "A robotic vacuum used to clean barn floors",
        "A water pump for irrigating fields",
      ],
      correctOptionIndex: 1,
    },
    feedback: {
      correctFeedback: "Excellent! Drones in agriculture help with tasks like surveying, spraying, and monitoring crops.",
      incorrectFeedback: "Not quite. Agricultural drones are indeed specialized flying vehicles that gather data from above!",
    },
    summary:
      "Well done! You learned that drones in agriculture are specialized aircraft that help farmers manage their fields more efficiently. They reduce labor, gather detailed data, and can improve overall yields. Keep exploring to discover more ways drones are revolutionizing modern farming!",
  }

  // Local state to walk user through phases
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0)
  const [hasAnswered, setHasAnswered] = useState(false)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [hasQuizCompleted, setHasQuizCompleted] = useState(false)

  // For demonstration, just store the entire LLM object:
  const { phases, mcq, feedback, summary } = mockStructuredOutput

  // Current Phase's messages
  const phase = phases[currentPhaseIndex]
  
  // When user “Continue” from the final phase, show the MCQ
  const isFinalPhase = phase.phaseName === "final"
  const lastPhase = currentPhaseIndex === phases.length - 1

  const handleContinue = () => {
    // If not at last phase, go to next
    if (!lastPhase) {
      setCurrentPhaseIndex(prev => prev + 1)
    } 
    // If at last phase, go into MCQ
    else {
      // proceed to the quiz
    }
  }

  const handleSelectOption = (index: number) => {
    setSelectedOption(index)
  }

  const handleSubmitQuiz = () => {
    if (selectedOption === null) return
    setHasAnswered(true)

    if (selectedOption === mcq.correctOptionIndex) {
      // correct
    } else {
      // incorrect
    }
  }

  const handleDone = () => {
    // after user sees feedback, show final summary or something
    setHasQuizCompleted(true)
  }

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-blue-50">
      {/* Header / “Back” button */}
      <div className="absolute top-4 left-4 z-10">
        <button
          onClick={() => router.push("/dashboard")}
          className="px-3 py-2 bg-white rounded-md text-sm font-semibold"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Background image */}
      <div className="absolute inset-0 w-full h-full">
        <Image
          src="/game/drone-agriculture.png"
          alt="Drone flying over agricultural field"
          fill
          className="object-cover"
        />
      </div>

      {/* If we've not completed the final summary, show the “character + bubble” */}
      {!hasQuizCompleted ? (
        <div className="absolute bottom-0 left-0 right-0 flex justify-center items-end px-4 pb-6">
          <div className="relative flex flex-col md:flex-row items-end max-w-4xl w-full">
            {/* Character */}
            <div className="relative w-48 h-48 md:w-56 md:h-56 z-10">
              <Image
                src="/game/Amar_transp_bg.png"
                alt="Agricultural guide character"
                fill
                className="object-contain"
              />
            </div>

            {/* Speech bubble */}
            <div className="relative ml-4 mb-12 max-w-md bg-white p-4 rounded-xl shadow-lg">
              {/* Speech bubble pointer */}
              <div className="absolute -left-2 bottom-4 w-4 h-4 bg-white rotate-45" />

              {/* Display the current phase messages */}
              {phase?.messages?.map((msg, i) => (
                <p key={i} className="mb-3 text-sm text-gray-700">
                  {msg}
                </p>
              ))}

              {/* If we are at the final phase (before MCQ), show “continue to quiz” button */}
              {!isFinalPhase && (
                <button
                  onClick={handleContinue}
                  className="mt-2 px-4 py-2 bg-blue-200 rounded text-sm font-medium"
                >
                  Continue
                </button>
              )}

              {/* If final phase, proceed to MCQ */}
              {isFinalPhase && !hasAnswered && (
                <div className="mt-4">
                  <p className="font-semibold">{mcq.question}</p>
                  <div className="flex flex-col mt-2 gap-2">
                    {mcq.options.map((opt, idx) => (
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
                    className="mt-2 px-4 py-2 bg-blue-200 rounded text-sm font-medium"
                  >
                    Submit
                  </button>
                </div>
              )}

              {/* If user has answered, show feedback */}
              {hasAnswered && (
                <div className="mt-4">
                  {selectedOption === mcq.correctOptionIndex ? (
                    <p className="text-green-600 font-semibold">
                      {feedback.correctFeedback}
                    </p>
                  ) : (
                    <p className="text-red-600 font-semibold">
                      {feedback.incorrectFeedback}
                    </p>
                  )}

                  <button
                    onClick={handleDone}
                    className="mt-2 px-4 py-2 bg-blue-200 rounded text-sm font-medium"
                  >
                    Finish Lesson
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Show final summary
        <div className="absolute inset-0 bg-white/90 flex flex-col items-center justify-center p-4 text-center">
          <h2 className="text-2xl font-bold mb-4">Lesson Complete!</h2>
          <p className="max-w-lg text-gray-700 mb-8">{summary}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-blue-200 rounded text-sm font-medium"
          >
            Return to Dashboard
          </button>
        </div>
      )}
    </div>
  )
}
