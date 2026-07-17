import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { DocMarkdown } from "../components/DocMarkdown";

export const metadata: Metadata = {
  title: "Docs · Thought Fusion",
};

export default async function DocsPage() {
  const filePath = path.join(process.cwd(), "public", "documentation.md");
  const content = await readFile(filePath, "utf-8");

  return <DocMarkdown content={content} />;
}
