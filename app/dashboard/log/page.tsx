"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from "@/lib/supabase";
import { ArrowLeft, ChevronDown, ChevronUp, Lock, RefreshCw, Loader2 } from 'lucide-react';
import { KcImpact } from '@/lib/types'; 

// --- TYPE DEFINITIONS ---
interface DecisionLog {
  decision_number: number;
  chosen_option_text: string | null;
  kc_impacts_of_choice: KcImpact[] | null;
}
interface ScenarioLog {
  scenario_attempt_number: number;
  decisions: DecisionLog[];
}
interface MetricChangeDisplay {
  name: string;
  change: number;
  icon: string;
  unit: string;
}
type HistoricalRecord = {
  scenario_attempt_number: number | null;
  decision_number: number | null;
  chosen_option_text: string | null;
  kc_impacts_of_choice: KcImpact[] | null;
};
interface DefinitionBundle {
  kcIdentifierToId: Map<string, number>;
  kcIdToMetricIds: Map<number, number[]>;
  metricIdToName: Map<number, string>;
  metricUnits: Record<string, string>;
}
interface UserGoal {
  id: number;
  name: string;
  description: string;
  user_goal_id: number;
  progress: number | null;
  status: string;
  dialogue_history: any;
}

// --- CONSTANTS & HELPERS ---
const METRIC_SORT_ORDER = [
  "Ethical-Decision Making", "Risk-Taking Ability", "Creative Thinking", "Aspiration Index",
  "Monetary Growth", "Customer Satisfaction", "Reputation",
];

async function getCalculationDefinitions(): Promise<DefinitionBundle> {
  const [kcsRes, effectsRes, metricsRes] = await Promise.all([
    supabase.from('kcs').select('id, kc_identifier'),
    supabase.from('kc_metric_effects').select('kc_id, metric_id'),
    supabase.from('metrics').select('id, name')
  ]);
  if (kcsRes.error) throw new Error(`Failed to fetch KCs: ${kcsRes.error.message}`);
  if (effectsRes.error) throw new Error(`Failed to fetch KC-Metric Effects: ${effectsRes.error.message}`);
  if (metricsRes.error) throw new Error(`Failed to fetch Metrics: ${metricsRes.error.message}`);
  const kcIdentifierToId = new Map(kcsRes.data.map(kc => [kc.kc_identifier, kc.id]));
  const metricIdToName = new Map(metricsRes.data.map(m => [m.id, m.name]));
  const kcIdToMetricIds = new Map<number, number[]>();
  for (const effect of effectsRes.data) {
    if (!kcIdToMetricIds.has(effect.kc_id)) {
      kcIdToMetricIds.set(effect.kc_id, []);
    }
    kcIdToMetricIds.get(effect.kc_id)!.push(effect.metric_id);
  }
  const metricUnits: Record<string, string> = { 'Revenue': '', 'Customer Satisfaction': '', 'Reputation': '', 'Ethical Decision Making': '', 'Risk-Taking': '', 'Creative Thinking': '', 'Aspiration Index': '' };
  return { kcIdentifierToId, kcIdToMetricIds, metricIdToName, metricUnits };
}

function calculateMetricChange(kcImpacts: KcImpact[], definitions: DefinitionBundle): MetricChangeDisplay[] {
    if (!kcImpacts || !definitions) return [];
    const { kcIdentifierToId, kcIdToMetricIds, metricIdToName, metricUnits } = definitions;
    const totalKcScores = new Map<string, number>();
    for (const impact of kcImpacts) {
        totalKcScores.set(impact.kc_identifier, (totalKcScores.get(impact.kc_identifier) || 0) + impact.score);
    }
    const cumulativeChanges = new Map<string, number>();
    for (const [kcIdentifier, totalScore] of totalKcScores.entries()) {
        const kcId = kcIdentifierToId.get(kcIdentifier);
        if (!kcId) continue;
        const affectedMetricIds = kcIdToMetricIds.get(kcId);
        if (!affectedMetricIds) continue;
        for (const metricId of affectedMetricIds) {
            const metricName = metricIdToName.get(metricId);
            if (!metricName) continue;
            let rawMetricChange = 0;
            switch (metricName) {
                case 'Revenue': rawMetricChange = totalScore * 5750; break;
                case 'Customer Satisfaction': rawMetricChange = totalScore * 6.5; break;
                case 'Reputation': rawMetricChange = totalScore * 0.28; break;
                case 'Ethical Decision Making': rawMetricChange = totalScore * 9.5; break;
                case 'Risk-Taking': rawMetricChange = totalScore * 9.5; break;
                case 'Creative Thinking': rawMetricChange = totalScore * 9.5; break;
                case 'Aspiration Index': rawMetricChange = totalScore * 9.5; break;
                default: rawMetricChange = totalScore * 2;
            }
            cumulativeChanges.set(metricName, (cumulativeChanges.get(metricName) || 0) + rawMetricChange);
        }
    }
    const METRIC_ICON_MAP: Record<string, string> = { "Revenue": "/assets/metric_icons/revenue_icon.svg", "Customer Satisfaction": "/assets/metric_icons/customer_satisfaction_icon.svg", "Reputation": "/assets/metric_icons/qar_icon.svg", "Ethical Decision Making": "/assets/metric_icons/edm_icon.svg", "Risk-Taking": "/assets/metric_icons/rt_icon.svg", "Creative Thinking": "/assets/Log/creative_thinking.png", "Aspiration Index": "/assets/Log/aspiration_index.png", };
    const DISPLAY_NAME_MAP: Record<string, string> = { "Revenue": "Monetary Growth", "Ethical Decision Making": "Ethical-Decision Making", "Risk-Taking": "Risk-Taking Ability", };
    const summary: MetricChangeDisplay[] = [];
    for (const [metricName, totalChange] of cumulativeChanges.entries()) {
      summary.push({ name: DISPLAY_NAME_MAP[metricName] || metricName, change: parseFloat(totalChange.toFixed(2)), unit: metricUnits[metricName] || '', icon: METRIC_ICON_MAP[metricName] || "/assets/metric_icons/revenue_icon.svg", });
    }
    return summary.sort((a, b) => {
        const indexA = METRIC_SORT_ORDER.indexOf(a.name);
        const indexB = METRIC_SORT_ORDER.indexOf(b.name);
        return indexA - indexB;
    });
}


// --- SUB-COMPONENTS ---

const RedoPopup = ({ onClose }: { onClose: () => void }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-[#FFFBF0] border-2 border-[#66943C] rounded-2xl p-6 shadow-xl max-w-sm w-full text-center">
                <h2 className="text-xl font-bold text-[#1F105C] mb-3">Redo</h2>
                <p className="text-gray-600 mb-6">
                    Oh no! Unfortunately we cannot redo this scenario at the moment, but normally you can use 1 life to replay this scenario.
                </p>
                <div className="flex justify-center gap-4">
                    <button onClick={onClose} className="bg-[#F2F3F5] text-[#4E5969] font-semibold px-6 py-2 rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
                    <button className="bg-gray-300 text-white font-semibold px-6 py-2 rounded-lg flex items-center gap-2 cursor-not-allowed opacity-50" disabled>
                        Use 1 <Image src="/assets/Business/Lives/heart.svg" alt="heart" width={20} height={20} />
                    </button>
                </div>
            </div>
        </div>
    );
};

const TotalMetricDisplay = ({ metric }: { metric: MetricChangeDisplay }) => {
    const isPositive = metric.change >= 0;
    const bgColor = isPositive ? 'bg-[#DDDAAC]' : 'bg-[#F0C2AB]';
    const textColor = isPositive ? 'text-[#66943C]' : 'text-[#B22335]';
    const sign = metric.change > 0 ? '+' : '';
    return (
        <div className={`flex items-center justify-between p-2 rounded-lg ${bgColor}`}>
            <div className="flex items-center gap-2"><Image src={metric.icon} alt={metric.name} width={32} height={32} /><span className={`text-sm font-semibold ${textColor}`}>{metric.name}</span></div>
            <span className={`font-bold text-base ${textColor}`}>{sign}{metric.change}</span>
        </div>
    );
};

const DecisionMetricDisplay = ({ metric }: { metric: MetricChangeDisplay }) => {
    const isPositive = metric.change >= 0;
    const bgColor = isPositive ? 'bg-[#DDDAAC]' : 'bg-[#F0C2AB]';
    const textColor = isPositive ? 'text-[#66943C]' : 'text-[#B22335]';
    const sign = metric.change > 0 ? '+' : '';
    return (
        <div className={`flex items-center justify-between p-2 rounded-lg ${bgColor}`}>
            <div className="flex items-center gap-3"><Image src={metric.icon} alt={metric.name} width={24} height={24} /><span className={`text-sm font-medium ${textColor}`}>{metric.name}</span></div>
            <span className={`font-bold text-base ${textColor}`}>{sign}{metric.change}</span>
        </div>
    );
};

const DecisionPoint = ({ decision, index, definitions }: { decision: DecisionLog, index: number, definitions: DefinitionBundle | null }) => {
    const metrics = useMemo(() => {
        if (!definitions) return [];
        return calculateMetricChange(decision.kc_impacts_of_choice || [], definitions);
    }, [decision.kc_impacts_of_choice, definitions]);
    return (
        <div className="relative pl-12 py-3">
            <div className="absolute top-3 left-0 w-10 h-10 bg-[#FDC905] rounded-full flex items-center justify-center font-bold text-[#2B3F6C] z-10">D{index + 1}</div>
            <div className="space-y-2"><p className="text-sm font-medium text-gray-700">{decision.chosen_option_text}</p>
                {metrics.map((metric, idx) => (<DecisionMetricDisplay key={idx} metric={metric} />))}
            </div>
        </div>
    );
};

const ScenarioLogCard = ({ scenario, isExpanded, onToggle, definitions, onRedoClick }: { scenario: ScenarioLog; isExpanded: boolean; onToggle: () => void; definitions: DefinitionBundle | null; onRedoClick: () => void; }) => {
    const scenarioNumber = scenario.scenario_attempt_number;
    const totalMetrics = useMemo(() => {
        if (!definitions) return [];
        const allImpacts = scenario.decisions.flatMap(d => d.kc_impacts_of_choice || []);
        return calculateMetricChange(allImpacts, definitions);
    }, [scenario.decisions, definitions]);

    return (
        <div className="relative mb-4">
            <Image src="/assets/Log/pin.png" alt="pin" width={32} height={32} className="absolute -top-4 -left-3 z-10" />
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-1 h-10 bg-dotted-line" style={{backgroundImage: 'linear-gradient(to bottom, #FFCD00 50%, transparent 50%)', backgroundSize: '2px 8px'}}></div>
            <div className="bg-[#FEEDD0] border border-[#66943C] rounded-2xl p-4 shadow-md">
                <h3 className="font-bold text-lg text-[#66943C] mb-2">Scenario {scenarioNumber}</h3>
                <div className="flex items-start gap-4">
                    <Image src={`/assets/Log/scenario_${scenarioNumber}.png`} alt={`Scenario ${scenarioNumber}`} width={80} height={80} className="rounded-lg border-2 border-[#FFB11A]" />
                    <div className="flex-grow space-y-2">{totalMetrics.map((metric, index) => <TotalMetricDisplay key={index} metric={metric} />)}</div>
                </div>
                <div className="flex justify-between items-center mt-3">
                    <button onClick={onRedoClick} className="flex items-center gap-1.5 bg-white text-[#B22335] px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-gray-100 border border-gray-200">
                        Redo <RefreshCw size={14} />
                    </button>
                    <button onClick={onToggle} className="flex items-center gap-1 bg-[#FFCE26] px-4 py-1.5 rounded-full text-sm font-semibold text-[#2B3F6C] hover:brightness-95">
                        {isExpanded ? 'Less' : 'View Details'} {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
                {/* --- ANIMATION IMPLEMENTED HERE --- */}
                <div className={`grid transition-all duration-500 ease-in-out ${isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                        {scenario.decisions.map((decision, index) => (
                            <DecisionPoint key={index} decision={decision} index={index} definitions={definitions} />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

const LockedScenarioCard = ({ scenarioNumber }: { scenarioNumber: number }) => (
    <div className="relative mb-4">
        <Image src="/assets/Log/pin.png" alt="pin" width={32} height={32} className="absolute -top-4 -left-3 z-20" />
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-1 h-10 bg-dotted-line" style={{backgroundImage: 'linear-gradient(to bottom, #D47A14 50%, transparent 50%)', backgroundSize: '2px 8px'}}></div>
        <div className="bg-[#FEEDD0] border border-[#66943C] rounded-2xl p-4 shadow-md relative overflow-hidden h-36 flex items-center justify-start">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm z-10 flex items-center justify-center"><Lock className="text-white" size={48} /></div>
            <Image src={`/assets/Log/scenario_${scenarioNumber}.png`} alt={`Scenario ${scenarioNumber}`} width={150} height={150} className="blur-sm w-auto h-full object-cover"/>
        </div>
    </div>
);

const BottomNav = ({ router, currentGoal }: { router: any, currentGoal: UserGoal | null }) => {
  const handlePlayClick = () => { if (!currentGoal) { alert("Please select a goal first!"); return; } router.push("/dashboard/game"); };
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50">
      <div className="relative h-[95px] bg-white rounded-t-[32px] flex items-center justify-around px-6">
        <button onClick={() => router.push("/dashboard")} className="hover:scale-110 transition"><Image src="/assets/Navbar/Navbar_Personal Icons/Navbar_Personal Icons_Clicked/Navbar_Personal Icons_Clicked.png" alt="home" width={48} height={48} /></button>
        <div className="relative -top-5">
          <button onClick={handlePlayClick} className="w-[100px] h-[100px] bg-white rounded-full border-8 border-white flex items-center justify-center hover:scale-110 transition"><Image src="/assets/Navbar/Navbar_GameButton/Navbar_GameButton.png" alt="game" fill style={{ objectFit: "contain" }} /></button>
        </div>
        <button onClick={() => router.push("/dashboard/growth")} className="hover:scale-110 transition"><Image src="/assets/Navbar/Navbar_Business Icons/Navbar_Business Icons_Clicked/Navbar_Business Icons_Clicked.png" alt="biz" width={48} height={48} /></button>
      </div>
    </nav>
  );
};

// --- MAIN PAGE COMPONENT ---
export default function LogPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [scenarios, setScenarios] = useState<ScenarioLog[]>([]);
    const [isGoalCompleted, setIsGoalCompleted] = useState(false);
    const [userLives, setUserLives] = useState(3);
    const [definitions, setDefinitions] = useState<DefinitionBundle | null>(null);
    const [expandedScenarios, setExpandedScenarios] = useState<Set<number>>(new Set());
    const [showRedoPopup, setShowRedoPopup] = useState(false);

    const toggleScenario = (scenarioNumber: number) => {
        setExpandedScenarios(prev => { const newSet = new Set(prev); if (newSet.has(scenarioNumber)) newSet.delete(scenarioNumber); else newSet.add(scenarioNumber); return newSet; });
    };

    const fetchLogData = useCallback(async (userId: string) => {
        setIsLoading(true); setError(null);
        try {
            const defs = await getCalculationDefinitions(); setDefinitions(defs);
            const { data: userData, error: userError } = await supabase.from('users').select('focused_goal_id, lives').eq('id', userId).single();
            if (userError || !userData) throw new Error("Could not fetch user data.");
            if (!userData.focused_goal_id) { setError("Please select a goal on your dashboard to view the log."); setIsLoading(false); return; }
            setUserLives(userData.lives ?? 3);
            const focusedGoalId = userData.focused_goal_id;
            const { data: userGoalData, error: goalError } = await supabase.from('user_goals').select('status').eq('user_id', userId).eq('goal_id', focusedGoalId).single();
            if (goalError) throw new Error("Could not fetch goal status.");
            setIsGoalCompleted(userGoalData?.status === 'completed');
            const { data: historicalData, error: historyError } = await supabase.from('historical_learning_analytics').select('scenario_attempt_number, decision_number, chosen_option_text, kc_impacts_of_choice').eq('user_id', userId).eq('goal_id', focusedGoalId).order('scenario_attempt_number', { ascending: true }).order('decision_number', { ascending: true });
            if (historyError) throw new Error("Could not load your history.");
            const scenariosMap = new Map<number, ScenarioLog>();
            (historicalData as HistoricalRecord[]).forEach(record => {
                if (!record.scenario_attempt_number || !record.decision_number) return;
                if (!scenariosMap.has(record.scenario_attempt_number)) { scenariosMap.set(record.scenario_attempt_number, { scenario_attempt_number: record.scenario_attempt_number, decisions: [], }); }
                scenariosMap.get(record.scenario_attempt_number)!.decisions.push({ decision_number: record.decision_number, chosen_option_text: record.chosen_option_text, kc_impacts_of_choice: record.kc_impacts_of_choice, });
            });
            setScenarios(Array.from(scenariosMap.values()));
        } catch (e: any) { console.error("Error fetching log data:", e.message); setError(e.message || "An unexpected error occurred."); } finally { setIsLoading(false); }
    }, []);

    useEffect(() => { const userId = localStorage.getItem("userId"); if (userId) { fetchLogData(userId); } else { router.push('/'); } }, [fetchLogData, router]);

    const playedScenariosCount = scenarios.length;

    if (isLoading) {
        return (
            <main className="min-h-screen w-full flex items-center justify-center" style={{ background: "url('/assets/Background/PNG/Fixed Background.png') center/cover fixed" }}>
                <Loader2 className="h-12 w-12 animate-spin text-white" />
            </main>
        );
    }
    
    return (
        <div className="min-h-screen w-full overflow-x-hidden overflow-y-auto pb-[120px]" style={{ background: "url('/assets/Background/PNG/Fixed Background.png') center/cover fixed" }}>
            {showRedoPopup && <RedoPopup onClose={() => setShowRedoPopup(false)} />}
            
            <header className="p-4">
                <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-lg p-2 flex items-center justify-between">
                    <button onClick={() => router.push('/dashboard')} className="w-10 h-10 bg-[#B22335] rounded-full flex items-center justify-center text-white hover:bg-red-800 transition-colors"><ArrowLeft size={24} /></button>
                    <div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-[#1F105C]">LOG</h1><Image src="/assets/Log/Log_Icon/Log_Icon.png" alt="Log Icon" width={28} height={28} /></div>
                    <div className="flex items-center gap-1.5 bg-white/50 px-3 py-1 rounded-full"><Image src="/assets/Business/Lives/heart.svg" alt="Lives" width={24} height={24} /><span className="font-bold text-lg text-[#1F105C]">{userLives}</span></div>
                </div>
            </header>

            <main className="pt-4 px-4 max-w-md mx-auto">
                {error && (<div className="text-center p-6 bg-red-100 border border-red-400 text-red-700 rounded-lg"><p className="font-bold">Oops!</p><p>{error}</p></div>)}
                {!error && (
                    <>
                        {scenarios.map((scenario) => (
                            <ScenarioLogCard key={scenario.scenario_attempt_number} scenario={scenario} isExpanded={expandedScenarios.has(scenario.scenario_attempt_number)} onToggle={() => toggleScenario(scenario.scenario_attempt_number)} definitions={definitions} onRedoClick={() => setShowRedoPopup(true)} />
                        ))}
                        {!isGoalCompleted && playedScenariosCount < 3 && Array.from({ length: 3 - playedScenariosCount }).map((_, index) => (
                            <LockedScenarioCard key={playedScenariosCount + index + 1} scenarioNumber={playedScenariosCount + index + 1} />
                        ))}
                        <div className="relative flex flex-col items-center mt-2">
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 w-1 h-10 bg-dotted-line" style={{backgroundImage: 'linear-gradient(to bottom, #FFCD00 50%, transparent 50%)', backgroundSize: '2px 8px'}}></div>
                            <Image src={isGoalCompleted ? "/assets/Log/trophy.png" : "/assets/Log/trophy_shaded.png"} alt="Trophy" width={100} height={100} className="mt-4" />
                        </div>
                    </>
                )}
            </main>
            
            <BottomNav router={router} currentGoal={null} />
        </div>
    );
}