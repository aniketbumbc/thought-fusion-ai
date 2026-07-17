"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { useThoughts } from "./hooks/useThoughts";
import { TopBar } from "./components/TopBar";
import { PromptForm } from "./components/PromptForm";
import { ModelCard } from "./components/ModelCard";
import { FinalAnswer } from "./components/FinalAnswer";

// Distance (px) from the bottom within which we still consider the user "at bottom".
const BOTTOM_THRESHOLD = 96;

export default function Home() {
  const {
    running,
    models,
    finalPhase,
    finalAnswer,
    skippedReason,
    meta,
    error,
    generate,
  } = useThoughts();

  const started = finalPhase !== "idle";

  const scrollRef = useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = useState(true);

  // Successful candidates currently feeding synthesis (for "combining N answers").
  const combiningCount = models.filter((m) => m.status === "done").length;

  const isNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < BOTTOM_THRESHOLD;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setAtBottom(true);
  };

  // Stick to the bottom as new content streams in, unless the user scrolled away.
  useEffect(() => {
    if (!started) return;
    if (isNearBottom()) scrollToBottom(atBottom ? "smooth" : "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, models, finalPhase, finalAnswer]);

  return (
    <div className="flex h-screen flex-col overflow-hidden px-6">
      <div className="mx-auto w-full max-w-[960px]">
        <TopBar />
      </div>

      {!started ? (
        <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto">
          <div className="w-full max-w-[960px]">
            <PromptForm onGenerate={generate} running={running} variant="hero" />
          </div>
        </div>
      ) : (
        <>
          <div className="relative flex-1 overflow-hidden">
            <div
              ref={scrollRef}
              onScroll={() => setAtBottom(isNearBottom())}
              className="scrollbar-thin h-full overflow-y-auto"
            >
              <div className="mx-auto max-w-[960px] pb-6">
                {/* transport-level error (network / bad request), distinct from a skipped synthesis */}
                {error && (
                  <div className="mx-auto mb-4 max-w-[640px] rounded-xl border border-fail/40 bg-fail-weak px-4 py-3 text-[13px] text-fail">
                    {error}
                  </div>
                )}

                {/* model cards */}
                {models.length > 0 && (
                  <div className="mt-2 grid grid-cols-1 gap-3.5 sm:grid-cols-3">
                    {models.map((m) => (
                      <ModelCard key={m.provider} model={m} />
                    ))}
                  </div>
                )}

                {/* final answer panel */}
                <FinalAnswer
                  phase={finalPhase}
                  answer={finalAnswer}
                  skippedReason={skippedReason}
                  meta={meta}
                  combiningCount={combiningCount}
                />
              </div>
            </div>

            {!atBottom && (
              <button
                onClick={() => scrollToBottom()}
                aria-label="Scroll to bottom"
                className="absolute bottom-4 left-1/2 flex size-9 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-transform hover:scale-105"
              >
                <ArrowDown className="size-4" />
              </button>
            )}
          </div>

          <div className="mx-auto w-full max-w-[960px] pb-6 pt-3">
            <PromptForm onGenerate={generate} running={running} variant="bar" />
          </div>
        </>
      )}
    </div>
  );
}
