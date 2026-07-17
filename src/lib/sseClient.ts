import { ClientEvent } from './events';

export interface StreamHandlers {
  onEvent: (event: ClientEvent) => void;
  onError: (message: string) => void;
  onClose: () => void;
}

/** Map a raw SSE event name + parsed data to a normalized ClientEvent. */
function toClientEvent(name: string, data: unknown): ClientEvent | null {
  switch (name) {
    case 'candidate_started':
    case 'candidate_done':
    case 'synthesis_started':
    case 'synthesis_done':
      // These already carry a matching `type` field from the backend emit.
      return data as ClientEvent;
    case 'final':
      return {
        type: 'final',
        result: data as ClientEvent extends { result: infer R } ? R : never,
      };
    case 'error':
      return {
        type: 'error',
        message: (data as { message?: string })?.message ?? 'Stream error.',
      };
    default:
      return null; // ignore unknown events (e.g. keep-alive comments)
  }
}

/** Parse one raw SSE record ("event: x\ndata: {...}") into name + data. */
function parseRecord(raw: string): { name: string; data: unknown } | null {
  let name = 'message';
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
    if (line.startsWith(':')) continue; // comment / keep-alive
    if (line.startsWith('event:')) name = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  try {
    return { name, data: JSON.parse(dataLines.join('\n')) };
  } catch {
    return null;
  }
}

/**
 * POST the prompt and stream the response. Returns an abort function so the
 * caller can cancel an in-flight run.
 */
export function streamSelfConsistency(
  prompt: string,
  handlers: StreamHandlers,
): () => void {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const msg = await res.text().catch(() => '');
        handlers.onError(msg || `Request failed (${res.status}).`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // A full SSE record ends with a blank line.
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const raw = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const parsed = parseRecord(raw);
          if (!parsed) continue;
          const event = toClientEvent(parsed.name, parsed.data);
          if (event) handlers.onEvent(event);
        }
      }
    } catch (err) {
      // Aborts are intentional — don't surface them as errors.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      handlers.onError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      handlers.onClose();
    }
  })();

  return () => controller.abort();
}
