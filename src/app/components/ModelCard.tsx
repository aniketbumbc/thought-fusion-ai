"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PROVIDER_DOT, type ModelView, type ProviderId } from '../../lib/events';
import { Markdown } from './Markdown';

interface ModelCardProps {
  model: ModelView;
  onToggle: (provider: ProviderId) => void;
}

function fmtLatency(ms: number | null): string {
  if (ms == null) return "";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function ModelCard({ model, onToggle }: ModelCardProps) {
  const { provider, label, model: modelId, status, answer, error, latencyMs, expanded } = model;

  // "Claude" from "Claude · claude-sonnet-4-6"
  const providerName = label.split("·")[0]?.trim() ?? provider;

  return (
    <Card className="flex h-70 flex-col gap-3 overflow-hidden rounded-2xl p-4 animate-[sc-rise_.3s_ease_both]">
      {/* header */}
      <div className="flex flex-none items-center gap-2.5">
        <span
          className="size-2.5 flex-none rounded-sm"
          style={{ background: PROVIDER_DOT[provider] }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[12.5px] font-semibold tracking-tight">
            {providerName}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">{modelId}</span>
        </div>

        {status === "thinking" && (
          <div className="size-3.5 flex-none animate-spin rounded-full border-2 border-border border-t-brand" />
        )}

        {status === "done" && (
          <div className="flex flex-none items-center gap-1.5">
            <Badge
              variant="secondary"
              className="bg-chip font-mono text-[10px] font-semibold text-muted-foreground"
            >
              {fmtLatency(latencyMs)}
            </Badge>
            <span className="flex size-4 items-center justify-center rounded-full bg-success-weak text-[10px] font-extrabold text-success">
              ✓
            </span>
          </div>
        )}

        {status === "failed" && (
          <span className="flex-none rounded-md bg-fail-weak px-2 py-0.5 text-[10px] font-bold tracking-wide text-fail">
            FAILED
          </span>
        )}
      </div>

      {/* body */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto pr-1">
        {status === "thinking" && (
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-2 w-[92%] rounded bg-skeleton" />
            <Skeleton className="h-2 w-[70%] rounded bg-skeleton" />
            <span className="mt-0.5 text-[11.5px] text-muted-foreground">Thinking…</span>
          </div>
        )}

        {status === "done" && answer && (
          <Collapsible open={expanded} onOpenChange={() => onToggle(provider)}>
            <CollapsibleTrigger className="flex items-center gap-1.5 text-[12.5px] font-semibold text-brand">
              <span
                className="inline-block text-[9px] transition-transform"
                style={{ transform: expanded ? "rotate(90deg)" : "none" }}
              >
                ▶
              </span>
              {expanded ? "Hide answer" : "View answer"}
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Markdown className="mt-2.5 border-t border-border pt-2.5 text-[12.5px] text-text-soft">
                {answer}
              </Markdown>
            </CollapsibleContent>
          </Collapsible>
        )}

        {status === "failed" && (
          <div className="opacity-70">
            <p className="text-xs leading-normal text-fail">{error}</p>
            <p className="mt-1.5 text-[11px] text-muted-foreground">excluded from synthesis</p>
          </div>
        )}
      </div>
    </Card>
  );
}