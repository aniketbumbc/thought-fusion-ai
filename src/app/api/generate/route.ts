import { z } from 'zod';
import { runSelfConsistency } from '../../../lib/orchestrator';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BodySchema = z.object({ prompt: z.string().trim().min(1).max(8000) });

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return new Response(JSON.stringify({ error: 'Invalid prompt.' }), {
      status: 400,
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));
      try {
        const result = await runSelfConsistency(parsed.data.prompt, (e) =>
          send(e.type, e),
        );
        send('final', result);
      } catch (err) {
        send('error', {
          message: err instanceof Error ? err.message : 'Stream failed.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
