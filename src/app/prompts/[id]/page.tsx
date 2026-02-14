import Link from "next/link";
import { redirect } from "next/navigation";
import { canEditPrompt, canViewPrompt, requireSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { CopyLinkButton } from "@/components/copy-link-button";
import { PromptCopyButton } from "@/components/prompt-copy-button";

type PromptPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PromptPage({ params }: PromptPageProps) {
  const { id } = await params;
  const user = await requireSessionUser(`/prompts/${id}`);

  const prompt = await prisma.prompt.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      tags: {
        include: { tag: true },
        orderBy: { tag: { name: "asc" } },
      },
      owner: { select: { name: true, email: true } },
      collaborators: {
        include: { user: { select: { email: true } } },
        orderBy: { user: { email: "asc" } },
      },
      versions: {
        select: {
          createdAt: true,
          changedBy: { select: { name: true, email: true } },
        },
        orderBy: { version: "desc" },
        take: 1,
      },
    },
  });

  if (!prompt || !canViewPrompt(user, prompt)) {
    redirect("/?error=Prompt%20not%20found");
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{prompt.title}</h1>
            {prompt.description ? <p className="mt-1 text-sm text-slate-600">{prompt.description}</p> : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CopyLinkButton path={`/prompts/${prompt.id}`} />
            <PromptCopyButton content={prompt.content} />
            {canEditPrompt(user, prompt) ? (
              <Link
                href={`/prompts/${prompt.id}/edit`}
                className="rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
              >
                Edit
              </Link>
            ) : null}
            <Link
              href={`/prompts/${prompt.id}/history`}
              className="rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
            >
              History
            </Link>
            <Link
              href="/"
              className="rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
            >
              Back to library
            </Link>
          </div>
        </header>

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">{prompt.category.name}</span>
            <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">{prompt.status.toLowerCase()}</span>
            <span className="rounded-full bg-cyan-50 px-2 py-1 text-cyan-700">
              {prompt.visibility.toLowerCase()}
            </span>
            {prompt.tags.map((item) => (
              <span key={item.tagId} className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                #{item.tag.name}
              </span>
            ))}
          </div>

          <p className="text-xs text-slate-500">
            Owner: {prompt.owner?.name || prompt.owner?.email || "Unassigned"}
          </p>
          {prompt.collaborators.length > 0 ? (
            <p className="mt-1 text-xs text-slate-500">
              Collaborators: {prompt.collaborators.map((item) => item.user.email).join(", ")}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">
            Updated{" "}
            {prompt.versions[0]?.createdAt
              ? `${prompt.versions[0].createdAt.toLocaleString()} by ${
                  prompt.versions[0].changedBy?.name || prompt.versions[0].changedBy?.email || "system"
                }`
              : prompt.updatedAt.toLocaleString()}
          </p>

          <pre className="mt-4 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
            {prompt.content}
          </pre>
        </section>
      </div>
    </main>
  );
}
