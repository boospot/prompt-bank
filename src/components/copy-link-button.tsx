"use client";

import { useState } from "react";

type CopyLinkButtonProps = {
  path: string;
  label?: string;
};

export function CopyLinkButton({ path, label = "Copy share URL" }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    try {
      const value = `${window.location.origin}${path}`;
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`motion-press rounded-lg border px-3 py-2 text-sm font-medium transition ${
        copied
          ? "motion-pop border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-black/15 text-black hover:bg-black/[0.03]"
      }`}
    >
      {copied ? "Copied URL" : label}
    </button>
  );
}
