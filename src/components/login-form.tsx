"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

type LoginFormProps = {
  initialError?: string;
  callbackUrl?: string;
};

function safeCallbackPath(callbackPath?: string): string {
  if (!callbackPath) return "/";
  if (!callbackPath.startsWith("/") || callbackPath.startsWith("//")) return "/";
  if (callbackPath.startsWith("/login")) return "/";
  return callbackPath;
}

export function LoginForm({ initialError, callbackUrl }: LoginFormProps) {
  const [error, setError] = useState(initialError ?? "");
  const [pending, setPending] = useState(false);
  const targetCallbackUrl = safeCallbackPath(callbackUrl);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError("");

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    const result = await signIn("credentials", {
      email,
      password,
      callbackUrl: targetCallbackUrl,
      redirect: false,
    });

    if (!result || result.error) {
      setError("Invalid credentials");
      setPending(false);
      return;
    }

    window.location.href = result.url ?? targetCallbackUrl;
  }

  return (
    <form
      action={onSubmit}
      className="mt-5 space-y-4"
    >
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}
      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-900">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          maxLength={254}
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
          placeholder="you@company.com"
          required
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-slate-900">Password</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          maxLength={128}
          className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
          placeholder="••••••••"
          required
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {pending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
