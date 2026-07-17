"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { TopBar } from "./TopBar";
import { Markdown } from "./Markdown";

interface DocMarkdownProps {
  content: string;
}

export function DocMarkdown({ content }: DocMarkdownProps) {
  return (
    <div className="flex min-h-screen flex-col px-6">
      <div className="mx-auto w-full max-w-[860px]">
        <TopBar />
      </div>

      <div className="mx-auto w-full max-w-[860px] flex-1 pb-16">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to app
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
          <Markdown className="text-[14px]">{content}</Markdown>
        </div>
      </div>
    </div>
  );
}
