import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase"; // Ensure this is your admin client for writes

export const maxDuration = 300;

/**
 * A helper function to delay execution for a specified number of milliseconds.
 * @param ms The number of milliseconds to wait.
 * @returns A promise that resolves after the delay.
 */
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Wraps the native fetch API with a retry mechanism featuring exponential backoff.
 * This is useful for handling transient network errors or temporary server-side issues.
 * @param url The URL to fetch.
 * @param options The options for the fetch request.
 * @param maxRetries The maximum number of times to retry the request.
 * @returns A promise that resolves with the fetch Response object.
 * @throws Throws the last error encountered after all retries have been exhausted.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Calculate delay with exponential backoff (e.g., 1s, 2s, 4s)
        const delayDuration = 1000 * Math.pow(2, attempt - 1);
        console.log(`[fetchWithRetry] Attempt ${attempt} failed. Retrying in ${delayDuration / 1000}s...`);
        await delay(delayDuration);
      }

      const response = await fetch(url, options);

      // If the response is OK (2xx status), we're done!
      if (response.ok) {
        return response;
      }

      // We should only retry on specific server errors (5xx), not client errors (4xx).
      if (response.status >= 500 && response.status < 600) {
        // This is a server error, so we'll throw an error to trigger a retry.
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      // If it's a client error (e.g., 400, 401, 429), don't retry. Return the failed response immediately.
      console.error(`[fetchWithRetry] Non-retriable client error: ${response.status}. Aborting retries.`);
      return response;

    } catch (error: any) {
      lastError = error;
      console.error(`[fetchWithRetry] An error occurred on attempt ${attempt + 1}:`, error.message);
    }
  }

  // If we've exhausted all retries, throw the last error we captured.
  throw new Error(`[fetchWithRetry] API call failed after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}

function shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      // Find a random index from 0 to i
      const j = Math.floor(Math.random() * (i + 1));
      // Swap elements array[i] and array[j]
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

// Define the NEW structure for the JSON response we expect from OpenAI
const gameStepSchemaForAI = {
  type: "object",
  properties: {
    narrativeSteps: {
      type: "array",
      description: "Dialogue exchanges for this step. The first dialogue object can serve as the initial scene-setting for this part of the scenario. Subsequent dialogues react to choices or advance the narrative.",
      items: {
        type: "object",
        properties: {
          character: { type: "string", enum: ["Rani", "Ali", "Santosh", "Manju", "Rajesh", "Narrator"], description: "Character speaking." },
          pfp: { type: "string", description: "Full path to character pfp (e.g., /game/character_pfp/rani.png)." },
          text: { type: "string", description: "Dialogue text for this character." },
        },
        required: ["character", "pfp", "text"],
        additionalProperties: false,
      },
    },
    mainCharacterImage: {
      type: ["string", "null"],
      description: "Full path to main character image (e.g., /game/characters/ali.png) or null if no specific character is focused or image remains unchanged.",
    },
    scenarioContextNarrative: {
        type: "string",
        description: "A brief overarching narrative context for THE ENTIRE SCENARIO (max 3-4 sentences). This is generated ONCE at the start of a new scenario (when decision count is 0). For subsequent steps within the same scenario, this can be a very short reminder or omitted if narrativeSteps cover it."
    },
    scenarioKCsOverall: {
        type: "array",
        description: "List of 1 to 3 KC identifiers (e.g., 'KC6') that this ENTIRE SCENARIO primarily focuses on. Generated ONCE at the start of a new scenario. Pick from the provided KC list. These are the main learning objectives for the whole scenario.",
        items: { type: "string", description: "A KC identifier from the provided list." },
        minItems: 1,
        maxItems: 3,
    },
    decisionPoint: {
      type: ["object", "null"],
      description: "Present if the user needs to make a choice (max 3 per scenario). Null if scenarioComplete=true or if this step is purely narrative continuation without a new decision.",
      properties: {
        question: { type: "string", description: "The question or dilemma presented to the player for this decision point." },
        decisionPointKCsFocused: {
            type: "array",
            description: "List of 1 to 3 KC identifiers that this specific decision point primarily focuses on. Pick from the provided KC list.",
            items: { type: "string", description: "A KC identifier from the provided list." },
            minItems: 1,
            maxItems: 3
        },
        options: {
          type: "array",
          description: "Exactly 4 distinct options for the user to choose from.",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "The text content of the option." },
              kc_impacts: {
                type: "array",
                description: "List of 1 to 3 KCs impacted by choosing this option, along with their scores. Pick KC identifiers from the provided list.",
                items: {
                  type: "object",
                  properties: {
                    kc_identifier: { type: "string", description: "The KC identifier (e.g., 'KC6', 'KC5') affected. MUST be one of the provided KCs." },
                    score: { type: "number", description: "A floating point number score Between -1 and 1 representing the impact on this KC. Note 0 means no impact" }
                  },
                  required: ["kc_identifier", "score"],
                  additionalProperties: false
                },
                minItems: 1,
                maxItems: 3 // As per "1 < x < 4", allowing 1-3 for flexibility
              }
            },
            required: ["text", "kc_impacts"],
            additionalProperties: false
          },
          minItems: 4,
          maxItems: 4
        },
      },
      // If decisionPoint is an object, these fields are expected.
      // The 'null' type for decisionPoint handles its absence.
      required: ["question", "decisionPointKCsFocused", "options"],
      additionalProperties: false,
    },
    scenarioComplete: {
      type: "boolean",
      description: "Set to true when the entire scenario (narrative, 3 decisions) is finished.",
    },
  },
  required: [
    "narrativeSteps",
    "mainCharacterImage",
    // scenarioContextNarrative & scenarioKCsOverall are crucial for the first step of a new scenario
    // For subsequent steps, they might not be regenerated by AI if prompt guides it.
    // Let's make them required in schema, but prompt should guide when to fill them.
    "scenarioContextNarrative",
    "scenarioKCsOverall",
    "decisionPoint", // Key must be present, value can be null
    "scenarioComplete",
  ],
  additionalProperties: false,
};

interface KCDefinition { id: number; kc_identifier: string; name: string; description: string | null; }
interface MetricDefinition { id: number; name: string; data_type: string; min_value: number | null; max_value: number | null; initial_value: number; }
interface KCEffectLink { kc_id: number; metric_id: number; }
interface DefinitionsBundle {
    metrics: MetricDefinition[];
    kcEffects: KCEffectLink[];
    kcs: KCDefinition[];
    kcIdentifierToIdMap: Map<string, number>;
}
interface DialogueEntry {
    role: 'user' | 'assistant' | 'system';
    content: string;
  }

interface WinConditionItem {
    metric_name: string;
    operator: ">=" | "<=" | ">" | "<" | "==" | "=";
    value: number;
    type?: "absolute" | "change_from_baseline"; // For special handling
    is_profit_proxy?: boolean; // If this revenue condition actually represents profit
}

interface MetricScore {
    metrics: {
        name: string;
    };
    current_value: string | number;
}

// Helper to get current game state from dialogue history
function getCurrentGameState(history: any[]) {
    let userDecisionsMade = 0;
    let lastDecisionIndex: number | null = null;
    history.forEach(entry => {
        if (entry.role === 'user' && entry.content?.includes("User chose decision index:")) {
            userDecisionsMade++;
            const match = entry.content.match(/index: (\d+)/);
            if (match) lastDecisionIndex = parseInt(match[1], 10);
        }
    });
    return { decisionCount: userDecisionsMade, lastDecisionIndex };
}

async function getDefinitionsBundle(): Promise<DefinitionsBundle> {
    const { data: metricsData, error: metricsError } = await supabase
        .from('metrics')
        .select('id, name, data_type, min_value, max_value, initial_value');
    if (metricsError) throw new Error(`Failed to fetch metrics: ${metricsError.message}`);

    const { data: kcEffectsData, error: kcEffectsError } = await supabase
        .from('kc_metric_effects')
        .select('kc_id, metric_id');
    if (kcEffectsError) throw new Error(`Failed to fetch kc_metric_effects: ${kcEffectsError.message}`);

    const { data: kcsData, error: kcsError } = await supabase
        .from('kcs')
        .select('id, kc_identifier, name, description');
    if (kcsError) throw new Error(`Failed to fetch KCs: ${kcsError.message}`);
    
    const metrics = (metricsData || []).map(m => ({ ...m, initial_value: Number(m.initial_value) })) as MetricDefinition[];
    const kcs = (kcsData || []) as KCDefinition[];
    const kcIdentifierToIdMap = new Map(kcs.map(kc => [kc.kc_identifier, kc.id]));

    return {
        metrics,
        kcEffects: kcEffectsData || [],
        kcs,
        kcIdentifierToIdMap,
    };
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });

    const { userId, chosenOptionId } = (await req.json()) as { userId?: string; chosenOptionId?: number | null; };
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    console.log(`[/api/lessons] User: ${userId}, ChosenOptionId: ${chosenOptionId}`);

    const { data: userRow, error: userError } = await supabase.from("users").select("name, focused_goal_id").eq("id", userId).single();
    if (userError || !userRow || !userRow.focused_goal_id) {
        console.error("User or focused_goal_id invalid:", userError);
        return NextResponse.json({ error: "User or focused_goal_id setup invalid" }, { status: 404 });
    }
    const userName = userRow.name;
    const focusedGoalId = userRow.focused_goal_id;

    const { data: goalRow, error: goalError } = await supabase
        .from("goals")
        .select("name, description, win_conditions_description, win_conditions_structured")
        .eq("id", focusedGoalId)
        .single();
    if (goalError || !goalRow) {
        console.error("Goal not found:", goalError);
        return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }
    const { name: goalName, description: goalDescription, win_conditions_structured: goalWinConditionsStructured } = goalRow;
    const textualWinConditions = goalRow.win_conditions_description || "Achieve positive outcomes in key metrics."; // For prompt
    
    let { data: userGoalData, error: userGoalDbError } = await supabase // Changed name to avoid conflict
        .from("user_goals")
        .select("dialogue_history, attempts_for_current_goal_cycle, status, initial_metric_baselines") // Added initial_metric_baselines
        .eq("user_id", userId)
        .eq("goal_id", focusedGoalId)
        .single();

    if (userGoalDbError && userGoalDbError.code === 'PGRST116') {
        console.warn(`No user_goals entry for user ${userId}, goal ${focusedGoalId}. Creating one.`);
        // Fetch current metrics to store as baseline IF this is the very start of this goal for the user
        const { data: currentMetricsForBaseline } = await supabase
            .from('user_metric_scores')
            .select('metric_id, current_value')
            .eq('user_id', userId);
        
        const initialBaselines: {[key: string]: number} = {};
        await Promise.all((currentMetricsForBaseline || []).map(async m => {
            const metricDef = (await getDefinitionsBundle()).metrics.find(md => md.id === m.metric_id);
            if(metricDef) initialBaselines[metricDef.name] = Number(m.current_value);
        }));
        const revenueMetricDefForInit = (await getDefinitionsBundle()).metrics.find(m => m.name === 'Revenue');
        if (revenueMetricDefForInit && initialBaselines.hasOwnProperty('Revenue')) {
            await supabase.from('user_metric_history').insert({
                user_id: userId,
                goal_id: focusedGoalId, // The goal ID being started
                metric_id: revenueMetricDefForInit.id,
                scenario_attempt_number: 1, // First attempt
                decision_number: 0,         // State before any decisions in this attempt
                value: initialBaselines['Revenue'],
                recorded_at: new Date().toISOString()
            });        
        }

        const { data: newUserGoalData, error: insertError } = await supabase
            .from('user_goals')
            .insert({
                user_id: userId, goal_id: focusedGoalId, dialogue_history: [], attempts_for_current_goal_cycle: 0,
                status: 'active', progress: 0, initial_metric_baselines: initialBaselines
            })
            .select("dialogue_history, attempts_for_current_goal_cycle, status, initial_metric_baselines")
            .single();
        if (insertError) {
            console.error("Failed to create user_goals entry:", insertError);
            return NextResponse.json({ error: "Failed to initialize user goal data." }, { status: 500 });
        }
        // @ts-ignore // Supabase types might not reflect the select immediately
        userGoalData = newUserGoal;
    } else if (userGoalDbError) {
        console.error("Error fetching user_goals data:", userGoalDbError);
        return NextResponse.json({ error: "Failed to fetch user goal data." }, { status: 500 });
    }

    const dialogueHistory: DialogueEntry[] = userGoalData?.dialogue_history ?? [];
    // attempts_for_current_goal_cycle from DB is count of *completed* attempts for this goal cycle.
    // scenarioAttemptNumber is the current one being played (1-indexed).
    const completedAttemptsForCycle = userGoalData?.attempts_for_current_goal_cycle ?? 0;
    const scenarioAttemptNumber = completedAttemptsForCycle + 1;
    const initialMetricBaselines = userGoalData?.initial_metric_baselines || {};


    const previousGameState = getCurrentGameState(dialogueHistory);
    // currentDecisionCount is the number of decisions made *within the current scenario attempt*.
    // It resets to 0 when a new scenario attempt begins.
    // If dialogueHistory is for a new attempt (e.g., after completing one), this count should be 0.
    // We might need to clear dialogueHistory or segment it per attempt for this count to be accurate for the *current* scenario.
    // For now, let's assume dialogueHistory is for the current ongoing scenario.
    // If a new scenario is starting (chosenOptionId is null AND this is effectively attempt N, dp 0), we should ensure state is clean.
    let currentDecisionCount = previousGameState.decisionCount;
    if(chosenOptionId === null && completedAttemptsForCycle === (scenarioAttemptNumber -1) && previousGameState.decisionCount === 3) {
        // This implies the previous scenario was completed, and this is a fresh start for a new attempt number.
        // Reset currentDecisionCount if the dialogue history reflects a fully completed previous scenario.
        // This logic can be complex. A simpler way: when a scenario completes, the frontend starts "fresh" for the next one.
        // The number of "user choice" messages for *this current scenario attempt* is what currentDecisionCount represents.
        // For simplicity, we'll rely on the frontend to reset `decisionCount` state for a new scenario.
        // The `previousGameState.decisionCount` reflects choices in the *entire dialogue history for this goal*.
        // This needs a more robust way to track decisions *per scenario attempt*.
        // Quick Fix for now: if chosenOptionId is null and it's not the very first scenario of goal:
        // This means the previous scenario ended and we are starting a new one.
        // The `dialogueHistory` still contains old scenario. We need to clear it or segment it.
        // The `route.ts` should not manage this complex client-side state reset.
        // Let's assume the client sends chosenOptionId: null when it *truly* starts a new scenario.
        // Then, previousGameState.decisionCount *from the existing dialogueHistory* would be for the prior completed one.
        // So, if chosenOptionId is null, this is DP1, currentDecisionCount for AI prompt should be 0.
        if(chosenOptionId === null) {
            currentDecisionCount = 0; // For the AI prompt, if it's a new scenario start.
        }
    }


    console.log(`[/api/lessons] Goal: ${goalName}. Scenario Attempt Number: ${scenarioAttemptNumber}. Effective decisions made for this new/ongoing scenario: ${currentDecisionCount}`);

    const definitions = await getDefinitionsBundle();
    // const kcListForPrompt = definitions.kcs.map(kc => `- ${kc.kc_identifier}: ${kc.name} (${kc.description || 'General business skill'})`).join("\n");
    const { data: goalKcLinks, error: goalKcError } = await supabase
        .from('goal_kcs')
        .select('kc_id')
        .eq('goal_id', focusedGoalId);
    
    if (goalKcError){
        console.error("Error fetching goal-KC links:", goalKcError);
        return NextResponse.json({error: "Failed to fetch KCs for the current goal." }, {status: 500});
    }

    if (!goalKcLinks || goalKcLinks.length === 0) {
        console.warn(`No KCs found in the goals_kcs table for goal_id: ${focusedGoalId}. The AI prompt will have an empty KC list.`)
    }
    
    const relevantKcIds = new Set(goalKcLinks.map(link => link.kc_id));

    const filteredKcsForGoal = definitions.kcs.filter(kc => relevantKcIds.has(kc.id));

    const kcListForPrompt = filteredKcsForGoal.length > 0
        ? filteredKcsForGoal.map(kc => ` - ${kc.kc_identifier}: ${kc.name} (${kc.description || 'General business skill'})`).join("\n")
        : "No specific Knowledge Components are targeted for this goal.";

    console.log(" --- Loading KCs for goal id:", focusedGoalId, "into prompt ---");
    console.log(kcListForPrompt);
    console.log("----------------------------------------------------------------");

    let totalKcChangesForThisTurn: Array<{ kc_id: number, kc_identifier: string, change: number }> = [];
    if (chosenOptionId !== null && dialogueHistory.length > 0) {
        const lastAssistantResponseEntry = dialogueHistory.findLast((entry) => entry.role === 'assistant');
        if (lastAssistantResponseEntry) {
            try {
                const previousStepData = JSON.parse(lastAssistantResponseEntry.content);

                // CRITICAL CHANGE: Find the option by its stable ID, not its array index.
                const chosenOption = previousStepData.decisionPoint?.options?.find(
                    (opt: any) => opt.optionId === chosenOptionId
                );

                if (chosenOption?.kc_impacts?.length > 0) {
                    for (const impact of chosenOption.kc_impacts) {
                        const kc_id = definitions.kcIdentifierToIdMap.get(impact.kc_identifier);
                        if (kc_id) {
                            totalKcChangesForThisTurn.push({ kc_id, kc_identifier: impact.kc_identifier, change: impact.score });
                            const { error: kcScoreError } = await supabase.rpc('increment_user_kc_score', {
                                p_user_id: userId, p_kc_id: kc_id, p_increment_value: impact.score
                            });
                            if (kcScoreError) console.error(`Error RPC increment_user_kc_score for ${impact.kc_identifier}:`, kcScoreError);
                        } else console.warn(`KC ID for ${impact.kc_identifier} not found in map during KC impact processing.`);
                    }
                    console.log(`[/api/lessons] Processed KC impacts for option with ID ${chosenOptionId}:`, totalKcChangesForThisTurn);
                } else if (chosenOption) {
                    console.warn(`Chosen option with ID ${chosenOptionId} had no kc_impacts or kc_impacts array was empty.`);
                } else {
                    console.warn(`Could not find chosen option for chosenOptionId ${chosenOptionId} in previous step data.`);
                }
            } catch (e) { console.error("Error parsing previous AI response for KC impacts:", e); }
        }
    }

    let metricChangesSummary: Array<{ metricName: string, change: number, unit: string, finalValue: number }> = [];
    if (totalKcChangesForThisTurn.length > 0) {
        for (const kcChange of totalKcChangesForThisTurn) {
            const affectedMetricLinks = definitions.kcEffects.filter(link => link.kc_id === kcChange.kc_id);
            for (const link of affectedMetricLinks) {
                const metricDef = definitions.metrics.find(m => m.id === link.metric_id);
                if (!metricDef) continue;

                let rawMetricChange = 0; let unit = "";
                switch (metricDef.name) {
                    case 'Revenue': rawMetricChange = kcChange.change * 5750; unit = "₹"; break; // Increased impact
                    case 'Customer Satisfaction': rawMetricChange = kcChange.change * 6.5; unit = "%"; break;
                    case 'Reputation': rawMetricChange = kcChange.change * 0.28; unit = " stars"; break;
                    case 'Ethical Decision Making': rawMetricChange = kcChange.change * 9.5; unit = "%"; break; // Slightly higher impact
                    case 'Risk-Taking': rawMetricChange = kcChange.change * 9.5; unit = "%"; break;
                    default: rawMetricChange = kcChange.change * 2; unit = "%";
                }

                const { data: metricScoreRow, error: fetchError } = await supabase.from('user_metric_scores').select('current_value').eq('user_id', userId).eq('metric_id', metricDef.id).single();
                let currentMetricValue = metricDef.initial_value; // Fallback to default initial_value
                if (fetchError && fetchError.code !== 'PGRST116') console.error(`Error fetching metric ${metricDef.name}:`, fetchError);
                if (metricScoreRow) currentMetricValue = parseFloat(metricScoreRow.current_value as any);
                
                let newMetricValue = currentMetricValue + rawMetricChange;
                if (metricDef.min_value !== null) newMetricValue = Math.max(Number(metricDef.min_value), newMetricValue);
                if (metricDef.max_value !== null) newMetricValue = Math.min(Number(metricDef.max_value), newMetricValue);
                const actualChangeApplied = parseFloat((newMetricValue - currentMetricValue).toFixed(2)); // Round to 2 decimal places

                const { error: updateMetricError } = await supabase.from('user_metric_scores').upsert({
                    user_id: userId, metric_id: metricDef.id, current_value: newMetricValue, last_updated_at: new Date().toISOString()
                }, { onConflict: 'user_id, metric_id' });

                if (updateMetricError) console.error(`Error updating metric ${metricDef.name}:`, updateMetricError);
                else {
                    console.log(`[/api/lessons] Metric ${metricDef.name} ${currentMetricValue} -> ${newMetricValue} (Change: ${actualChangeApplied}) for KC ${kcChange.kc_identifier}`);
                    const existingSummary = metricChangesSummary.find(s => s.metricName === metricDef.name);
                    if (existingSummary) {
                        existingSummary.change = parseFloat((existingSummary.change + actualChangeApplied).toFixed(2));
                        existingSummary.finalValue = newMetricValue;
                    } else {
                        metricChangesSummary.push({ metricName: metricDef.name, change: actualChangeApplied, unit, finalValue: newMetricValue });
                    }
                }
            }
        }
    }


    // --- Build the dynamic system prompt ---
    // The system prompt needs to adapt based on whether it's a new scenario or continuation
    let systemPrompt = `You are a scenario generator for an educational game that teaches entrepreneurial skills to high-school students from rural India. The gameplay uses real-life decisions in a drone leasing venture to teach foundational business concepts.
Player: "${userName}".
Current Learning Goal: "${goalName}". Goal Description: "${goalDescription}". Win Conditions: "${textualWinConditions}".
This is Scenario Attempt number ${scenarioAttemptNumber} for this goal (out of 3 attempts, each with a unique narrative).

Available Knowledge Components (KCs) for you to reference and assign scores to:
${kcListForPrompt}

Scenario Structure:
A full scenario consists of an initial narrative, followed by 3 decision points, and a concluding narrative.
- Start of Scenario (0 decisions made): Generate \`scenarioContextNarrative\`, \`scenarioKCsOverall\`, initial \`narrativeSteps\`, and the FIRST \`decisionPoint\`. \`scenarioComplete\` is false.
- Mid-Scenario (1 or 2 decisions made): Generate follow-up \`narrativeSteps\` based on the last choice, and the NEXT \`decisionPoint\`. \`scenarioContextNarrative\` & \`scenarioKCsOverall\` should be omitted or very brief reminders, as they were set at the start. \`scenarioComplete\` is false.
- End of Scenario (3 decisions made): Generate FINAL \`narrativeSteps\` concluding the story. \`decisionPoint\` MUST be null. \`scenarioComplete\` is true. \`scenarioContextNarrative\` & \`scenarioKCsOverall\` are omitted.

Current State for this Scenario Attempt:
- Decisions successfully made by user so far in THIS scenario: ${currentDecisionCount}
${previousGameState.lastDecisionIndex !== null ? `- User's previous decision index choice: ${previousGameState.lastDecisionIndex}` : ''}
${chosenOptionId !== null ? `- User has JUST chosen decision option index: ${chosenOptionId} for the decision point that was presented.` : (currentDecisionCount === 0 ? '- User is starting this new scenario attempt.' : '- User is continuing the scenario.')}

Your Task: Generate the JSON for the *next* step of the scenario. Adhere STRICTLY to the provided JSON schema.

Detailed Instructions:
1.  Narrative & Dialogue:
    *   \`scenarioContextNarrative\`: Generate a compelling, unique overarching story for this scenario attempt number ${scenarioAttemptNumber} ONLY IF \`currentDecisionCount\` is 0. Keep it to 2-4 sentences. For subsequent steps, make it very brief (e.g., "Continuing from your choice...") or an empty string if covered by \`narrativeSteps\`.
    *   \`narrativeSteps\`: Provide engaging dialogue. Characters should react realistically to prior choices if applicable. Use the provided character list (Rani, Ali, Santosh, Manju, Rajesh, Narrator). Ensure pfp paths are correct (e.g., /game/character_pfp/rani.png).
    *   \`mainCharacterImage\`: Use full paths (e.g., /game/characters/ali.png) or null.
2.  KCs:
    *   \`scenarioKCsOverall\`: IF \`currentDecisionCount\` is 0, select 1-3 KC identifiers from the list that this entire scenario attempt will focus on. Otherwise,  MUST be an empty array \`[]\`.
    *   \`decisionPointKCsFocused\`: For each \`decisionPoint\`, select 1-3 relevant KC identifiers.
    *   \`kc_impacts\` (within each option): Assign 1-3 KCs. Scores must be floating point numbers that range between -1.0 and 1.0. A score of 0 represents no change. Positive scores are good for the KC, while negative scores are detrimental. The options are REQUIRED to have a diversity of positive and negative values. Specifically, two options will represent a "trade-off" with one KC score with a positive value and one negative value (+,-) in the complete -1 to 1 range should be voltile, one option will have two KC score negative values (-,-) in the 0 to -0.6 range, and finally one will have two positive values (+,+) it the 0 to 0.6 range. 
3.  Decision Points & Options:
    *   If \`currentDecisionCount\` < 3, a \`decisionPoint\` object is required.
    *   If \`currentDecisionCount\` == 3, \`decisionPoint\` MUST be null, and \`scenarioComplete\` MUST be true.
    *   Each \`decisionPoint\` must have a \`question\` and exactly 4 \`options\`. Each option needs \`text\` and \`kc_impacts\`.
    * Basically 
    *   \`decisionPoint\`:
        - IF \`currentDecisionCount\` is 0, generate the 1st DP.
        - IF \`currentDecisionCount\` is 1, generate the 2nd DP.
        - IF \`currentDecisionCount\` is 2, generate the 3rd DP.
        - IF \`currentDecisionCount\` is 3, \`decisionPoint\` MUST be null, \`scenarioComplete\` MUST be true.
4.  Schema Adherence: Output MUST be a single, valid JSON object matching the schema. All required fields must be present.

Character PFP and Image Paths:
- Rani: pfp=/game/character_pfp/rani.png, image=/game/characters/rani.png
- Ali: pfp=/game/character_pfp/ali.png, image=/game/characters/ali.png
- Santosh: pfp=/game/character_pfp/santosh.png, image=/game/characters/santosh.png
- Manju: pfp=/game/character_pfp/manju.png, image=/game/characters/manju.png
- Rajesh: pfp=/game/character_pfp/rajesh.png, image=/game/characters/rajesh.png
- Narrator: pfp=/game/character_pfp/narrator.png image=null

Scenario Characters:
- Rani: She is a successful Entrepreneur who is always willing to provide help and guidance. Her persona is exuberant, encouraging, and quick to offer both positive affirmation and constructive feedback.
- Ali: He is a partner to the player. He is the entrepreneurial vendor who introduces advanced drone technology and leasing models. He also provides the hardware for missions, tasks, and challenges in the game.
- Santosh: He is a customer and farmer by profession. He also voices the other customers' feedback and needs on their behalf. His persona is that of a wise elder and community figure with a strong sense of ethics and social responsibility. 
- Manju: She is an official from a government-backed program that incentivizes agritech innovations—particularly drone leasing. Her role is to acts as a resource for subsidies, grants, or low-interest loans to support entrepreneurs who meet certain criteria (e.g., community impact, sustainable practices).
- Rajesh: He is a fierce rival, representing the typical real-world competitor. His role is to encourage healthy competition.
- Narrator: AFTER the user has made a decision. The Narrator will provide the definitions of difficult words that were in that decision point.


`;

    // Conditional prompt adjustment for first step vs. continuation
    if (currentDecisionCount === 0 && chosenOptionId === null) {
        systemPrompt += "\nTask: Generate the initial context, overall KCs, narrative, and the 1st decision point.";
    } else if (chosenOptionId !== null) {
        const lastAssistantResponseEntry = dialogueHistory.findLast((entry) => entry.role === 'assistant');
        let chosenOptionText = '';
        if (lastAssistantResponseEntry) {
            try {
                const previousStepData = JSON.parse(lastAssistantResponseEntry.content);
                const chosenOption = previousStepData.decisionPoint?.options?.find(
                    (opt: any) => opt.optionId === chosenOptionId
                );
                if (chosenOption) {
                    chosenOptionText = `: "${chosenOption.text}"`;
                }
            } catch (e) { console.error("Error parsing previous AI response for chosen option text:", e); }
        }

        if (currentDecisionCount < 2) { // User made 1st (count=0) or 2nd (count=1) choice. AI generates DP2 or DP3.
            systemPrompt += `\nTask: User chose option index ${chosenOptionId}${chosenOptionText} for their ${currentDecisionCount + 1}st/nd decision. Generate narrative consequences and the NEXT decision point. \`scenarioKCsOverall\` must be [].`;
        } else if (currentDecisionCount === 2) { // User made 3rd choice (count=2). AI concludes.
            systemPrompt += `\nTask: User chose option index ${chosenOptionId}${chosenOptionText} for their THIRD decision. Generate concluding narrative. \`decisionPoint\` = null, \`scenarioComplete\` = true. \`scenarioKCsOverall\` must be [].`;
        }
    } else if (currentDecisionCount === 3 && chosenOptionId === null) {
        // This case might occur if page reloads after 3rd decision but before summary. AI should provide conclusion.
        systemPrompt += `\nTask: User has completed 3 decisions. Generate concluding narrative. \`decisionPoint\` = null, \`scenarioComplete\` = true. \`scenarioKCsOverall\` must be [].`;
    }


    const messagesForOpenAI = [{ role: "system", content: systemPrompt.trim() }];
    // Give some history, but not too much to confuse the current state context for AI.
    const relevantHistory = dialogueHistory.slice(-4); // Last 2 user actions and 2 AI responses
    messagesForOpenAI.push(...relevantHistory);

    if (chosenOptionId !== null) {
        const lastAssistantResponseEntry = dialogueHistory.findLast((entry) => entry.role === 'assistant');
        let chosenOptionText = '';
        if (lastAssistantResponseEntry) {
            try {
                const previousStepData = JSON.parse(lastAssistantResponseEntry.content);
                const chosenOption = previousStepData.decisionPoint?.options?.find(
                    (opt: any) => opt.optionId === chosenOptionId
                );
                if (chosenOption) {
                    chosenOptionText = `: "${chosenOption.text}"`;
                }
            } catch (e) { console.error("Error parsing previous AI response for chosen option text:", e); }
        }
        messagesForOpenAI.push({ role: "user", content: `I chose decision option index: ${chosenOptionId}${chosenOptionText}. Based on the Current State (${currentDecisionCount} decisions made before this choice), what happens next?` });
    } else if (currentDecisionCount === 0) {
        messagesForOpenAI.push({ role: "user", content: "Start this new scenario attempt." });
    } else if (currentDecisionCount >= 3) { // Should generate conclusion
        messagesForOpenAI.push({ role: "user", content: "Provide the conclusion for this scenario as I've made 3 decisions." });
    }
    
    console.log("[/api/lessons] Messages for OpenAI =>", JSON.stringify(messagesForOpenAI, null, 2));

    const payload = {
      model: "gpt-4o-2024-08-06", // Ensure you use a model supporting json_schema output
      messages: messagesForOpenAI,
      response_format: {
        type: "json_schema",
        json_schema: { name: "game_step_generation", description: "Generates a step in the game scenario, including narrative, KCs, and decision points.", schema: gameStepSchemaForAI, strict: true }
      },
      temperature: 0.7,
    };

    console.log("[/api/lessons] Calling OpenAI API... (with up to 3 retry attempts)");
    const response = await fetchWithRetry(
        "https://api.openai.com/v1/chat/completions", 
        { 
            method: "POST", 
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, 
            body: JSON.stringify(payload) 
        },
        3 // Max number of retries
    );

    if (!response.ok) {
        const errorText = await response.text();
        console.error("[/api/lessons] OpenAI error response:", response.status, errorText);
        return NextResponse.json({ error: `OpenAI API Error: ${response.statusText} - ${errorText}` }, { status: response.status });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
        console.error("[/api/lessons] No content in OpenAI response:", data);
        return NextResponse.json({ error: "No content returned from AI model." }, { status: 500 });
    }

    let parsedScenarioStep;
    try {
      parsedScenarioStep = JSON.parse(content);
    } catch (err) {
      console.error("[/api/lessons] Failed to parse JSON from AI:", content, err);
      return NextResponse.json({ error: "Could not parse valid JSON from AI.", raw_content: content }, { status: 500 });
    }

    // If the AI generated a decision point with options, add a stable ID to each
    // option BEFORE shuffling them. This ID is the option's original index.
    if (parsedScenarioStep?.decisionPoint?.options) {
        parsedScenarioStep.decisionPoint.options.forEach((option: any, index: number) => {
            option.optionId = index; // Add the stable ID
        });

        // Now, shuffle the array of options that have the stable ID.
        shuffleArray(parsedScenarioStep.decisionPoint.options);
        console.log("[/api/lessons] Successfully added IDs and randomized the order of decision point options.");
    }
    
    // This console.log will now show the shuffled options with their `optionId`
    console.log("[/api/lessons] Parsed Scenario Step from AI =>", JSON.stringify(parsedScenarioStep, null, 2));

    // Log Revenue to history after this turns decision
    if (chosenOptionId !== null) { // Only log if a decision was actually processed this turn
        const revenueMetricDef = definitions.metrics.find(m => m.name === 'Revenue');
        if (revenueMetricDef) {
            const revenueSummary = metricChangesSummary.find(s => s.metricName === 'Revenue');
            if (revenueSummary) {
                // currentDecisionCount is the count of decisions made *before* this current one.
                // So, the decision number for the history entry is currentDecisionCount + 1.
                const decisionNumberForHistoryLog = currentDecisionCount + 1;
    
                // Ensure it's a valid decision number (1, 2, or 3)
                if (decisionNumberForHistoryLog >= 1 && decisionNumberForHistoryLog <= 3) {
                    console.log(`[HistoryLogging] Logging revenue for SAttempt: ${scenarioAttemptNumber}, DecisionNo: ${decisionNumberForHistoryLog}, Value: ${revenueSummary.finalValue}`);
                    await supabase.from('user_metric_history').insert({
                        user_id: userId,
                        goal_id: focusedGoalId,
                        metric_id: revenueMetricDef.id,
                        scenario_attempt_number: scenarioAttemptNumber,
                        decision_number: decisionNumberForHistoryLog,
                        value: revenueSummary.finalValue,
                        recorded_at: new Date().toISOString()
                    });
                } else {
                    console.warn(`[HistoryLogging] Attempted to log with invalid decisionNumber: ${decisionNumberForHistoryLog}`);
                }
            }
        }
    }


    // --- Storing the generated scenario into new DB structure ---
    // This is a complex part. We need to handle new scenario creation vs. new decision point for an existing scenario.
    // For simplicity, let's assume each call to /api/lessons *could* generate a full scenario structure,
    // but the frontend will only display parts of it. The `dialogue_history` in `user_goals` will store the AI's raw JSON output.
    // The actual saving of granular scenario parts (scenarios, decision_points, options, kc_effects) to their dedicated tables
    // should happen when a scenario is *first* generated for an attempt.

    // If it's the start of a new scenario (currentDecisionCount === 0 and chosenOptionId is null)
    // then we save the main scenario shell and its associated KCs.
    // Decision points and options are saved as they are generated.

    // For now, just update dialogue_history and progress. Granular saving is a larger task.
    const newDialogueHistoryEntry: DialogueEntry = { 
        role: "assistant", 
        content: JSON.stringify(parsedScenarioStep) 
    };
    
    const updatedDialogueHistory = [...dialogueHistory];
    if (chosenOptionId !== null) {
        const lastAssistantResponseEntry = dialogueHistory.findLast((entry) => entry.role === 'assistant');
        let chosenOptionText = '';
        if (lastAssistantResponseEntry) {
            try {
                // This logic is now correct because the history will contain the modified data
                const previousStepData = JSON.parse(lastAssistantResponseEntry.content);
                const chosenOption = previousStepData.decisionPoint?.options?.find(
                    (opt: any) => opt.optionId === chosenOptionId
                );
                if (chosenOption) {
                    chosenOptionText = `: "${chosenOption.text}"`;
                }
            } catch (e) { console.error("Error parsing previous AI response for chosen option text:", e); }
        }
        updatedDialogueHistory.push({ role: "user", content: `User chose decision index: ${chosenOptionId}${chosenOptionText}` });
    }
    updatedDialogueHistory.push(newDialogueHistoryEntry);

    // Goal Progress & Status
    let goalProgressValue = 0;
    let goalStatus = userGoalData?.status || 'active';
    let scenarioJustCompleted = parsedScenarioStep.scenarioComplete;
    let updatedCompletedAttemptsForCycle = completedAttemptsForCycle;

    if (scenarioJustCompleted) {
        updatedCompletedAttemptsForCycle++;
        // If a scenario completes, and it's the start of a new attempt cycle for this goal,
        // we might need to reset/snapshot initial_metric_baselines for "increase" type goals.
        // This logic is deferred for now.
    }

    const { data: allCurrentUserMetricScoresData } = await supabase
        .from('user_metric_scores')
        .select('metrics(name), current_value')
        .eq('user_id', userId) as { data: MetricScore[] | null };
    const currentUserMetrics = new Map(allCurrentUserMetricScoresData?.map(m => [m.metrics.name, parseFloat(m.current_value as any)]));
    console.log("[/api/lessons] Current User Metrics for Win Condition Check:", Object.fromEntries(currentUserMetrics));

    let goalAchieved = false;
    if (goalWinConditionsStructured && Array.isArray(goalWinConditionsStructured)) {
        const conditions = goalWinConditionsStructured as WinConditionItem[];
        let allConditionsMet = true;
        let conditionsProgressParts = conditions.map(() => 0);

        for (let i = 0; i < conditions.length; i++) {
            const condition = conditions[i];
            let effectiveCurrentValue = currentUserMetrics.get(condition.metric_name) ?? 0;
            const targetValueOrDelta = condition.value;
            let conditionMet = false;
            let valueToCompare = effectiveCurrentValue; // This will be the value checked against targetValueOrDelta


            if (condition.type === "change_from_baseline") {
                const baseline = Number(initialMetricBaselines[condition.metric_name] || 0);
                valueToCompare = effectiveCurrentValue - baseline; // This is the actual change from baseline
                console.log(`[WinCheck-ChangeBaseline] Metric: ${condition.metric_name}, CurrentRaw: ${effectiveCurrentValue}, Baseline: ${baseline}, ActualChange: ${valueToCompare}, TargetChangeOrDelta: ${targetValueOrDelta}`);
            } else { // "absolute" type (or type omitted)
                valueToCompare = effectiveCurrentValue;
                console.log(`[WinCheck-Absolute] Metric: ${condition.metric_name}, CurrentValue: ${valueToCompare}, TargetValue: ${targetValueOrDelta}`);
            }

            // Common operator check using valueToCompare and targetValueOrDelta
            if (condition.operator === ">=") conditionMet = valueToCompare >= targetValueOrDelta;
            else if (condition.operator === "<=") conditionMet = valueToCompare <= targetValueOrDelta;
            else if (condition.operator === ">") conditionMet = valueToCompare > targetValueOrDelta;
            else if (condition.operator === "<") conditionMet = valueToCompare < targetValueOrDelta;
            else if (condition.operator === "==" || condition.operator === "=") conditionMet = valueToCompare === targetValueOrDelta;
            
            if (!conditionMet) allConditionsMet = false;


            // Progress calculation:
            // Simplified: if condition is met, full progress part. If not, for positive target deltas/values, proportional. Else 0.
            let conditionProgressRatio = 0.0; // Represents progress for this condition, from 0.0 to 1.0

            if (conditionMet) {
                conditionProgressRatio = 1.0;
            } else {
                // Calculate partial progress only if not met and applicable
                // Applicable for "positive target and current is positive but less" scenarios
                if (targetValueOrDelta > 0 && valueToCompare > 0 && 
                    (condition.operator.includes(">") || condition.operator.includes("="))) {
                    conditionProgressRatio = valueToCompare / targetValueOrDelta;
                }
                // For other "not met" cases (e.g., target is 0 or negative, or operator is '<'), partial progress is 0.
            }
            conditionProgressRatio = Math.max(0, Math.min(1, conditionProgressRatio)); // Clamp to [0,1]
            conditionsProgressParts[i] = conditionProgressRatio * (100 / conditions.length);

            console.log(`[WinCheckDetails] Metric: ${condition.metric_name}, Type: ${condition.type || 'absolute'}, ValueToCompare: ${valueToCompare.toFixed(2)}, Op: ${condition.operator}, Target: ${targetValueOrDelta.toFixed(2)}, Met: ${conditionMet}, ProgressPartRaw: ${conditionProgressRatio.toFixed(2)}, FinalProgressContr: ${conditionsProgressParts[i].toFixed(2)}`);
        }
        goalAchieved = allConditionsMet;
        goalProgressValue = Math.round(conditionsProgressParts.reduce((sum, p) => sum + p, 0));
    } else {
        console.warn("No structured win conditions found for this goal. Using fallback progress.");
        const decisionsMadeThisScenario = currentDecisionCount + (chosenOptionId !== null ? 1:0);
        goalProgressValue = Math.min(95, Math.round((decisionsMadeThisScenario / 3) * 90) + 5);
    }

    if (goalAchieved) {
        goalStatus = 'completed';
        goalProgressValue = 100;
        console.log(`[/api/lessons] Goal "${goalName}" ACHIEVED by user ${userId}!`);
    } else if (scenarioJustCompleted && updatedCompletedAttemptsForCycle >= 3) {
        goalStatus = 'failed_needs_retry';
        console.log(`[/api/lessons] Goal "${goalName}" NOT achieved after ${updatedCompletedAttemptsForCycle} attempts. Status: ${goalStatus}`);
    } else if (scenarioJustCompleted) {
        console.log(`[/api/lessons] Scenario attempt ${updatedCompletedAttemptsForCycle} for goal "${goalName}" completed. Goal not yet achieved.`);
    }
    goalProgressValue = Math.min(100, Math.max(0, goalProgressValue));

    // When a new scenario starts (chosenOptionId is null AND it's not the very first decision ever for this goal-user combo)
    // AND it's a new attempt number, we should reset the dialogue history for THIS goal attempt in user_goals.
    // This prevents the AI from getting confused by a very long history spanning multiple full scenarios.
    let finalDialogueHistoryForDB = updatedDialogueHistory;
    if (chosenOptionId === null && scenarioAttemptNumber > completedAttemptsForCycle && completedAttemptsForCycle > 0) { // Starting a genuinely new attempt after a previous one
      console.log(`[/api/lessons] Starting new scenario attempt ${scenarioAttemptNumber}. Clearing dialogue history for this attempt.`);
      finalDialogueHistoryForDB = [newDialogueHistoryEntry]; // Start fresh with only the AI's first message of new scenario
      console.log(`[/api/lessons] initial_metric_baselines (which is now our goal cycle baseline) will NOT be updated for this new scenario attempt.`);
      // Fetch current Revenue to record as the start of this new scenario attempt
        // const revenueMetricDefForNewAttempt = definitions.metrics.find(m => m.name === 'Revenue');
        // if (revenueMetricDefForNewAttempt) {
        //     const { data: currentRevenueScore } = await supabase
        //         .from('user_metric_scores')
        //         .select('current_value')
        //         .eq('user_id', userId)
        //         .eq('metric_id', revenueMetricDefForNewAttempt.id)
        //         .single();
            
        //     if (currentRevenueScore) {
        //         await supabase.from('user_metric_history').insert({
        //             user_id: userId,
        //             goal_id: focusedGoalId,
        //             metric_id: revenueMetricDefForNewAttempt.id,
        //             scenario_attempt_number: scenarioAttemptNumber, // The new attempt number
        //             decision_number: 0,                            // State before decisions in this new attempt
        //             value: parseFloat(currentRevenueScore.current_value as any),
        //             recorded_at: new Date().toISOString()
        //         });
        //     }
        // }
    }
      
      // Also, re-snapshot baselines if there are "increase" type goals.
    //   const { data: currentMetricsForNewBaseline } = await supabase
    //         .from('user_metric_scores')
    //         .select('metric_id, current_value')
    //         .eq('user_id', userId);
        
    //   const newInitialBaselines: {[key: string]: number} = {};
    //   await Promise.all((currentMetricsForNewBaseline || []).map(async m => {
    //     const metricDef = definitions.metrics.find(md => md.id === m.metric_id); 
    //     if(metricDef) newInitialBaselines[metricDef.name] = Number(m.current_value);
    //   }));
    //   // Update userGoalData with new baselines
    //   if (userGoalData) {
    //       userGoalData.initial_metric_baselines = newInitialBaselines;
    //       console.log(`[/api/lessons] Updated initial_metric_baselines for new attempt:`, newInitialBaselines);
    //   }
    // }


    const { error: upsertError } = await supabase.from("user_goals").upsert({
        user_id: userId, goal_id: focusedGoalId, dialogue_history: finalDialogueHistoryForDB,
        progress: goalProgressValue, status: goalStatus,
        attempts_for_current_goal_cycle: updatedCompletedAttemptsForCycle,
        initial_metric_baselines: userGoalData?.initial_metric_baselines || {}, // Persist potentially updated baselines
        updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,goal_id" });

    if (upsertError) console.error("Error upserting user_goals:", upsertError);

    // The number of decisions effectively made in the scenario that just got a response
    const decisionsEffectivelyMadeThisScenario = currentDecisionCount + (parsedScenarioStep.decisionPoint && chosenOptionId !== null ? 1 : (chosenOptionId === null && parsedScenarioStep.decisionPoint ? 0 : (chosenOptionId !== null && !parsedScenarioStep.decisionPoint ? 1 : 0) ) );

    // This block runs only when a user has made a decision in this turn.
    if (chosenOptionId !== null) {
        try {
            // 1. Get data about the decision the user was presented with ("the cause")
            const lastAssistantResponseEntry = dialogueHistory.findLast((entry) => entry.role === 'assistant');
            let decision_point_question: string | null = null;
            let options_presented: any[] | null = null;
            let chosen_option_text: string | null = null;
            let kc_impacts_of_choice: any[] | null = null;

            if (lastAssistantResponseEntry) {
                const previousStepData = JSON.parse(lastAssistantResponseEntry.content);
                if (previousStepData.decisionPoint) {
                    decision_point_question = previousStepData.decisionPoint.question;
                    options_presented = previousStepData.decisionPoint.options;
                    const chosenOption = previousStepData.decisionPoint.options.find(
                        (opt: any) => opt.optionId === chosenOptionId
                    );
                    if (chosenOption) {
                        chosen_option_text = chosenOption.text;
                        kc_impacts_of_choice = chosenOption.kc_impacts;
                    }
                }
            }

            // 2. Get data about the state of the game AFTER the decision ("the effect")
            const decisionNumberForLog = currentDecisionCount + 1;

            // Fetch final KC scores after this turn's updates
            const { data: finalKCScoresData, error: kcsFetchError } = await supabase
                .from('user_kc_scores')
                .select('kcs(kc_identifier), current_score')
                .eq('user_id', userId);

            if (kcsFetchError) throw new Error(`Failed to fetch final KC scores: ${kcsFetchError.message}`);

            const kc_scores_after_decision = finalKCScoresData?.reduce((acc, score) => {
                const kcs_data = score.kcs as unknown as { kc_identifier: string } | null; 
                if (kcs_data?.kc_identifier) {
                    acc[kcs_data.kc_identifier] = score.current_score;
                }
                return acc;
            }, {} as Record<string, number>) || {};

            // Reuse metric scores already fetched for the win condition check
            const metric_values_after_decision = Object.fromEntries(currentUserMetrics) || {};

            // 3. Construct and insert the complete historical record
            const analyticsRecord = {
                user_id: userId,
                goal_id: focusedGoalId,
                scenario_attempt_number: scenarioAttemptNumber,
                decision_number: decisionNumberForLog,
                decision_point_question,
                options_presented,
                chosen_option_index: chosenOptionId,
                chosen_option_text,
                kc_impacts_of_choice,
                kc_scores_after_decision,
                metric_values_after_decision,
                generated_narrative_steps: parsedScenarioStep.narrativeSteps,
                scenario_completed_on_this_turn: parsedScenarioStep.scenarioComplete,
            };

            const { error: logError } = await supabase
                .from('historical_learning_analytics')
                .insert(analyticsRecord);

            if (logError) {
                // This is a non-blocking error. We log it but don't fail the API call.
                console.error("[/api/lessons] CRITICAL: Failed to log to historical_learning_analytics:", logError);
            } else {
                console.log(`[/api/lessons] Successfully logged decision ${decisionNumberForLog} of attempt ${scenarioAttemptNumber} to historical_learning_analytics.`);
            }

        } catch (logErr: any) {
            console.error("[/api/lessons] Error during historical_learning_analytics logging:", logErr.message, logErr.stack);
        }
    }
    
    return NextResponse.json({
        scenarioStep: parsedScenarioStep,
        scenarioAttemptNumber: scenarioAttemptNumber, // The attempt number that was just played/started
        metricChangesSummary: metricChangesSummary,
        goalStatusAfterStep: goalStatus,
        currentGoalProgress: goalProgressValue,
        // This should reflect the number of decisions made IN THE SCENARIO that the AI just responded FOR.
        // If AI returned DP2, it means 1 decision was made. If AI returned conclusion, 3 decisions were made.
        currentDecisionCountInScenario: parsedScenarioStep.scenarioComplete ? 3 : decisionsEffectivelyMadeThisScenario
    });

  } catch (err: any) {
    console.error("[/api/lessons] Unhandled Route error =>", err, err.stack);
    return NextResponse.json({ error: err.message || "An internal server error occurred." }, { status: 500 });
  }
}
    
    // --- TODO: More granular saving logic ---
    // This is where you'd parse `parsedScenarioStep` and save to `scenarios`, `decision_points`, `options`, `option_kc_effects` etc.
    // This would typically happen:
    // 1. When a new scenario `scenarioContextNarrative` is generated (currentDecisionCount == 0):
    //    - Create a new row in `scenarios` table.
    //    - Link `scenarioKCsOverall` to `scenario_targeted_kcs`.
    // 2. When a `decisionPoint` is generated:
    //    - Create a new row in `decision_points` linked to the current scenario.
    //    - Link `decisionPointKCsFocused` to `decision_point_focused_kcs`.
    //    - For each option in `decisionPoint.options`:
    //        - Create a row in `options`.
    //        - For each `kc_impact` in the option:
    //            - Create a row in `option_kc_effects`.
    // This requires careful management of scenario IDs and potentially passing the current `scenario.id` if continuing.
    // For now, the response is sent back, and the game page consumes it. The `dialogue_history` holds the full AI output.

    // Saving Granular Scenario Data (The BIG TODO):
    // When currentDecisionCount === 0 (new scenario starts):
    // Take parsedScenarioStep.scenarioContextNarrative and insert a new row into your scenarios table, linking it to goal_id and the current scenarioAttemptNumber. Get the new scenario.id.
    // For each KC in parsedScenarioStep.scenarioKCsOverall, insert into scenario_targeted_kcs using the new scenario.id.
    // Whenever a decisionPoint is generated:
    // Insert into decision_points table, linking to the current scenario.id and decision_order. Get the new decision_point.id.
    // For KCs in decisionPointKCsFocused, insert into decision_point_focused_kcs.
    // For each option in options:
    // Insert into options table, linking to decision_point.id. Get option.id.
    // For each kc_impact, insert into option_kc_effects linking to option.id.
    // This requires passing the current active_scenario_id (from your scenarios table) back and forth or fetching it based on user_id, goal_id, and scenarioAttemptNumber. This is a significant piece of backend logic.