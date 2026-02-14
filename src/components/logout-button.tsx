"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="motion-press rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/[0.03]"
    >
      Sign out
    </button>
  );
}
