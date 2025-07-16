# API Documentation (`app/api/README.md`)

This document provides an in-depth explanation of the API routes that power the Udyam Path application, with a primary focus on the core game engine located at `lessons/route.ts`.

## 1. Overview

The API routes in this directory are the backend brain of the application. They handle all stateful logic, database interactions, and communication with the OpenAI service.

The most important endpoint is `POST /api/lessons`, which drives the entire interactive narrative and learning experience.

---

## 2. The Game Engine: `lessons/route.ts`

This route is responsible for generating game scenarios, processing user decisions, updating player scores, and determining game state. It functions as a turn-based engine that consumes the user's previous action and produces the next state of the world.

### Core Concepts

*   **State Management:** The game is stateful, with all user progress, scores, and history persisted in the **Supabase** database. This API route reads the current state at the beginning of each call and writes the new state at the end.
*   **AI-Powered Scenario Generation:** The narrative, dialogue, and decision points are not pre-written. They are generated in real-time by the **OpenAI GPT-4o model**. This ensures a dynamic and unique experience for each playthrough.
*   **Structured AI Output:** To maintain game logic, the AI is constrained to respond in a specific JSON format defined by the `gameStepSchemaForAI` object. This allows the application to reliably parse the AI's response and use it in the game.
*   **KC & Metric System:** The learning model is based on:
    *   **Knowledge Components (KCs):** Granular skills (e.g., 'KC1: Financial Literacy').
    *   **Metrics:** Quantifiable game stats (e.g., 'Revenue', 'Reputation').
    User choices impact KCs, and KC changes, in turn, impact Metrics.

### Execution Flow: A Step-by-Step Breakdown

When the frontend makes a `POST` request to `/api/lessons`, the following sequence of events occurs:

#### **Step 1: Initialization & Request Validation**

1.  The request body is parsed to get the `userId` and the `chosenOptionId`.
2.  `chosenOptionId` is a number (e.g., `0`, `1`, `2`, `3`) if the user just made a choice, or `null` if this is the start of a new scenario.
3.  The `OPENAI_API_KEY` and `userId` are validated to ensure the request is authorized and can proceed.

#### **Step 2: Fetching Current Game State**

1.  The API queries the `users` table to get the player's `name` and their `focused_goal_id`.
2.  It then fetches the details of that `goal`, including its `win_conditions_structured`.
3.  Crucially, it retrieves the `user_goals` entry, which contains the `dialogue_history` and the number of `attempts_for_current_goal_cycle`.
4.  **First-Time Goal Attempt:** If a `user_goals` entry doesn't exist for this user and goal, the API creates one, taking a "snapshot" of the user's current metric scores to establish a `initial_metric_baselines`. This is vital for goals like "Increase Revenue by 20%".

#### **Step 3: Processing the Previous Turn's Decision**

*This step only runs if `chosenOptionId` is not `null`.*

1.  The API finds the last message from the 'assistant' (the AI) in the `dialogue_history`. This message contains the `decisionPoint` the user just interacted with.
2.  It parses the JSON content of that message to find the specific option the user chose via its stable `optionId`.
3.  It extracts the `kc_impacts` array from that chosen option (e.g., `[{ kc_identifier: 'KC1', score: 0.5 }, { kc_identifier: 'KC4', score: -0.2 }]`).
4.  For each impact, it calls the Supabase RPC `increment_user_kc_score`, which transactionally updates the user's score for that specific KC in the `user_kc_scores` table.

#### **Step 4: Calculating Metric Impact**

*This step also runs only if a decision was made.*

1.  The API uses the KC changes calculated in the previous step as a starting point.
2.  It looks up the `kc_metric_effects` table to see which game metrics are affected by the changed KCs.
3.  It applies a hardcoded multiplier to translate the KC score change into a metric value change (e.g., a `+0.5` score in a "Revenue" related KC might translate to `+₹2875`).
4.  The new metric value is calculated, clamped to its defined `min_value`/`max_value`, and saved to the `user_metric_scores` table.

#### **Step 5: Building the Dynamic OpenAI Prompt**

This is the heart of the AI interaction. A large, detailed `systemPrompt` is constructed.

1.  **Context:** It provides the AI with the user's name, their current goal, and the narrative rules of the game.
2.  **State:** It explicitly tells the AI how many decisions have been made in the current scenario (`currentDecisionCount`) and which option was just chosen.
3.  **Knowledge:** It lists all available KCs for the current goal, telling the AI which tools it has to build the decision impacts.
4.  **Instructions:** It gives the AI very strict instructions on its task (e.g., "If 0 decisions have been made, generate the first decision point. If 3 have been made, set `scenarioComplete` to true and `decisionPoint` to null.").
5.  **Character Personas:** It provides descriptions of each character to guide the AI in generating appropriate dialogue.

#### **Step 6: Calling the OpenAI API**

1.  The API uses the `fetchWithRetry` helper function, which automatically retries the API call up to 3 times with exponential backoff if a server-side error (5xx) occurs. This adds robustness against transient network issues.
2.  The `response_format` is set to `json_schema`, forcing OpenAI to return a response that strictly adheres to the structure of `gameStepSchemaForAI`.

#### **Step 7: Processing the AI's Response**

1.  The JSON response from OpenAI is parsed into the `parsedScenarioStep` object.
2.  If a `decisionPoint` was generated, the code iterates through its `options`, assigning each one a stable `optionId` (its original index `0-3`).
3.  The `shuffleArray` function is then called to randomize the order of the options before they are sent to the frontend. This prevents the user from learning patterns (e.g., "the first option is always the best").

#### **Step 8: Updating Game State & History**

1.  The user's choice and the AI's new `parsedScenarioStep` are appended to the `dialogue_history` in the `user_goals` table.
2.  The API then checks if the goal's `win_conditions_structured` have been met by comparing them against the user's current metric scores.
3.  Based on this check and the `scenarioComplete` flag, the `user_goals.status` is updated to `active`, `completed`, or `failed_needs_retry`.
4.  The user's `progress` percentage for the goal is also recalculated and updated.

#### **Step 9: Granular Analytics Logging**

1.  A comprehensive record of the turn is created. This record includes:
    *   The question the user faced (`decision_point_question`).
    *   All options that were presented (`options_presented`).
    *   The user's choice (`chosen_option_text`).
    *   The direct KC impacts of that choice (`kc_impacts_of_choice`).
    *   The user's complete KC and Metric scores *after* the decision was processed.
2.  This detailed object is inserted as a new row into the `historical_learning_analytics` table. This table is a goldmine for analyzing player behavior and learning patterns.

#### **Step 10: Formatting and Sending the Final Response**

The API constructs a final JSON response for the frontend, containing:

*   `scenarioStep`: The new, parsed, and shuffled game step from the AI.
*   `metricChangesSummary`: A user-friendly summary of how metrics changed this turn.
*   `goalStatusAfterStep`: The latest status of the user's goal.
*   `currentGoalProgress`: The new goal progress percentage.
*   `currentDecisionCountInScenario`: The number of decisions made, so the frontend can update its UI (e.g., the progress bar).

This response gives the frontend everything it needs to render the next turn of the game.

### Helper Functions

*   `getDefinitionsBundle()`: An asynchronous utility that pre-fetches all necessary definitions from Supabase (all KCs, all Metrics, and the links between them) into a single object for efficient use throughout the request.
*   `fetchWithRetry()`: A wrapper around the native `fetch` that provides resilience for the crucial OpenAI API call.

### TODO: Granular Saving

As noted in the code comments, a future improvement would be to save the AI-generated scenario content into dedicated tables (`scenarios`, `decision_points`, `options`) when it's first created. This would allow for more structured querying and analysis of the content itself, rather than parsing it from the JSON in the `dialogue_history`.