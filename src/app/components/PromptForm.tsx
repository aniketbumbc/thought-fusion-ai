"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PromptFormProps {
  onGenerate: (prompt: string) => void;
  running: boolean;
  /** "hero" — large centered composer shown before the first run.
   *  "bar" — compact composer pinned to the bottom once results exist. */
  variant?: "hero" | "bar";
}

export function PromptForm({ onGenerate, running, variant = "hero" }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");

  const submit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || running) return;
    onGenerate(trimmed);
    setPrompt("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter submits; Shift+Enter keeps newlines.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const composer = (
    <div className="relative mx-auto max-w-[640px] text-left">
      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Ask anything…"
        spellCheck={false}
        disabled={running}
        className={
          variant === "hero"
            ? "min-h-28 resize-none rounded-2xl pb-14 text-[15px] leading-relaxed"
            : "min-h-[52px] max-h-40 resize-none rounded-2xl pb-11 text-[14px] leading-relaxed shadow-lg"
        }
      />

      <span className="pointer-events-none absolute bottom-3.5 left-4 font-mono text-[11px] text-muted-foreground">
        3 models · parallel
      </span>

      <Button
        onClick={submit}
        disabled={running || !prompt.trim()}
        className="absolute bottom-3 right-3 gap-2 rounded-xl font-semibold"
      >
        {running ? "Generating…" : "Generate"}
      </Button>
    </div>
  );

  if (variant === "bar") return composer;

  return (
    <div className="pt-10 pb-7 text-center">
      <h1 className="mb-2 text-3xl font-semibold leading-tight tracking-tight">
        Ask once. Answer thrice. Trust the fusion.
      </h1>
      <p className="mx-auto mb-6 max-w-[440px] text-[15px] leading-relaxed text-muted-foreground">
        One question, three models in parallel, one reconciled answer.
      </p>
      {composer}
    </div>
  );
}
