"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyButtonProps {
  text: string;
  className?: string;
}

export function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? "Copied" : "Copy answer"}
      title={copied ? "Copied" : "Copy answer"}
      className={`flex size-5 flex-none items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-chip hover:text-foreground ${className ?? ""}`}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
    </button>
  );
}
