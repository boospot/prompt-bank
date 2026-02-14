"use client";

import { useState } from "react";

type PromptCopyButtonProps = {
  content: string;
};

export function PromptCopyButton({ content }: PromptCopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`motion-press rounded-lg px-3 py-2 text-sm font-medium text-white transition ${
        copied ? "motion-pop bg-emerald-600 hover:bg-emerald-500" : "bg-indigo-600 hover:bg-indigo-500"
      }`}
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
