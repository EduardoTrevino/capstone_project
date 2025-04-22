import { z } from "zod";

/* one of the four buttons */
export const DecisionOption = z.object({
  text: z.string(),
  metricDeltas: z.record(z.number()),   // {"cash":50}
  isScaffold: z.boolean()
});

/* one step coming from the LLM */
export const ScenarioStep = z.object({
  stepType: z.enum(["decision","mcq","feedback","summary"]),
  messages: z.array(z.string()),
  decision: z.object({ options: z.array(DecisionOption).length(4) }).nullable(),
  mcq: z.object({
    question: z.string(),
    options: z.array(z.string()).length(4),
    correctOptionIndex: z.number().int()
  }).nullable(),
  feedback: z.object({
    correctFeedback: z.string(),
    incorrectFeedback: z.string()
  }).nullable(),
  summary: z.string().nullable()
});

/* handy TS type */
export type TScenarioStep = z.infer<typeof ScenarioStep>;
