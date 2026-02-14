"use client";

import { useMemo, useState } from "react";

type PromptContentPreviewProps = {
  content: string;
  defaultLines?: number;
};

export function PromptContentPreview({ content, defaultLines = 8 }: PromptContentPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const lines = useMemo(() => content.split("\n"), [content]);
  const shouldCollapse = lines.length > defaultLines;
  const preview = shouldCollapse ? lines.slice(0, defaultLines).join("\n") : content;

  return (
    <div>
      <div className="relative">
        <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
          {expanded ? content : preview}
        </pre>
        {shouldCollapse && !expanded ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-lg bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent" />
        ) : null}
      </div>
      {shouldCollapse ? (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="motion-press mt-2 text-xs font-medium text-indigo-700 transition hover:text-indigo-600"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}
