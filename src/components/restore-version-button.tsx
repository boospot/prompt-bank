"use client";

import { useRef } from "react";

type RestoreVersionButtonProps = {
  promptId: string;
  versionId: string;
  versionLabel: string;
  onSubmitAction: (formData: FormData) => void;
};

export function RestoreVersionButton({
  promptId,
  versionId,
  versionLabel,
  onSubmitAction,
}: RestoreVersionButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function onRestoreClick() {
    const ok = window.confirm(
      `Restore ${versionLabel}? This will replace current prompt content and create a new history entry.`,
    );
    if (!ok) return;
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={onSubmitAction}>
      <input type="hidden" name="promptId" value={promptId} />
      <input type="hidden" name="versionId" value={versionId} />
      <button
        type="button"
        onClick={onRestoreClick}
        className="motion-press rounded-lg border border-black/15 px-3 py-2 text-xs font-medium text-black transition hover:bg-black/[0.03]"
      >
        Restore this version
      </button>
    </form>
  );
}
