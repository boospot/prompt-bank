"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type KeyboardShortcutsProps = {
  canCreatePrompt: boolean;
};

export function KeyboardShortcuts({ canCreatePrompt }: KeyboardShortcutsProps) {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const inEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        (target as HTMLElement)?.isContentEditable;

      if (event.key === "/" && !inEditable) {
        event.preventDefault();
        const searchInput = document.getElementById("prompt-search-input") as HTMLInputElement | null;
        searchInput?.focus();
        return;
      }

      if (event.key.toLowerCase() === "n" && !inEditable && canCreatePrompt) {
        event.preventDefault();
        router.push("/prompts/new");
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canCreatePrompt, router]);

  return null;
}
