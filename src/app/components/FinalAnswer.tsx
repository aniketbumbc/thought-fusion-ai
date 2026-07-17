"use client";

import { Skeleton } from "@/components/ui/skeleton";
import type { FinalPhase, GenerateResponse } from '../../lib/events';
import { Markdown } from './Markdown';

interface FinalAnswerProps {
  phase: FinalPhase;
  answer: string | null;
  skippedReason: string | null;
  meta: GenerateResponse["meta"] | null;
  combiningCount: number; // successful candidates feeding synthesis
}

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function FinalAnswer({
  phase,
  answer,
  skippedReason,
  meta,
  combiningCount,
}: FinalAnswerProps) {
  if (phase === "idle") return null;

  const succeeded = meta?.succeeded ?? combiningCount;

  return (
    <div
      className="relative mt-6 overflow-hidden rounded-[18px] border"
      style={{
        background: "var(--panel)",
        borderColor: "var(--brand-border)",
        boxShadow: "0 8px 30px var(--brand-glow)",
      }}
    >
      {/* top accent edge */}
      <div
        className="h-[3px]"
        style={{ background: "linear-gradient(90deg, var(--brand), transparent)" }}
      />

      <div className="px-6 pb-6 pt-5">
        {/* label row */}
        <div className="mb-3.5 flex items-center gap-2.5">
          <span
            className="size-2.5 rounded-full bg-brand"
            style={{ boxShadow: "0 0 0 4px var(--brand-glow)" }}
          />
          <span className="text-[12.5px] font-bold uppercase tracking-wider text-brand">
            Final answer
          </span>
          <span className="flex-1" />
          {phase === "result" && (
            <span className="font-mono text-[11px] text-muted-foreground">
              consensus of {succeeded}
            </span>
          )}
        </div>

        {/* waiting */}
        {phase === "waiting" && (
          <div className="flex flex-col gap-2.5 py-1 opacity-80">
            <Skeleton className="h-2.5 w-[88%] rounded bg-skeleton" />
            <Skeleton className="h-2.5 w-[74%] rounded bg-skeleton" />
            <p className="mt-2 text-[13px] text-muted-foreground">
              Waiting for models to respond…
            </p>
          </div>
        )}

        {/* synthesizing */}
        {phase === "synthesizing" && (
          <div className="flex items-center gap-3.5 py-2">
            <div className="size-[22px] flex-none animate-spin rounded-full border-[2.5px] border-brand-weak border-t-brand" />
            <div>
              <div className="text-base font-semibold tracking-tight">
                Synthesizing best answer…
              </div>
              <div className="mt-0.5 text-[12.5px] text-muted-foreground">
                combining {combiningCount} answers
              </div>
            </div>
          </div>
        )}

        {/* result */}
        {phase === "result" && answer && (
          <div className="animate-[sc-rise_.35s_ease_both]">
            <Markdown className="text-[16.5px] tracking-tight">{answer}</Markdown>
            {meta && (
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3.5 font-mono text-[11.5px] text-muted-foreground">
                <span>{fmtMs(meta.totalMs)}</span>
                <span className="opacity-50">·</span>
                <span>
                  {meta.succeeded} succeeded, {meta.failed} failed
                </span>
              </div>
            )}
          </div>
        )}

        {/* skipped */}
        {phase === "skipped" && (
          <div className="py-1">
            <p className="text-[13px] leading-relaxed text-fail">
              {skippedReason ?? "No final answer could be produced."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}