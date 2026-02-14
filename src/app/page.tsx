import Link from "next/link";
import { PromptStatus, PromptVisibility, UserRole } from "@prisma/client";
import { deletePromptAction, duplicatePromptAction, toggleSavedAction } from "@/app/actions";
import { canCreatePrompt, canDeletePrompt, canEditPrompt, canManageCategories, requireSessionUser } from "@/lib/authz";
import { AddPromptMenu } from "@/components/add-prompt-menu";
import { CopyLinkButton } from "@/components/copy-link-button";
import { DuplicatePromptButton } from "@/components/duplicate-prompt-button";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { LogoutButton } from "@/components/logout-button";
import { PromptContentPreview } from "@/components/prompt-content-preview";
import { PromptCopyButton } from "@/components/prompt-copy-button";
import { prisma } from "@/lib/prisma";

type HomeProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    promptStatus?: string;
    visibility?: string;
    ownerScope?: string;
    onlySaved?: string;
    status?: string;
    error?: string;
  }>;
};

function statusMessage(status: string | undefined): string | null {
  if (!status) return null;
  if (status === "created") return "Prompt created successfully.";
  if (status === "updated") return "Prompt updated successfully.";
  if (status === "deleted") return "Prompt deleted successfully.";
  if (status === "saved-toggled") return "Prompt save status updated.";
  return null;
}

export default async function Home({ searchParams }: HomeProps) {
  const user = await requireSessionUser();
  const params = await searchParams;
  const query = params.q?.trim() ?? "";
  const category = params.category?.trim() ?? "";
  const filterStatus = params.promptStatus?.trim() ?? "";
  const filterVisibility = params.visibility?.trim() ?? "";
  const ownerScope = params.ownerScope?.trim() ?? "";
  const onlySaved = params.onlySaved === "true";
  const hasAdvancedFilters = Boolean(filterStatus || filterVisibility || ownerScope);
  const hasAnyFilters = Boolean(query || category || onlySaved || hasAdvancedFilters);
  const message = statusMessage(params.status && ["created", "updated", "deleted", "saved-toggled"].includes(params.status) ? params.status : undefined);

  const whereClauses: object[] = [];
  if (user.role !== UserRole.ADMIN) {
    whereClauses.push({
      OR: [
        { visibility: PromptVisibility.TEAM },
        { ownerId: user.id },
        { collaborators: { some: { userId: user.id } } },
      ],
    });
  }
  if (category) whereClauses.push({ categoryId: category });
  if (filterStatus) whereClauses.push({ status: filterStatus as PromptStatus });
  if (filterVisibility) whereClauses.push({ visibility: filterVisibility as PromptVisibility });
  if (ownerScope === "mine") whereClauses.push({ ownerId: user.id });
  if (onlySaved) whereClauses.push({ savedBy: { some: { userId: user.id } } });
  if (query) {
    whereClauses.push({
      OR: [
        { title: { contains: query } },
        { description: { contains: query } },
        { content: { contains: query } },
        { category: { name: { contains: query } } },
        { tags: { some: { tag: { name: { contains: query } } } } },
      ],
    });
  }

  const [categories, prompts] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.prompt.findMany({
      where: whereClauses.length > 0 ? { AND: whereClauses } : undefined,
      include: {
        category: { select: { name: true } },
        tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
        owner: { select: { id: true, name: true, email: true } },
        collaborators: {
          include: { user: { select: { id: true, email: true } } },
          orderBy: { user: { email: "asc" } },
        },
        savedBy: {
          where: { userId: user.id },
          select: { userId: true },
        },
        versions: {
          select: {
            createdAt: true,
            changedBy: {
              select: { name: true, email: true },
            },
          },
          orderBy: { version: "desc" },
          take: 1,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Prompt Bank</h1>
            <p className="mt-1 text-sm text-slate-600">
              Centralized internal prompt library for your team.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Signed in as {user.email} ({user.role.toLowerCase()})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {user.role === UserRole.ADMIN ? (
              <Link
                href="/users"
                className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/[0.03]"
              >
                User Management
              </Link>
            ) : null}
            {canManageCategories(user.role) ? (
              <Link
                href="/categories"
                className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/[0.03]"
              >
                Manage Categories
              </Link>
            ) : null}
            {canCreatePrompt(user.role) ? (
              <AddPromptMenu />
            ) : null}
            <LogoutButton />
          </div>
        </header>
        <KeyboardShortcuts canCreatePrompt={canCreatePrompt(user.role)} />

        {message ? (
          <p className="motion-enter mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {params.error ? (
          <p className="motion-enter mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {decodeURIComponent(params.error)}
          </p>
        ) : null}

        <section className="motion-enter mb-6 rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
          <form className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="block space-y-1 md:col-span-2 xl:col-span-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Search</span>
              <input
                id="prompt-search-input"
                name="q"
                defaultValue={query}
                placeholder="Search title, content, category, tag..."
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Category
              </span>
              <select
                name="category"
                defaultValue={category}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="block space-y-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Filters</span>
              <label className="flex h-10 w-full items-center gap-2 rounded-lg border border-black/15 px-3 text-sm text-black">
                <input
                  type="checkbox"
                  name="onlySaved"
                  value="true"
                  defaultChecked={onlySaved}
                  className="h-4 w-4 rounded border-black/30"
                />
                Only saved
              </label>
            </div>
            <details className="motion-disclosure md:col-span-2 xl:col-span-3" open={hasAdvancedFilters}>
              <summary className="motion-press cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500">
                More filters
              </summary>
              <div className="disclosure-panel mt-2">
                <div className="disclosure-content grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</span>
                  <select
                    name="promptStatus"
                    defaultValue={filterStatus}
                    className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
                  >
                    <option value="">All status</option>
                    <option value={PromptStatus.DRAFT}>Draft</option>
                    <option value={PromptStatus.APPROVED}>Approved</option>
                    <option value={PromptStatus.ARCHIVED}>Archived</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Visibility</span>
                  <select
                    name="visibility"
                    defaultValue={filterVisibility}
                    className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
                  >
                    <option value="">All visibility</option>
                    <option value={PromptVisibility.TEAM}>Team</option>
                    <option value={PromptVisibility.PRIVATE}>Private</option>
                  </select>
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Owner</span>
                  <select
                    name="ownerScope"
                    defaultValue={ownerScope}
                    className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
                  >
                    <option value="">Everyone</option>
                    <option value="mine">Only mine</option>
                  </select>
                </label>
                </div>
              </div>
            </details>
            <div className="flex gap-2 md:col-span-2 xl:col-span-6">
              <button
                type="submit"
                className="motion-press rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Apply Filters
              </button>
              <Link
                href="/"
                className="motion-press rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
              >
                Reset
              </Link>
            </div>
          </form>
        </section>

        <section className="mb-3 flex items-center justify-between">
          <p className="motion-pop text-sm text-slate-600">
            {prompts.length} result{prompts.length === 1 ? "" : "s"}
          </p>
        </section>

        <section id="prompt-list" className="grid gap-4">
          {prompts.length === 0 ? (
            <article className="rounded-2xl border border-dashed border-black/20 bg-white p-8 text-center text-sm text-slate-600">
              {hasAnyFilters ? "No prompts match these filters. Try Reset." : "No prompts yet."}
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {canCreatePrompt(user.role) ? (
                  <Link
                    href="/prompts/new"
                    className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
                  >
                    Create first prompt
                  </Link>
                ) : null}
                <a
                  href="#prompt-list"
                  className="rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/[0.03]"
                >
                  Browse existing templates
                </a>
              </div>
            </article>
          ) : (
            prompts.map((prompt) => (
              <article
                key={prompt.id}
                className="motion-card motion-enter w-full max-w-full overflow-hidden rounded-2xl border border-black/10 bg-white p-5 shadow-sm"
              >
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold text-slate-900">
                      <Link href={`/prompts/${prompt.id}`} className="transition hover:text-indigo-700">
                        {prompt.title}
                      </Link>
                    </h2>
                    {prompt.description ? (
                      <p className="mt-1 text-sm text-slate-600">{prompt.description}</p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="rounded-full bg-indigo-50 px-2 py-1 text-indigo-700">
                        {prompt.category.name}
                      </span>
                      {prompt.tags.map((item) => (
                        <span key={item.tagId} className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                          #{item.tag.name}
                        </span>
                      ))}
                      <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                        {prompt.status.toLowerCase()}
                      </span>
                      <span className="rounded-full bg-cyan-50 px-2 py-1 text-cyan-700">
                        {prompt.visibility.toLowerCase()}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
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
                            prompt.versions[0].changedBy?.name ||
                            prompt.versions[0].changedBy?.email ||
                            "system"
                          }`
                        : prompt.updatedAt.toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${
                      prompt.savedBy.length > 0
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {prompt.savedBy.length > 0 ? "Saved by you" : "Not saved"}
                  </span>
                </div>

                <PromptContentPreview content={prompt.content} />

                <div className="mt-4 flex flex-wrap gap-2">
                  <CopyLinkButton path={`/prompts/${prompt.id}`} label="Copy URL" />
                  <PromptCopyButton content={prompt.content} />
                  <form action={toggleSavedAction}>
                    <input type="hidden" name="promptId" value={prompt.id} />
                    <button
                      type="submit"
                      className="motion-press rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
                    >
                      {prompt.savedBy.length > 0 ? "Unsave" : "Save for later"}
                    </button>
                  </form>
                  {canEditPrompt(user, prompt) ? (
                    <Link
                      href={`/prompts/${prompt.id}/edit`}
                      className="motion-press rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canCreatePrompt(user.role) ? (
                    <DuplicatePromptButton
                      promptId={prompt.id}
                      defaultTitle={prompt.title}
                      onSubmitAction={duplicatePromptAction}
                    />
                  ) : null}
                  <Link
                    href={`/prompts/${prompt.id}/history`}
                    className="motion-press rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
                  >
                    History
                  </Link>
                  {canDeletePrompt(user, prompt) ? (
                    <form action={deletePromptAction}>
                      <input type="hidden" name="promptId" value={prompt.id} />
                      <button
                        type="submit"
                        className="motion-press rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
