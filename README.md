# Thought Fusion

A GenAI web app that answers a question by asking **multiple AI models the same
prompt in parallel**, then uses **Claude as a synthesizer** to merge their
answers into a single, superior response — not a copy of any one model.

Built with **Next.js (App Router)** for both frontend and API, **LangChain JS**
as the unified model layer, and a **streaming (SSE) UI** built with
shadcn/ui that shows each model "thinking" live and the final answer as it's
produced.

> **Status:** the orchestrator, the streaming `/api/generate` endpoint, and the
> full frontend (prompt composer, live per-model cards, final-answer panel,
> copy-to-clipboard, dark/light theme) are implemented end-to-end.

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
   also shown live, as their own cards, so the "work" is visible as it happens.

The quality of the merge lives entirely in the synthesis prompt
(`SYNTHESIS_SYSTEM_PROMPT`, configured via env — see [Setup](#setup)) — that is
the single knob for tuning output quality.

---

## Request flow

The endpoint streams progress over **Server-Sent Events** so the UI can render
each model's status the moment it changes, rather than waiting for the whole
request to finish.

```
        ┌──────────────────────────────────────────────────────┐
        │  POST /api/generate   { prompt }                       │
        │  Accept: text/event-stream                             │
        └───────────────────────────┬──────────────────────────┘
                                     │ validate (zod)
                                     ▼
                       runSelfConsistency(prompt, emit)
                                     │
                   availableCandidates()  ← only providers with a key
                                     │
              ┌──────────────────────┼──────────────────────┐
              ▼                      ▼                      ▼
        ChatOpenAI            ChatAnthropic         ChatGoogleGenerativeAI
        .invoke()             .invoke()             .invoke()
    emit candidate_started / candidate_done as each settles
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
                   emit synthesis_started
                         makeSynthesizer() = Claude
                         buildSynthesisMessages(prompt, ok)
                         .invoke()  → final answer
                   emit synthesis_done
                                     │
                                     ▼
        ┌──────────────────────────────────────────────────────┐
        │  SSE stream: candidate_started/candidate_done ×N,      │
        │  synthesis_started, synthesis_done, final               │
        │  final = { prompt, candidates[], synthesis, meta }     │
        └──────────────────────────────────────────────────────┘
```

Every path emits a `final` event with a complete response object. Nothing in
the flow throws — all resilience is handled inside the orchestrator, so the API
route stays a thin SSE wrapper around it.

On the client, [sseClient.ts](src/lib/sseClient.ts) parses the raw SSE records
into normalized `ClientEvent`s, and the [useThoughts](src/app/hooks/useThoughts.ts)
hook folds those events into UI state: one `ModelView` per candidate (`pending`
→ `thinking` → `done`/`failed`) plus a `FinalPhase` (`idle` → `waiting` →
`synthesizing` → `result`/`skipped`) for the final-answer panel.

---

## Project structure

```
src/
├── app/
│   ├── page.tsx                     # Home page — hero composer, live model cards, final answer, autoscroll
│   ├── layout.tsx                   # Root layout, theme provider
│   ├── globals.css                  # Design tokens (brand/status colors) + Tailwind v4 setup
│   ├── hooks/
│   │   └── useThoughts.ts           # Client state machine: folds SSE events into ModelView[] + FinalPhase
│   ├── components/
│   │   ├── TopBar.tsx               # Logo + dark/light theme toggle
│   │   ├── PromptForm.tsx           # Prompt composer — "hero" (centered) and "bar" (pinned) variants
│   │   ├── ModelCard.tsx            # One card per candidate model: status, latency, answer, copy button
│   │   ├── FinalAnswer.tsx          # Final-answer panel across all FinalPhase states
│   │   ├── Markdown.tsx             # Shared react-markdown renderer w/ GFM + styled elements
│   │   └── CopyButton.tsx           # Copy-to-clipboard control used by ModelCard + FinalAnswer
│   └── api/
│       ├── generate/route.ts        # POST /api/generate — SSE stream of the fan-out + synthesize run
│       └── hello/route.ts           # GET /api/hello — trivial health-check route
├── components/ui/                   # shadcn/ui primitives (button, card, badge, textarea, collapsible, skeleton)
└── lib/
    ├── types.ts                     # Shared TypeScript contracts (CandidateResult, SynthesisResult, GenerateResponse)
    ├── events.ts                    # Client-side event/view types (ClientEvent, ModelView, FinalPhase) + PROVIDER_DOT colors
    ├── sseClient.ts                 # Fetches /api/generate, parses raw SSE into ClientEvent, exposes an abort fn
    ├── orchestrator.ts              # The brain: parallel fan-out + synthesis step, emits OrchestratorEvent as it runs
    └── ai/
        ├── modelConfig.ts           # Reads/validates env, exposes config + availableCandidates()/canSynthesize()
        ├── models.ts                # LangChain factory: makeCandidate(), makeSynthesizer()
        └── prompt.ts                # Reads system prompts from env, builds candidate/synthesis messages
```

| File                            | Responsibility                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/ai/modelConfig.ts`     | Reads and validates keys + model IDs from env. Exposes `config`, `availableCandidates()`, `canSynthesize()`. Nothing is hardcoded.              |
| `src/lib/types.ts`              | Shared TypeScript contracts (`CandidateResult`, `SynthesisResult`, `GenerateResponse`). The shape both the API and UI agree on.                 |
| `src/lib/events.ts`             | Client-facing event/view types: `ClientEvent`, `ModelView`, `FinalPhase`, and the per-provider dot color map.                                   |
| `src/lib/ai/models.ts`          | LangChain factory. `makeCandidate(provider)` builds a candidate model; `makeSynthesizer()` builds the Claude merger. Builds only — never calls. |
| `src/lib/ai/prompt.ts`          | Reads `SYSTEM_PROMPT`/`CANDIDATE_SYSTEM_PROMPT` from env, formats candidate answers, and builds the synthesis messages for Claude.              |
| `src/lib/orchestrator.ts`       | The brain. Parallel fan-out with per-call timeout, error capture, and the synthesis step — emits progress events as each stage settles.         |
| `src/lib/sseClient.ts`          | `streamSelfConsistency()` — POSTs the prompt, reads the SSE body, and normalizes each record into a `ClientEvent`.                              |
| `src/app/hooks/useThoughts.ts`  | React state machine consuming `ClientEvent`s: tracks per-model status and the final-answer phase, exposes `generate()`/`reset()`.               |
| `src/app/api/generate/route.ts` | HTTP endpoint. Validates input (zod), streams the orchestrator's events as SSE, closes with a `final` event.                                    |
| `src/app/api/hello/route.ts`    | Trivial `GET` route returning `"Hello World"` — leftover from scaffolding, not part of the fusion flow.                                         |

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

# System prompts — required, no built-in fallback (src/lib/ai/prompt.ts throws at import time if unset)
CANDIDATE_SYSTEM_PROMPT=
SYNTHESIS_SYSTEM_PROMPT=
```

The model/timeout/temperature values above are the defaults
`src/lib/ai/modelConfig.ts` falls back to when a variable is unset — set them
explicitly to pin exact model IDs. `CANDIDATE_SYSTEM_PROMPT` and
`SYNTHESIS_SYSTEM_PROMPT` have **no fallback** — the app throws on startup if
either is missing, since prompt content now lives entirely in env rather than
in source.

You do **not** need all three provider keys — even one candidate works.
Synthesis requires the Anthropic key; without it the candidate answers still
stream back, with a reason noting synthesis was skipped.

```bash
npm run dev
```

Open `http://localhost:3000` — the composer accepts a prompt (`Cmd/Ctrl+Enter`
to submit), fans it out to every configured candidate, and streams each
model's card in live as it finishes, followed by the synthesized final answer.

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

**Response**: `text/event-stream` (`200`). The stream emits these events, in
order, as the run progresses:

| Event               | Payload                                     | When                                             |
| ------------------- | ------------------------------------------- | ------------------------------------------------ |
| `candidate_started` | `{ provider, label, model }`                | Right before a candidate model is invoked        |
| `candidate_done`    | `{ candidate: CandidateResult }`            | When a candidate settles (success or failure)    |
| `synthesis_started` | `{ usedProviders }`                         | Before the Claude synthesis call, if it will run |
| `synthesis_done`    | `{ synthesis: SynthesisResult }`            | When synthesis completes                         |
| `final`             | The complete `GenerateResponse` (see below) | Always sent last, right before the stream closes |
| `error`             | `{ message }`                               | Only if the stream itself throws unexpectedly    |

`final`'s payload:

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

curl -N -X POST http://localhost:3000/api/generate \
  -H 'Content-Type: application/json' \
  -H 'Accept: text/event-stream' \
  -d '{"prompt":"Explain the CAP theorem with a concrete example."}'
```

(`-N` disables curl's output buffering so you see events as they stream.) Check
the `candidate_done` events' `error` field and the final `meta.succeeded`/`failed`
to confirm your keys and model IDs are valid — a wrong model ID or bad key
shows up there.

---

## Design notes

- **Timeouts** are enforced at call time via `AbortSignal.timeout()` in the
  orchestrator, not in the model constructors — uniform behavior across all three
  providers, and covers the whole call including retries.
- **Model IDs drift.** The defaults in `modelConfig.ts` are best-guesses; always
  pin the exact current IDs from each provider's dashboard before deploying.
- **System prompts live in env, not source.** `src/lib/ai/prompt.ts` reads
  `CANDIDATE_SYSTEM_PROMPT`/`SYNTHESIS_SYSTEM_PROMPT` at import time and throws
  if either is unset — there's no default to silently fall back to.
- **`nodejs` runtime** is required (set via `export const runtime = 'nodejs'` in
  the route) — the provider SDKs do not run on Edge.
- **`maxDuration = 60`** is set on the route — three parallel model calls plus a
  synthesis pass can run long on serverless platforms; adjust to match your
  deployment plan's function limit if needed.
- **SSE over plain JSON** was chosen so the UI can render each model's progress
  live instead of a single blocking spinner — the client parses raw
  `event:`/`data:` records itself (`src/lib/sseClient.ts`) rather than pulling in
  an SSE library.
- **UI state is event-sourced.** `useThoughts` never mutates candidate state
  directly from the `final` event except to reconcile `meta`/`skippedReason` —
  the per-model progress comes entirely from the incremental events, so the
  final snapshot can't visually "jump."
