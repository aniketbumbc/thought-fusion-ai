import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import type { BaseMessage } from '@langchain/core/messages';
import type { CandidateResult } from '../types';

const SYSTEM_PROMPT = `You are a rigorous answer synthesizer.

You will receive a user's question and several independent answers to it, each
produced by a different AI model. Your job is NOT to pick one and NOT to stitch
sentences together. Your job is to compare the outputs and produce a single, superior answer.

Follow this process:
1. Read the question and every candidate answers understand what they are saying deeply.
2. Identify where the candidates AGREE — agreement across independent models is
   strong evidence a claim is correct.
3. Identify where they DISAGREE or contradict each other. For each conflict,
   reason about which position is better supported and resolve it. If it cannot
   be resolved from the answers alone, say so plainly rather than guessing.
4. Note the strongest unique contribution of each answer (a detail, an example,
   a correct caveat) and fold the good parts in.
5. Discard filler, hedging, repetition, and anything that looks like a
   hallucination not supported by the other answers.

Then write the FINAL ANSWER:
- Written fresh in your own words. Do NOT copy any single candidate verbatim.
- Directly answers the user's question; lead with the answer, not meta-commentary.
- Correct, complete, and well-organized. Use formatting only if it genuinely helps.
- Do not mention the candidate models, the synthesis process, or that you were
  comparing answers. The user should just see the best possible answer.`;

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
