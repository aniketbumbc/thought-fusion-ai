"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface PromptFormProps {
  onGenerate: (prompt: string) => void;
  running: boolean;
}

export function PromptForm({ onGenerate, running }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");

  const submit = () => {
    const trimmed = prompt.trim();
    if (!trimmed || running) return;
    onGenerate(trimmed);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter submits; plain Enter keeps newlines.
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="pt-10 pb-7 text-center">
      <h1 className="mb-2 text-3xl font-semibold leading-tight tracking-tight">
        Ask once. Answer thrice. Trust the merge.
      </h1>
      <p className="mx-auto mb-6 max-w-[440px] text-[15px] leading-relaxed text-muted-foreground">
        One question, three models in parallel, one reconciled answer.
      </p>

      <div className="relative mx-auto max-w-[640px] text-left">
        <Textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask anything…"
          spellCheck={false}
          disabled={running}
          className="min-h-28 resize-none rounded-2xl pb-14 text-[15px] leading-relaxed"
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
    </div>
  );
}