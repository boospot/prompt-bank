"use client";

import { useRef } from "react";

type DuplicatePromptButtonProps = {
  promptId: string;
  defaultTitle: string;
  onSubmitAction: (formData: FormData) => void;
};

export function DuplicatePromptButton({
  promptId,
  defaultTitle,
  onSubmitAction,
}: DuplicatePromptButtonProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function onDuplicateClick() {
    const nextTitle = window.prompt("Name for duplicated prompt", `${defaultTitle} (Copy)`);
    if (!nextTitle) return;

    if (titleRef.current) {
      titleRef.current.value = nextTitle;
    }
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={onSubmitAction}>
      <input type="hidden" name="promptId" value={promptId} />
      <input ref={titleRef} type="hidden" name="duplicateTitle" value={`${defaultTitle} (Copy)`} />
      <button
        type="button"
        onClick={onDuplicateClick}
        className="motion-press rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
      >
        Duplicate
      </button>
    </form>
  );
}
