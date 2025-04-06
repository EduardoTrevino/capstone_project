import React from "react"

interface QuestProgressBarProps {
  goal?: string
  progress: number
}

export const QuestProgressBar: React.FC<QuestProgressBarProps> = ({ goal = "Increase Revenue", progress = 0 }) => {
  // Ensure progress is between 0-100
  const progressPercentage = Math.min(100, Math.max(0, progress))

  return (
    <div className="max-w-md mx-auto">
      {/* Scroll background using goal_scroll.png */}
      <div
        className="relative bg-cover bg-center p-4"
        style={{ backgroundImage: "url('/goal/goal_scroll.png')" }}
      >
        {/* Goal title */}
        <h2 className="text-2xl font-bold text-center mb-4">Goal: {goal}</h2>

        {/* Progress bar container */}
        <div className="relative h-10 rounded-full p-1 flex items-center bg-gradient-to-b from-amber-950 via-amber-800 to-amber-950 shadow-inner border-2 border-amber-700">
          {/* Progress fill */}
          <div className="h-full rounded-full overflow-hidden relative" style={{ width: `${progressPercentage}%` }}>
            {/* Main gradient */}
            <div className="absolute inset-0 bg-gradient-to-b from-amber-200 via-amber-400 to-amber-600"></div>

            {/* Horizontal stripes for texture */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-300 to-transparent opacity-50"></div>

            {/* Top highlight */}
            <div className="absolute top-0 left-0 right-0 h-1/3 bg-gradient-to-b from-amber-100 to-transparent opacity-40"></div>

            {/* Bottom shadow */}
            <div className="absolute bottom-0 left-0 right-0 h-1/4 bg-gradient-to-t from-amber-800 to-transparent opacity-30"></div>

            {/* Light reflection */}
            <div className="h-1 w-8 bg-white rounded-full ml-4 mt-1 opacity-70"></div>
          </div>
        </div>

        {/* Progress text */}
        <p className="text-2xl font-bold text-center mt-4">Quest Progress: {progressPercentage}%</p>
      </div>
    </div>
  )
}
