# Thought Fusion

A GenAI web app that answers a question by asking **multiple AI models the same
prompt in parallel**, then uses **Claude as a synthesizer** to merge their
answers into a single, superior response — not a copy of any one model.

Built with **Next.js (App Router)** for both frontend and API, and
**LangChain JS** as the unified model layer.

> **Status:** the orchestrator and `/api/generate` endpoint are implemented and
> working end-to-end (see below). The frontend is still a placeholder — no UI
> has been built yet to call the endpoint or render results.

---

## What "Thought Fusion" means here

This is a **fan-out + synthesize** pattern, not the classic single-model voting:

1. One prompt is sent to several candidate models (OpenAI, Claude, Gemini) **at
   the same time**.
2. Each returns its own answer. Failures are tolerated — one provider being down
   does not fail the request.
3. The surviving answers are handed to a **synthesizer (Claude)**, which compares
   them, treats cross-model agreement as evidence, resolves contradictions, folds
   in each answer's strongest parts, and writes a fresh final answer.
4. The user sees the merged final answer; the individual candidate answers are
   also returned so the "work" can be shown.

The quality of the merge lives entirely in the synthesis prompt
(`src/lib/ai/prompt.ts`) — that is the single knob for tuning output quality.

---

## Request flow

```
        ┌──────────────────────────────────────────────────────┐
        │  POST /api/generate   { prompt }                       │
        └───────────────────────────┬──────────────────────────┘
                                     │ validate (zod)
                                     ▼
                       runSelfConsistency(prompt)
                                     │
                   availableCandidates()  ← only providers with a key
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
        ChatOpenAI            ChatAnthropic         ChatGoogleGenerativeAI
        .invoke()             .invoke()             .invoke()
        (AbortSignal timeout on each)
              │                      │                      │
              └──────────────────────┼──────────────────────┘
                                     ▼
                       Promise.allSettled(...)      ← waits for all,
                                     │                 never rejects
                          split into ok / failed
                                     │
                    succeeded === 0 ?  → skip synthesis (reason)
                    no Anthropic key ? → skip synthesis (reason)
                                     │ else
                                     ▼
                         makeSynthesizer() = Claude
                         buildSynthesisMessages(prompt, ok)
                         .invoke()  → final answer
                                     │
                                     ▼
        ┌──────────────────────────────────────────────────────┐
        │  { prompt, candidates[], synthesis, meta }             │
        └──────────────────────────────────────────────────────┘
```

Every path returns a valid response object. Nothing in the flow throws — all
resilience is handled inside the orchestrator, so the API route stays thin.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                 # Home page (placeholder — no UI wired up yet)
│   ├── layout.tsx
│   ├── globals.css
│   └── api/
│       ├── generate/route.ts    # POST /api/generate — the fan-out + synthesize endpoint
│       └── hello/route.ts       # GET /api/hello — trivial health-check route
├── components/                  # empty — reserved for the future frontend
└── lib/
    ├── types.ts                 # Shared TypeScript contracts
    ├── orchestrator.ts          # The brain: parallel fan-out + synthesis step
    └── ai/
        ├── modelConfig.ts       # Reads/validates env, exposes config + availableCandidates()/canSynthesize()
        ├── models.ts            # LangChain factory: makeCandidate(), makeSynthesizer()
        └── prompt.ts            # The synthesis system prompt + message builder
```

| File                                | Responsibility                                                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/ai/modelConfig.ts`          | Reads and validates keys + model IDs from env. Exposes `config`, `availableCandidates()`, `canSynthesize()`. Nothing is hardcoded.              |
| `src/lib/types.ts`                   | Shared TypeScript contracts (`CandidateResult`, `SynthesisResult`, `GenerateResponse`). The shape the UI will consume.                          |
| `src/lib/ai/models.ts`               | LangChain factory. `makeCandidate(provider)` builds a candidate model; `makeSynthesizer()` builds the Claude merger. Builds only — never calls. |
| `src/lib/ai/prompt.ts`               | The synthesis prompt. Formats candidate answers and produces the system + human messages for Claude.                                            |
| `src/lib/orchestrator.ts`            | The brain. Parallel fan-out with per-call timeout, error capture, and the synthesis step.                                                       |
| `src/app/api/generate/route.ts`      | HTTP endpoint. Validates input (zod), calls the orchestrator, returns JSON.                                                                     |
| `src/app/api/hello/route.ts`         | Trivial `GET` route returning `"Hello World"` — leftover from scaffolding, not part of the fusion flow.                                          |

---

## Promise combinators — why `allSettled`

The fan-out uses `Promise.allSettled` deliberately. Here is how the combinators
differ, and why the others are wrong for this job:

| Combinator           | Rejects on first failure?                              | Waits for all?      | Resolves with                        |
| -------------------- | ------------------------------------------------------ | ------------------- | ------------------------------------ |
| `Promise.all`        | **Yes** — one rejection loses all results              | Only if all succeed | Array of all values                  |
| `Promise.allSettled` | **Never rejects**                                      | **Yes**             | Array of `{status, value \| reason}` |
| `Promise.race`       | Settles on the first _settle_ (success **or** failure) | No                  | The first result to settle           |
| `Promise.any`        | Rejects only if **all** fail                           | No                  | The first _successful_ result        |

- **`all`** is all-or-nothing: if Claude is down, OpenAI's and Gemini's good
  answers would be thrown away. Wrong for a fault-tolerant fan-out.
- **`allSettled`** waits for every model and reports each outcome individually —
  successes are kept, failures are marked. This is what makes "one provider down
  doesn't kill the request" work.
- **`race`** returns whichever model finishes first (even if it errors) — a
  "fastest wins" tool, not "collect everything."
- **`any`** returns the first model that succeeds — "first working answer," not
  all answers.

We need _every_ successful answer to feed the synthesis, so `allSettled` is the
correct choice.

> Note: `runCandidate()` already wraps each call in its own `try/catch` and never
> throws, so `Promise.all` would also work in practice. `allSettled` is still the
> correct, self-documenting choice and stays safe even if that inner catch is
> ever removed.

---

## Setup

Requires **Node.js 20+** (LangChain JS v1).

```bash
npm install
```

Create `.env.local` in the project root:

```
# API keys — only providers with a key will run
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_API_KEY=

# Candidate model IDs — VERIFY these in each provider's dashboard (they change often)
OPENAI_MODEL=gpt-5.5
ANTHROPIC_MODEL=claude-haiku-4-5-20251001
GOOGLE_MODEL=gemini-2.5-flash

# Synthesizer — must be a Claude model; needs ANTHROPIC_API_KEY
SYNTHESIZER_MODEL=claude-sonnet-4-6

# Tuning
MODEL_TIMEOUT_MS=45000
MODEL_TEMPERATURE=1
```

The values above are the defaults `src/lib/ai/modelConfig.ts` falls back to when
a variable is unset — set them explicitly to pin exact model IDs.

You do **not** need all three keys — even one candidate works. Synthesis requires
the Anthropic key; without it the candidate answers still return, with a reason
noting synthesis was skipped.

```bash
npm run dev
```

---

## API

### `GET /api/generate`

Health check.

```json
{ "ok": true, "endpoint": "self-consistency /api/generate" }
```

### `POST /api/generate`

**Body**

```json
{ "prompt": "Explain the CAP theorem with a concrete example." }
```

Validation: `prompt` is required, trimmed, 1–8000 chars. Invalid input → `400`.

**Response** (`200`)

```json
{
  "prompt": "…",
  "candidates": [
    {
      "provider": "openai",
      "label": "OpenAI · gpt-5.5",
      "model": "gpt-5.5",
      "ok": true,
      "text": "…answer…",
      "error": null,
      "latencyMs": 4120
    }
  ],
  "synthesis": {
    "finalAnswer": "…merged answer…",
    "usedProviders": ["openai", "anthropic", "google"],
    "latencyMs": 6210
  },
  "meta": {
    "totalMs": 10870,
    "succeeded": 3,
    "failed": 0,
    "synthesisSkippedReason": null
  }
}
```

When synthesis is skipped, `synthesis` is `null` and `meta.synthesisSkippedReason`
explains why (no candidates succeeded, no Anthropic key, or a synthesis error).

### Test with curl

```bash
curl http://localhost:3000/api/generate

curl -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"Explain the CAP theorem with a concrete example."}'
```

Check `meta.succeeded`/`failed` and each candidate's `error` field to confirm
your keys and model IDs are valid — a wrong model ID or bad key shows up there.

---

## Design notes

- **Timeouts** are enforced at call time via `AbortSignal.timeout()` in the
  orchestrator, not in the model constructors — uniform behavior across all three
  providers, and covers the whole call including retries.
- **Model IDs drift.** The defaults in `modelConfig.ts` are best-guesses; always
  pin the exact current IDs from each provider's dashboard before deploying.
- **`nodejs` runtime** is required (set via `export const runtime = 'nodejs'` in
  the route) — the provider SDKs do not run on Edge.
- Three parallel model calls plus a synthesis pass can run long on serverless
  platforms — if deploying to Vercel, set `export const maxDuration = ...` in
  the route to match your plan's function limit (not currently set).

---

## Roadmap

- Streaming (SSE) variant of `/api/generate` for token-by-token final answers.
- shadcn/ui frontend: prompt input, per-candidate cards with latency, final answer.
- Optional structured synthesis (final answer + per-source rationale).
