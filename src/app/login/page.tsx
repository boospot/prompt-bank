import { getAuthSession } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{ error?: string; callbackUrl?: string }>;
};

function safeCallbackPath(callbackPath?: string): string {
  if (!callbackPath) return "/";
  if (!callbackPath.startsWith("/") || callbackPath.startsWith("//")) return "/";
  if (callbackPath.startsWith("/login")) return "/";
  return callbackPath;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [session, params] = await Promise.all([getAuthSession(), searchParams]);
  const callbackUrl = safeCallbackPath(params.callbackUrl);
  if (session?.user?.id) {
    redirect(callbackUrl);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <section className="w-full max-w-md rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Prompt Bank Login</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in with your internal account.</p>

        <LoginForm
          initialError={params.error ? decodeURIComponent(params.error) : undefined}
          callbackUrl={callbackUrl}
        />
      </section>
    </main>
  );
}
