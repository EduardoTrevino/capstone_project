import { z } from "zod";

/* delta pair avoids open‑ended object */
const MetricDelta = z.object({
  metric: z.string(),       // e.g. "cash"
  delta: z.number()         // e.g. 50  (can be −10)
}).strict();

export const DecisionOption = z.object({
  text: z.string(),
  metricDeltas: z.array(MetricDelta),   // ← array instead of record
  isScaffold: z.boolean()
}).strict();

export const ScenarioStep = z.object({
  stepType: z.enum(["decision","mcq","feedback","summary"]),
  messages: z.array(z.string()),
  decision: z.object({
    options: z.array(DecisionOption)     // no min/max keywords
  }).strict().nullable(),
  mcq: z.object({
    question: z.string(),
    options: z.array(z.string()),        // len enforced by prompt
    correctOptionIndex: z.number().int()
  }).strict().nullable(),
  feedback: z.object({
    correctFeedback: z.string(),
    incorrectFeedback: z.string()
  }).strict().nullable(),
  summary: z.string().nullable()
}).strict();

export type TScenarioStep = z.infer<typeof ScenarioStep>;
