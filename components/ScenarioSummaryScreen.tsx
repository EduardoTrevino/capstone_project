// components/ScenarioSummaryScreen.tsx

"use client";

import Image from "next/image";
import React from 'react';
import { useRouter } from "next/navigation";

// Define the props interface for the component
interface ScenarioSummaryScreenProps {
  scenarioAttemptNumber: number;
  currentGoalProgress: number;
  // NEW: Pass the goalStatus to determine the final screen state
  goalStatus: 'completed' | 'failed_needs_retry' | 'active' | string; 
  metricChanges: Array<{ metricName: string; change: number; unit: string; finalValue: number }>;
  onContinue: () => void;
  onReturnToDashboard: () => void;
}

// Map metric names to their icon paths for easy lookup
const metricIconMap: Record<string, string> = {
  "Revenue": "/assets/revenue_icon.svg",
  "Customer Satisfaction": "/assets/customer_satisfaction_icon.svg",
  "Reputation": "/assets/qar_icon.svg",
  "Ethical Decision Making": "/assets/edm_icon.svg",
  "Risk-Taking": "/assets/rt_icon.svg",
};

export default function ScenarioSummaryScreen({
  scenarioAttemptNumber,
  currentGoalProgress,
  goalStatus,
  metricChanges,
  onContinue,
  onReturnToDashboard,
}: ScenarioSummaryScreenProps) {
  const router = useRouter();

  // --- NEW: Logic to determine which state to display ---
  const isGoalCompleted = goalStatus === 'completed';
  const isGoalFailed = goalStatus === 'failed_needs_retry';
  // The "Continue" button should only show if the goal is still active.
  const canContinueToNextScenario = !isGoalCompleted && !isGoalFailed;

  const onViewLog = () => {
    router.push('/dashboard/log');
  };

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{
        backgroundImage: `url('/game/bgs/bg_1.png')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="bg-[#FEECCF] text-[#1F105C] p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center animate-fade-in flex flex-col items-center">
        
        <h1 className="text-2xl font-bold mb-2">
          {isGoalCompleted ? "Goal Complete!" : `Scenario ${scenarioAttemptNumber} Complete!`}
        </h1>
        
        <h2 className="text-xl font-bold text-[#D47A14] mb-1">Goal Progress</h2>
        
        <div className="w-full bg-[#F2D7B2] rounded-full h-5 border border-[#D47A14] p-0.5 mb-6">
          <div className="bg-gradient-to-r from-[#F0A24A] to-[#D47A14] h-full rounded-full flex items-center justify-start transition-all duration-500" style={{ width: `${currentGoalProgress}%` }}>
            <span className="text-white text-xs font-bold pl-2">{currentGoalProgress}%</span>
          </div>
        </div>
        
        <h3 className="text-lg font-bold mb-3">You Got</h3>
        
        <div className="w-full space-y-2 mb-4">
          {metricChanges.map((metric, index) => {
            const displayName = metric.metricName === 'Revenue' ? 'Monetary Growth' : metric.metricName;
            const iconPath = metricIconMap[metric.metricName] || "/assets/revenue_icon.svg";
            const isPositive = metric.change >= 0;
            
            return (
              <div key={index} className="bg-white/70 rounded-lg p-3 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-3">
                  <Image src={iconPath} alt={displayName} width={32} height={32} />
                  <span className="font-semibold text-sm">{displayName}</span>
                </div>
                <span className={`font-bold text-lg ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                  {isPositive ? '+' : ''}{metric.change.toLocaleString()}{metric.unit}
                </span>
              </div>
            );
          })}
        </div>
        
        {/* --- NEW: Conditional status messages --- */}
        <div className="min-h-[60px] flex items-center justify-center text-center px-2 mb-4">
          {isGoalCompleted && (
            <p className="font-semibold text-green-700">
              You successfully completed the goal, check out the log to see how you did.
            </p>
          )}
          {isGoalFailed && (
            <p className="font-semibold text-red-700 text-sm">
              Oh no! It looks like we made some bad decisions along the way. No worries, review your log and try again, but it will cost you a life!
            </p>
          )}
        </div>
        
        <div className="w-full space-y-3 flex flex-col items-center">
          {/* --- NEW: Conditionally render the Continue button --- */}
          {canContinueToNextScenario && (
            <button
              onClick={onContinue}
              className="w-full max-w-xs px-6 py-3 bg-[#F4C14D] text-[#1F105C] rounded-full text-lg font-bold hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out flex items-center justify-center gap-2"
            >
              Continue
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </button>
          )}

          <button
            onClick={onViewLog}
            className="w-full max-w-xs px-6 py-2.5 bg-transparent border-2 border-[#1F105C] text-[#1F105C] rounded-full text-md font-bold hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-[#1F105C] shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out flex items-center justify-center gap-3"
          >
            View My Log
            <Image src="/assets/Log/Log_Icon/Log_Icon.png" alt="Log" width={24} height={24} />
          </button>
          
          <button
            onClick={onReturnToDashboard}
            className="text-sm text-gray-600 hover:text-gray-800 hover:underline mt-2 pt-2"
          >
            Return to Dashboard
          </button>
        </div>
        
      </div>
    </div>
  );
}