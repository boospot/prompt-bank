import { notFound } from "next/navigation";
import { updatePromptAction } from "@/app/actions";
import { PromptForm } from "@/components/prompt-form";
import { canEditPrompt, requireSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { tagsToCsv } from "@/lib/tags";

type EditPromptPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditPromptPage({ params, searchParams }: EditPromptPageProps) {
  const { id } = await params;
  const [query, user] = await Promise.all([
    searchParams,
    requireSessionUser(`/prompts/${id}/edit`),
  ]);

  const [categories, prompt] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.prompt.findUnique({
      where: { id },
      include: {
        tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
        collaborators: {
          include: { user: { select: { email: true } } },
          orderBy: { user: { email: "asc" } },
        },
        savedBy: {
          where: { userId: user.id },
          select: { userId: true },
        },
      },
    }),
  ]);

  if (!prompt) {
    notFound();
  }

  if (!canEditPrompt(user, prompt)) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <PromptForm
        title="Edit Prompt"
        subtitle="Update prompt details, category, and tags."
        action={updatePromptAction}
        submitLabel="Save Changes"
        categories={categories}
        error={query.error ? decodeURIComponent(query.error) : undefined}
        values={{
          id: prompt.id,
          title: prompt.title,
          description: prompt.description ?? "",
          content: prompt.content,
          categoryId: prompt.categoryId,
          tagsCsv: tagsToCsv(prompt.tags.map((item) => item.tag.name)),
          collaboratorEmailsCsv: prompt.collaborators.map((item) => item.user.email).join(", "),
          visibility: prompt.visibility,
          status: prompt.status,
          isSaved: prompt.savedBy.length > 0,
        }}
        canManageCollaborators={true}
        persistKey={`prompt-edit-${id}`}
      />
    </main>
  );
}
