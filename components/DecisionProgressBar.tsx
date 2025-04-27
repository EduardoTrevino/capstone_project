// components/DecisionProgressBar.tsx
import React from "react"

interface ProgressStepProps {
  label: string
  status: "completed" | "current" | "upcoming"
}

const ProgressStep: React.FC<ProgressStepProps> = ({ label, status }) => {
  return (
    <div className="flex flex-col items-center flex-1">
      <div
        className={`text-sm font-medium mb-2 whitespace-nowrap ${status === "upcoming" ? "text-white/80" : "text-white"}`}
      >
        {label}
      </div>
      <div className={`h-2 w-full rounded-full ${status === "upcoming" ? "bg-yellow-300" : "bg-orange-400"}`}></div>
    </div>
  )
}

interface DecisionProgressBarProps {
  currentStep: number // Expecting 1-based index (1 for step 1, 2 for step 2, etc.)
  steps?: Array<{
    label: string
  }>
}

// UPDATED default steps to reflect 3 decisions + 1 MCQ
const defaultSteps = [
  { label: "Decision 1" },
  { label: "Decision 2" },
  { label: "Decision 3" },
  { label: "MCQ" }, // Changed "Done" to "MCQ"
];

export default function DecisionProgressBar({
  currentStep = 1,
  steps = defaultSteps, // Use the updated default
}: DecisionProgressBarProps) {
  return (
    // REMOVED bg-black/30, p-2, rounded-lg, shadow from this div
    <div className="flex flex-grow gap-4 items-center"> {/* Increased gap slightly */}
        {steps.map((step, index) => {
          let status: "completed" | "current" | "upcoming"

          // Determine status based on 1-based currentStep
          if (index < currentStep - 1) {
            status = "completed"
          } else if (index === currentStep - 1) {
            status = "current"
          } else {
            status = "upcoming"
          }

          return (
            <React.Fragment key={index}>
              <ProgressStep label={step.label} status={status} />
            </React.Fragment>
          )
        })}
      </div>
  )
}