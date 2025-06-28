// components/ScenarioSummaryScreen.tsx
"use client";

import Image from "next/image";
import React, { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

// Define the props interface for the component
interface ScenarioSummaryScreenProps {
  userId: string;
  goalId: number | null;
  scenarioAttemptNumber: number;
  currentGoalProgress: number;
  goalStatus: 'completed' | 'failed_needs_retry' | 'active' | string;
  onContinue: () => void;
  onReturnToDashboard: () => void;
}

// Map metric names to their icon paths for easy lookup
const metricIconMap: Record<string, string> = {
  "Revenue": "/assets/metric_icons/revenue_icon.svg",
  "Customer Satisfaction": "/assets/metric_icons/customer_satisfaction_icon.svg",
  "Reputation": "/assets/metric_icons/qar_icon.svg",
  "Ethical Decision Making": "/assets/metric_icons/edm_icon.svg",
  "Risk-Taking": "/assets/metric_icons/rt_icon.svg",
};

export default function ScenarioSummaryScreen({
  userId,
  goalId,
  scenarioAttemptNumber,
  currentGoalProgress,
  goalStatus,
  onContinue,
  onReturnToDashboard,
}: ScenarioSummaryScreenProps) {
  const router = useRouter();
  // The type of metricChanges is updated to reflect that `unit` is part of the main object
  const [metricChanges, setMetricChanges] = useState<Array<{ metricName: string; change: number; unit: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !goalId) {
      setError("User or Goal information is missing.");
      setIsLoading(false);
      return;
    }
    
    const calculateScenarioChanges = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const { data: historyData, error: historyError } = await supabase
          .from('historical_learning_analytics')
          .select('decision_number, metric_values_after_decision')
          .eq('user_id', userId)
          .eq('goal_id', goalId)
          .eq('scenario_attempt_number', scenarioAttemptNumber)
          .in('decision_number', [1, 3]);

        if (historyError) throw historyError;

        const startRecord = historyData.find(d => d.decision_number === 1);
        const endRecord = historyData.find(d => d.decision_number === 3);

        if (!startRecord?.metric_values_after_decision || !endRecord?.metric_values_after_decision) {
          throw new Error("Missing start or end data for scenario summary calculation.");
        }
        
        const startMetrics = startRecord.metric_values_after_decision as Record<string, number>;
        const endMetrics = endRecord.metric_values_after_decision as Record<string, number>;

        const metricUnits: Record<string, string> = {
          'Revenue': '₹',
          'Customer Satisfaction': '%',
          'Reputation': '%',
          'Ethical Decision Making': '%',
          'Risk-Taking': '%',
        };

        const cumulativeSummary: Array<{ metricName: string; change: number; unit: string }> = [];
        
        for (const metricName in endMetrics) {
          const endValue = endMetrics[metricName] || 0;
          const startValue = startMetrics[metricName] || 0; 
          const change = parseFloat((endValue - startValue).toFixed(2));

          // --- FIX: REMOVED THE if (change !== 0) CONDITION ---
          // Now we push every metric, regardless of whether it changed.
          cumulativeSummary.push({
            metricName: metricName,
            change: change,
            unit: metricUnits[metricName] || '%',
          });
        }
        
        setMetricChanges(cumulativeSummary);

      } catch (e: any) {
        console.error("Error calculating summary:", e.message);
        setError("Could not load scenario summary.");
      } finally {
        setIsLoading(false);
      }
    };

    calculateScenarioChanges();
  }, [userId, goalId, scenarioAttemptNumber]);

  // --- UI Logic ---
  const isGoalCompleted = goalStatus === 'completed';
  const isGoalFailed = goalStatus === 'failed_needs_retry';
  const canContinueToNextScenario = !isGoalCompleted && !isGoalFailed;

  const onViewLog = () => router.push('/dashboard/log');

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundImage: `url('/game/bgs/bg_1.png')`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
      <div className="bg-[#FEECCF] text-[#1F105C] p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center animate-fade-in flex flex-col items-center">
        
        <h1 className="text-2xl font-bold mb-2">{isGoalCompleted ? "Goal Complete!" : `Scenario ${scenarioAttemptNumber} Complete!`}</h1>
        <h2 className="text-xl font-bold text-[#D47A14] mb-1">Goal Progress</h2>
        
        <div className="w-full bg-[#F2D7B2] rounded-full h-5 border border-[#D47A14] p-0.5 mb-6">
          <div className="bg-gradient-to-r from-[#F0A24A] to-[#D47A14] h-full rounded-full flex items-center justify-start transition-all duration-500" style={{ width: `${currentGoalProgress}%` }}>
            <span className="text-white text-xs font-bold pl-2">{currentGoalProgress}%</span>
          </div>
        </div>
        
        <h3 className="text-lg font-bold mb-3">You Got</h3>
        
        <div className="w-full space-y-2 mb-4 min-h-[150px]">
          {isLoading ? (
            <div className="flex justify-center items-center h-full"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : error ? (
            <p className="text-red-600">{error}</p>
          ) : (
            metricChanges.map((metric, index) => {
              const displayName = metric.metricName === 'Revenue' ? 'Monetary Growth' : metric.metricName;
              const iconPath = metricIconMap[metric.metricName] || "/assets/metric_icons/revenue_icon.svg";
              
              // --- FIX: ADDED COLOR LOGIC FOR ZERO CHANGE ---
              const changeColorClass = 
                metric.change > 0 
                ? 'text-green-600' 
                : metric.change < 0 
                ? 'text-red-600' 
                : 'text-gray-500'; // Neutral grey for zero

              // Prefix for positive numbers, but not for zero
              const changePrefix = metric.change > 0 ? '+' : '';
              
              return (
                <div key={index} className="bg-white/70 rounded-lg p-3 flex items-center justify-between shadow-sm">
                  <div className="flex items-center gap-3">
                    <Image src={iconPath} alt={displayName} width={32} height={32} />
                    <span className="font-semibold text-sm">{displayName}</span>
                  </div>
                  <span className={`font-bold text-lg ${changeColorClass}`}>
                    {changePrefix}{metric.change.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{metric.unit}
                  </span>
                </div>
              );
            })
          )}
        </div>
        
        {/* ... (Rest of the JSX remains the same) ... */}
        <div className="min-h-[60px] flex items-center justify-center text-center px-2 mb-4">
          {isGoalCompleted && (<p className="font-semibold text-green-700">You successfully completed the goal, check out the log to see how you did.</p>)}
          {isGoalFailed && (<p className="font-semibold text-red-700 text-sm">Oh no! It looks like we made some bad decisions along the way. No worries, review your log and try again, but it will cost you a life!</p>)}
        </div>
        
        <div className="w-full space-y-3 flex flex-col items-center">
          {canContinueToNextScenario && (
            <button onClick={onContinue} className="w-full max-w-xs px-6 py-3 bg-[#F4C14D] text-[#1F105C] rounded-full text-lg font-bold hover:bg-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-400 shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out flex items-center justify-center gap-2">
              Continue
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
            </button>
          )}

          <button onClick={onViewLog} className="w-full max-w-xs px-6 py-2.5 bg-transparent border-2 border-[#1F105C] text-[#1F105C] rounded-full text-md font-bold hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-[#1F105C] shadow-lg transform hover:scale-105 transition-all duration-150 ease-in-out flex items-center justify-center gap-3">
            View My Log
            <Image src="/assets/Log/Log_Icon/Log_Icon.png" alt="Log" width={24} height={24} />
          </button>
          
          <button onClick={onReturnToDashboard} className="text-sm text-gray-600 hover:text-gray-800 hover:underline mt-2 pt-2">Return to Dashboard</button>
        </div>
        
      </div>
    </div>
  );
}