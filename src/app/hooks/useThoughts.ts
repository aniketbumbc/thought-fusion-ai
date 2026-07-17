import { useCallback, useRef, useState } from 'react';
import { streamSelfConsistency } from '../../lib/sseClient';
import type {
  ClientEvent,
  FinalPhase,
  GenerateResponse,
  ModelView,
  ProviderId,
} from '../../lib/events';

interface State {
  running: boolean;
  models: ModelView[]; // in arrival order
  finalPhase: FinalPhase;
  finalAnswer: string | null;
  skippedReason: string | null;
  meta: GenerateResponse['meta'] | null;
  error: string | null;
}

const INITIAL: State = {
  running: false,
  models: [],
  finalPhase: 'idle',
  finalAnswer: null,
  skippedReason: null,
  meta: null,
  error: null,
};

export function useThoughts() {
  const [state, setState] = useState<State>(INITIAL);
  const cancelRef = useRef<(() => void) | null>(null);

  const patchModel = (provider: ProviderId, patch: Partial<ModelView>) =>
    setState((s) => ({
      ...s,
      models: s.models.map((m) =>
        m.provider === provider ? { ...m, ...patch } : m,
      ),
    }));

  const handleEvent = useCallback((event: ClientEvent) => {
    switch (event.type) {
      case 'candidate_started':
        setState((s) => ({
          ...s,
          finalPhase: s.finalPhase === 'idle' ? 'waiting' : s.finalPhase,
          models: [
            ...s.models,
            {
              provider: event.provider,
              label: event.label,
              model: event.model,
              status: 'thinking',
              answer: null,
              error: null,
              latencyMs: null,
              expanded: false,
            },
          ],
        }));
        break;

      case 'candidate_done': {
        const c = event.candidate;
        patchModel(c.provider, {
          status: c.ok ? 'done' : 'failed',
          answer: c.text,
          error: c.error,
          latencyMs: c.latencyMs,
        });
        break;
      }

      case 'synthesis_started':
        setState((s) => ({ ...s, finalPhase: 'synthesizing' }));
        break;

      case 'synthesis_done':
        setState((s) => ({
          ...s,
          finalPhase: 'result',
          finalAnswer: event.synthesis.finalAnswer,
        }));
        break;

      case 'final':
        // Authoritative snapshot: reconcile meta + skip reason.
        setState((s) => {
          const r = event.result;
          const skipped = r.synthesis === null;
          return {
            ...s,
            meta: r.meta,
            skippedReason: r.meta.synthesisSkippedReason,
            finalPhase: skipped ? 'skipped' : 'result',
            finalAnswer: r.synthesis?.finalAnswer ?? null,
          };
        });
        break;

      case 'error':
        setState((s) => ({ ...s, error: event.message }));
        break;
    }
  }, []);

  const generate = useCallback(
    (prompt: string) => {
      const trimmed = prompt.trim();
      if (!trimmed || state.running) return;

      // Cancel any in-flight run before starting a new one.
      cancelRef.current?.();

      setState({ ...INITIAL, running: true, finalPhase: 'waiting' });

      cancelRef.current = streamSelfConsistency(trimmed, {
        onEvent: handleEvent,
        onError: (message) => setState((s) => ({ ...s, error: message })),
        onClose: () => setState((s) => ({ ...s, running: false })),
      });
    },
    [state.running, handleEvent],
  );

  const toggleExpand = useCallback((provider: ProviderId) => {
    setState((s) => ({
      ...s,
      models: s.models.map((m) =>
        m.provider === provider ? { ...m, expanded: !m.expanded } : m,
      ),
    }));
  }, []);

  const reset = useCallback(() => {
    cancelRef.current?.();
    setState(INITIAL);
  }, []);

  return { ...state, generate, toggleExpand, reset };
}
