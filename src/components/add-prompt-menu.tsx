"use client";

import Link from "next/link";
import { useState } from "react";

export function AddPromptMenu() {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="motion-press rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
      >
        Add Prompt
      </button>

      {open ? (
        <div className="motion-enter absolute right-0 z-20 mt-2 w-64 rounded-xl border border-black/10 bg-white p-2 shadow-lg">
          <Link
            href="/prompts/new"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-slate-900 transition hover:bg-slate-100"
          >
            Create new prompt
          </Link>
          <a
            href="#prompt-list"
            onClick={() => setOpen(false)}
            className="block rounded-lg px-3 py-2 text-sm text-slate-900 transition hover:bg-slate-100"
          >
            Duplicate from existing prompt
          </a>
        </div>
      ) : null}
    </div>
  );
}
