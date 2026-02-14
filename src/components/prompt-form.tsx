import Link from "next/link";
import { PromptStatus, PromptVisibility } from "@prisma/client";
import { FormPersist } from "@/components/form-persist";
import { FormSubmitButton } from "@/components/form-submit-button";

type CategoryOption = {
  id: string;
  name: string;
};

type PromptFormValues = {
  id?: string;
  title: string;
  description: string;
  content: string;
  categoryId: string;
  tagsCsv: string;
  collaboratorEmailsCsv: string;
  visibility: PromptVisibility;
  status: PromptStatus;
  isSaved: boolean;
};

type PromptFormProps = {
  title: string;
  subtitle: string;
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
  categories: CategoryOption[];
  values: PromptFormValues;
  error?: string;
  canManageCollaborators: boolean;
  persistKey: string;
};

export function PromptForm({
  title,
  subtitle,
  action,
  submitLabel,
  categories,
  values,
  error,
  canManageCollaborators,
  persistKey,
}: PromptFormProps) {
  const formId = `prompt-form-${persistKey}`;
  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-black/10 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-black">{title}</h1>
        <p className="mt-1 text-sm text-black/60">{subtitle}</p>
        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      <form id={formId} action={action} className="space-y-4">
        <FormPersist formId={formId} storageKey={`form:${persistKey}`} restoreOnMount={Boolean(error)} />
        {values.id ? <input type="hidden" name="promptId" value={values.id} /> : null}

        <label className="block space-y-1">
          <span className="text-sm font-medium text-black">Title</span>
          <input
            name="title"
            defaultValue={values.title}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
            placeholder="e.g., Release notes summarizer"
            required
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-black">Description</span>
          <input
            name="description"
            defaultValue={values.description}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
            placeholder="Optional context for your team"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-black">Prompt Content</span>
          <textarea
            name="content"
            defaultValue={values.content}
            rows={10}
            className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
            placeholder="Write the reusable prompt your team can copy..."
            required
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-black">Category</span>
            <select
              name="categoryId"
              defaultValue={values.categoryId}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
              required
            >
              <option value="" disabled>
                Select category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-black">Tags</span>
            <input
              name="tagsCsv"
              defaultValue={values.tagsCsv}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
              placeholder="e.g., marketing, launch, b2b"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium text-black">Visibility</span>
            <select
              name="visibility"
              defaultValue={values.visibility}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
            >
              <option value={PromptVisibility.TEAM}>Team</option>
              <option value={PromptVisibility.PRIVATE}>Private</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium text-black">Status</span>
            <select
              name="status"
              defaultValue={values.status}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
            >
              <option value={PromptStatus.DRAFT}>Draft</option>
              <option value={PromptStatus.APPROVED}>Approved</option>
              <option value={PromptStatus.ARCHIVED}>Archived</option>
            </select>
          </label>
        </div>

        {canManageCollaborators ? (
          <label className="block space-y-1">
            <span className="text-sm font-medium text-black">Collaborators (emails)</span>
            <input
              name="collaboratorEmailsCsv"
              defaultValue={values.collaboratorEmailsCsv}
              className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
              placeholder="alice@company.com, bob@company.com"
            />
          </label>
        ) : null}

        <label className="inline-flex items-center gap-2 text-sm text-black">
          <input
            type="checkbox"
            name="isSaved"
            defaultChecked={values.isSaved}
            className="h-4 w-4 rounded border-black/30"
          />
          Save for later use
        </label>

        <div className="flex items-center gap-3 pt-2">
          <FormSubmitButton
            label={submitLabel}
            pendingLabel="Saving..."
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
          />
          <Link
            href="/"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
          >
            Back to library
          </Link>
        </div>
      </form>
    </section>
  );
}
