import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runSelfConsistency } from '../../../lib/orchestrator';

export const runtime = 'nodejs';

const inputSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(1, 'Prompt is required.')
    .max(8000, 'Prompt is too long (max 8000 chars).'),
});

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch (err) {
    return NextResponse.json(
      { error: 'Request body must be valid JSON.' },
      { status: 400 },
    );
  }
  const parsed = inputSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request.' },
      { status: 400 },
    );
  }

  try {
    const response = await runSelfConsistency(parsed.data.prompt);
    return NextResponse.json(response, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error.';

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// health check endpoint
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: 'self-consistency /api/generate',
  });
}
