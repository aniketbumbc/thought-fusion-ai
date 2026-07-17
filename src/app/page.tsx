"use client";

import { useThoughts } from "./hooks/useThoughts";
import { TopBar } from "./components/TopBar";
import { PromptForm } from "./components/PromptForm";
import { ModelCard } from "./components/ModelCard";
import { FinalAnswer } from "./components/FinalAnswer";

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
    toggleExpand,
  } = useThoughts();

  // Successful candidates currently feeding synthesis (for "combining N answers").
  const combiningCount = models.filter((m) => m.status === "done").length;

  return (
    <div className="min-h-screen px-6 pb-24">
      <div className="mx-auto max-w-[960px]">
        <TopBar />

        <PromptForm onGenerate={generate} running={running} />

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
              <ModelCard key={m.provider} model={m} onToggle={toggleExpand} />
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
  );
}