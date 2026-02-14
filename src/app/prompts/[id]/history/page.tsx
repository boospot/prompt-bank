import Link from "next/link";
import { notFound } from "next/navigation";
import { restorePromptVersionAction } from "@/app/actions";
import { RestoreVersionButton } from "@/components/restore-version-button";
import { canEditPrompt, canViewPrompt, requireSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type PromptHistoryPageProps = {
  params: Promise<{ id: string }>;
};

export default async function PromptHistoryPage({ params }: PromptHistoryPageProps) {
  const { id } = await params;
  const user = await requireSessionUser(`/prompts/${id}/history`);

  const prompt = await prisma.prompt.findUnique({
    where: { id },
    include: {
      collaborators: {
        select: { userId: true, role: true },
      },
      versions: {
        include: {
          changedBy: {
            select: { name: true, email: true },
          },
        },
        orderBy: { version: "desc" },
      },
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!prompt || !canViewPrompt(user, prompt)) {
    notFound();
  }
  const canRestore = canEditPrompt(user, prompt);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <section className="mx-auto w-full max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Prompt History</h1>
            <p className="text-sm text-slate-600">{prompt.title}</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/[0.03]"
          >
            Back to library
          </Link>
        </div>

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Versions</h2>
          <div className="mt-4 space-y-3">
            {prompt.versions.map((version) => (
              <article key={version.id} className="rounded-lg border border-black/10 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      v{version.version} · {version.status.toLowerCase()} · {version.visibility.toLowerCase()}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {version.createdAt.toLocaleString()} · by{" "}
                      {version.changedBy?.name || version.changedBy?.email || "system"}
                    </p>
                  </div>
                  {canRestore ? (
                    <RestoreVersionButton
                      promptId={prompt.id}
                      versionId={version.id}
                      versionLabel={`v${version.version}`}
                      onSubmitAction={restorePromptVersionAction}
                    />
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-slate-700">{version.description || "No description"}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Audit Trail</h2>
          <div className="mt-4 space-y-3">
            {prompt.auditLogs.map((entry) => (
              <article key={entry.id} className="rounded-lg border border-black/10 p-3">
                <p className="text-sm font-medium text-slate-900">{entry.action}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {entry.createdAt.toLocaleString()} · actor: {entry.actorId || "system"}
                </p>
                {entry.metadata ? <p className="mt-2 text-xs text-slate-600">{entry.metadata}</p> : null}
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
