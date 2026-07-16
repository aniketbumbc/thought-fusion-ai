import { ProviderId } from './ai/modelConfig';

export type { ProviderId };

/** One candidate model's outcome. Always returned — success or failure. */

export interface CandidateResult {
  provider: ProviderId;
  label: string; // display name, e.g. "OpenAI · gpt-5.5"
  model: string;
  ok: boolean;
  text: string | null; // set when ok === true
  error: string | null; // set when ok === false
  latencyMs: number;
}

/** The final merged answer from the Claude synthesizer. */
export interface SynthesisResult {
  finalAnswer: string;
  usedProviders: ProviderId[]; // which candidates fed into it
  latencyMs: number;
}

/** The full payload the API returns to the frontend. */
export interface GenerateResponse {
  prompt: string;
  candidates: CandidateResult[];
  synthesis: SynthesisResult | null;
  meta: {
    totalMs: number;
    succeeded: number;
    failed: number;
    synthesisSkippedReason: string | null;
  };
}
