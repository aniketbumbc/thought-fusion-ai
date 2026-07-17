# Thought Fusion — How It Works

## **Ask once → 3 models answer in parallel → Claude fuses them into one.**

## The idea

- One prompt → **OpenAI + Anthropic + Google**, fired at the same time
- One provider down? No problem — the others still answer
- Every answer that survives gets handed to **Claude**, who merges them into a single best response
- The whole thing **streams live** over SSE — you watch each model think, then watch the fusion happen

---

## The flow

```
 you type a prompt
        │
        ▼
 POST /api/generate ──► runSelfConsistency()
        │                       │
        │           ┌───────────┼───────────┐
        │           ▼           ▼           ▼
        │        OpenAI     Anthropic    Google      (parallel, allSettled)
        │           │           │           │
        │           └───────────┼───────────┘
        │                       ▼
        │              successes → Claude (synthesizer)
        │                       │
        ▼                       ▼
   SSE events stream back: candidate_started/done → synthesis_started/done → final
```

Every stage is an **event**, not a silent wait — that's the whole reason this is SSE instead of a single JSON response.

---

## File map — one line each

| File                       | Job                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `ai/modelConfig.ts`        | Env → config. Decides _who's available_ (has a key?) and _can we synthesize_ (Anthropic key present?)                               |
| `ai/models.ts`             | Factory only. Builds the 3 candidate LLMs + the Claude synthesizer. Never calls them.                                               |
| `ai/prompt.ts`             | Pulls both system prompts from env (throws at boot if missing). Builds the synthesis message. **Edit this to change tone/quality.** |
| `types.ts`                 | The shared contract (`CandidateResult`, `SynthesisResult`, `GenerateResponse`) — frontend & backend agree here                      |
| `orchestrator.ts`          | **The brain.** Fans out, waits for all, synthesizes the survivors, never throws.                                                    |
| `api/generate/route.ts`    | Thin HTTP shell — validates input, streams orchestrator events as SSE                                                               |
| `sseClient.ts`             | Hand-rolled SSE parser on the client — no library                                                                                   |
| `events.ts`                | Client-side view types: `ModelView`, `FinalPhase`, provider dot colors                                                              |
| `hooks/useThoughts.ts`     | Client state machine — folds SSE events into UI state                                                                               |
| `page.tsx` + `components/` | Renders it all: prompt box → live model cards → final-answer panel                                                                  |

---

## A request, in 6 beats

1. **Type + submit** → `useThoughts.generate()` opens the SSE stream
2. **Route validates**, calls `runSelfConsistency()`
3. **Fan-out** — every available provider runs concurrently via `Promise.allSettled` (a failure never kills the others)
4. Each candidate reports in → UI card flips `thinking → done/failed` live
5. If ≥1 succeeded **and** an Anthropic key exists → Claude synthesizes → final-answer panel updates
6. A closing `final` event carries the complete response — used only to reconcile stats, never to "jump" the UI

---

## Bets this codebase makes (worth knowing before you touch it)

- **`allSettled`, always.** One dead provider ≠ a dead request. `all`/`race`/`any` are all wrong here — see the README for the full combinator breakdown.
- **Nothing in the orchestrator throws.** Every failure becomes data (`error`, `synthesisSkippedReason`), so the route stays a dumb pipe.
- **No fallback prompts.** `CANDIDATE_SYSTEM_PROMPT` / `SYNTHESIS_SYSTEM_PROMPT` are env-only and the app refuses to boot without them — loud failure beats silent wrong output.
- **One timeout, everywhere.** `AbortSignal.timeout(MODEL_TIMEOUT_MS)` wraps every provider call the same way.
- **Streamed state ≠ overwritten by the final event.** The UI is built incrementally; `final` only fills in stats it couldn't know earlier.
