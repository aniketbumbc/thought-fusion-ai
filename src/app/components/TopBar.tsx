"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { BrainCircuit } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TopBar() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line
    setMounted(true)
  },[]);

  const isDark = resolvedTheme === "dark";

  return (
    <div className="flex items-center justify-between py-5">
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 items-center justify-center rounded-md bg-brand"
          style={{ boxShadow: "0 0 0 3px var(--brand-glow)" }}
        >
          <BrainCircuit className="size-5 text-white" strokeWidth={2.5} />
        </span>
        <span className="text-lg font-semibold tracking-tight">Thought Fusion </span>
        <span className="text-sm font-medium text-muted-foreground">
          Multi LLM Reasoner
        </span>
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="gap-2 text-xs font-semibold text-muted-foreground"
      >
        <span className="size-2 rounded-full bg-brand" />
        {mounted ? (isDark ? "Dark" : "Light") : "Theme"}
      </Button>
    </div>
  );
}