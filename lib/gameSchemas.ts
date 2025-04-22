import { z } from "zod";

/* one of the four buttons */
export const DecisionOption = z.object({
  text: z.string(),
  metricDeltas: z.record(z.number()),
  isScaffold: z.boolean()
}).strict();               // additionalProperties: false

/* step coming from the LLM */
export const ScenarioStep = z.object({
  stepType: z.enum(["decision","mcq","feedback","summary"]),
  messages: z.array(z.string()),
  decision: z.object({
    options: z.array(DecisionOption)  // 👈  NO length() / min() / max()
  }).strict().nullable(),
  mcq: z.object({
    question: z.string(),
    options: z.array(z.string()),     // 👈  NO length()
    correctOptionIndex: z.number().int()
  }).strict().nullable(),
  feedback: z.object({
    correctFeedback: z.string(),
    incorrectFeedback: z.string()
  }).strict().nullable(),
  summary: z.string().nullable()
}).strict();               // root additionalProperties: false

export type TScenarioStep = z.infer<typeof ScenarioStep>;
