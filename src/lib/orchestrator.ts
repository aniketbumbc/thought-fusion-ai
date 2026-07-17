import 'server-only';
import {
  config,
  availableCandidates,
  canSynthesize,
  type ProviderId,
} from './ai/modelConfig';
import { makeCandidate, makeSynthesizer } from './ai/models';
import { buildSynthesisMessages } from './ai/prompt';
import type {
  CandidateResult,
  GenerateResponse,
  SynthesisResult,
} from './types';

import { SystemMessage, HumanMessage } from '@langchain/core/messages';
import { CANDIDATE_SYSTEM_PROMPT } from './ai/prompt';

export type OrchestratorEvent =
  | {
      type: 'candidate_started';
      provider: ProviderId;
      label: string;
      model: string;
    }
  | { type: 'candidate_done'; candidate: CandidateResult }
  | { type: 'synthesis_started'; usedProviders: ProviderId[] }
  | { type: 'synthesis_done'; synthesis: SynthesisResult };

type Emit = (e: OrchestratorEvent) => void;

function messageToText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && 'text' in block) {
          return String((block as { text?: unknown }).text ?? '');
        }
        return '';
      })
      .join('');
  }
  return content == null ? '' : String(content);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return typeof err === 'string' ? err : 'Unknown error';
}

async function runCandidate(
  provider: ProviderId,
  prompt: string,
  emit: Emit,
): Promise<CandidateResult> {
  const started = Date.now();
  const { label, model, llm } = makeCandidate(provider);
  emit({ type: 'candidate_started', provider, label, model });
  try {
    const res = await llm.invoke(
      [new SystemMessage(CANDIDATE_SYSTEM_PROMPT), new HumanMessage(prompt)],
      {
        signal: AbortSignal.timeout(config.modelTimeoutMs),
      },
    );
    const candidate: CandidateResult = {
      provider,
      label,
      model,
      ok: true,
      text: messageToText(res.content).trim(),
      error: null,
      latencyMs: Date.now() - started,
    };
    emit({ type: 'candidate_done', candidate });
    return candidate;
  } catch (err) {
    const candidate: CandidateResult = {
      provider,
      label,
      model,
      ok: false,
      text: null,
      error: errorMessage(err),
      latencyMs: Date.now() - started,
    };
    emit({ type: 'candidate_done', candidate });
    return candidate;
  }
}

// final step of the process, synthesize the answers into a single answer
async function synthesize(
  prompt: string,
  results: CandidateResult[],
): Promise<SynthesisResult> {
  const started = Date.now();
  const synthesizer = makeSynthesizer(); // the model that will synthesize the answers
  const messages = buildSynthesisMessages(prompt, results);
  const res = await synthesizer.invoke(messages, {
    signal: AbortSignal.timeout(config.modelTimeoutMs), // timeout the request if it takes too long
  });
  return {
    finalAnswer: messageToText(res.content).trim(),
    usedProviders: results.map((c) => c.provider),
    latencyMs: Date.now() - started,
  };
}

// orchestrate the process of running the candidates and synthesizing the answers

export async function runSelfConsistency(
  prompt: string,
  emit: Emit = () => {},
): Promise<GenerateResponse> {
  const started = Date.now();
  const providers = availableCandidates(); //get the available LLM models

  if (providers.length === 0) {
    return {
      prompt,
      candidates: [],
      synthesis: null,
      meta: {
        totalMs: Date.now() - started,
        succeeded: 0,
        failed: 0,
        synthesisSkippedReason: 'No provider API keys are configured.',
      },
    };
  }

  const settled = await Promise.allSettled(
    providers.map((p) => runCandidate(p, prompt, emit)), // run the candidates in parallel each Model will run in parallel
  );

  // map the results to the candidates
  const candidates: CandidateResult[] = settled.map((s, i) =>
    s.status === 'fulfilled'
      ? s.value
      : {
          provider: providers[i],
          label: providers[i],
          model: 'unknown',
          ok: false,
          text: null,
          error: errorMessage(s.reason),
          latencyMs: 0,
        },
  );

  const results = candidates.filter((c) => c.ok);
  const succeeded = results.length;
  const failed = candidates.length - succeeded;

  let synthesis: SynthesisResult | null = null; // the synthesized answer
  let synthesisSkippedReason: string | null = null;

  if (succeeded === 0) {
    synthesisSkippedReason = 'No candidate model returned an answer.';
  } else if (!canSynthesize()) {
    // if the synthesis is not possible, skip it
    synthesisSkippedReason =
      'Synthesis requires an Anthropic API key (ANTHROPIC_API_KEY).';
  } else {
    emit({
      type: 'synthesis_started',
      usedProviders: results.map((c) => c.provider),
    });
    try {
      synthesis = await synthesize(prompt, results); // final llm call to synthesize the answers
      emit({ type: 'synthesis_done', synthesis });
    } catch (err) {
      synthesisSkippedReason = `Synthesis failed: ${errorMessage(err)}`;
    }
  }

  return {
    prompt,
    candidates, // all the candidates and their results
    synthesis, // the synthesized answer
    meta: {
      totalMs: Date.now() - started,
      succeeded, // the number of candidates that returned an answer
      failed, // the number of candidates that did not return an answer
      synthesisSkippedReason,
    },
  };
}

/**'
 *
 * Promise.all :- waits for every promise to succeed. If any one rejects, the whole thing rejects immediately with that error,
 * and the other results are lost. All-or-nothing.
 *
 * Promise.allSettled :- waits for every promise to settle (either succeed or reject), and returns an array of results.
 * The array of results will have the same order as the input promises, and it will contain the result of each promise.
 * Even if some promises reject, the others will still be processed and included in the result array. No early termination.
 *
 * Promise.race :- waits for the first promise to settle (either succeed or reject), and returns the result of that promise.
 * If the first promise succeeds, the others are ignored. If the first promise rejects, the others are ignored.
 * No early termination.
 *
 * Promise.any :- waits for the first promise to succeed, and returns the result of that promise.
 * If the first promise rejects, the others are ignored. No early termination.
 *
 * Promise.allSettled :- waits for every promise to settle (either succeed or reject), and returns an array of results.
 * The array of results will have the same order as the input promises, and it will contain the result of each promise.
 * Even if some promises reject, the others will still be processed and included in the result array. No early termination.
 */
