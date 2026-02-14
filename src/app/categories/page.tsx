import Link from "next/link";
import { createCategoryAction, deleteCategoryAction } from "@/app/actions";
import { FormPersist } from "@/components/form-persist";
import { canManageCategories, requireSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type CategoriesPageProps = {
  searchParams: Promise<{ status?: string; error?: string }>;
};

function getMessage(status?: string) {
  if (status === "created") return "Category created.";
  if (status === "deleted") return "Category deleted.";
  return null;
}

export default async function CategoriesPage({ searchParams }: CategoriesPageProps) {
  const [params, user, categories] = await Promise.all([
    searchParams,
    requireSessionUser(),
    prisma.category.findMany({
      include: {
        _count: { select: { prompts: true } },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!canManageCategories(user.role)) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <section className="mx-auto w-full max-w-3xl rounded-2xl border border-red-200 bg-white p-6 text-red-700 shadow-sm">
          You do not have permission to manage categories.
          <div className="mt-4">
            <Link className="text-indigo-600 underline" href="/">
              Back to library
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const message = getMessage(params.status);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <section className="mx-auto w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Category Governance</h1>
            <p className="text-sm text-slate-600">Manage the prompt taxonomy used across your team.</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-black/[0.03]"
          >
            Back to library
          </Link>
        </div>

        {message ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {params.error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {decodeURIComponent(params.error)}
          </p>
        ) : null}

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Create Category</h2>
          <form id="create-category-form" action={createCategoryAction} className="mt-4 grid gap-3 md:grid-cols-3">
            <FormPersist
              formId="create-category-form"
              storageKey="form:category-create"
              restoreOnMount={Boolean(params.error)}
            />
            <input
              type="text"
              name="name"
              required
              placeholder="Category name"
              className="rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
            />
            <input
              type="text"
              name="description"
              placeholder="Optional description"
              className="rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500"
            >
              Add Category
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Existing Categories</h2>
          <div className="mt-4 space-y-3">
            {categories.map((category) => (
              <article
                key={category.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-black/10 px-3 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">{category.name}</p>
                  <p className="text-xs text-slate-600">{category.description || "No description"}</p>
                  <p className="mt-1 text-xs text-slate-500">{category._count.prompts} prompts</p>
                </div>
                <form action={deleteCategoryAction}>
                  <input type="hidden" name="categoryId" value={category.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100"
                  >
                    Delete
                  </button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
