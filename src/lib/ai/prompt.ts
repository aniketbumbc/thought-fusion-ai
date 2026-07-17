import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { CandidateResult } from '../types';

function requireEnvPrompt(name: 'SYNTHESIS_SYSTEM_PROMPT' | 'CANDIDATE_SYSTEM_PROMPT'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var ${name}. Set it in .env.local.`);
  }
  return value;
}

const SYSTEM_PROMPT = requireEnvPrompt('SYNTHESIS_SYSTEM_PROMPT');

export const CANDIDATE_SYSTEM_PROMPT = requireEnvPrompt('CANDIDATE_SYSTEM_PROMPT');

/** Format a block of candidate answers for display.  what is output here
 *
 * @param candidates - The candidate answers to format.
 * @returns A string formatted as a block of candidate answers. This is what is output to the user.
 *
 */
export function candidateBlock(candidates: CandidateResult[]): string {
  return candidates
    .filter((c) => c.ok && c.text)
    .map((c, i) => `### Candidate ${i + 1} — ${c.label}\n${c.text!.trim()}`)
    .join('\n\n');
}

/** Build the messages for the synthesis process.
 *
 * @param prompt - The user's question.
 * @param candidates - The candidate answers to compare.
 * @returns An array of messages for the synthesis process.
 */
export function buildSynthesisMessages(
  prompt: string,
  candidates: CandidateResult[],
): BaseMessage[] {
  const human = `USER QUESTION:
  ${prompt}
  
  CANDIDATE ANSWERS:
  ${candidateBlock(candidates)}
  
  Now produce the single best final answer, following your process.`;

  return [new SystemMessage(SYSTEM_PROMPT), new HumanMessage(human)];
}
