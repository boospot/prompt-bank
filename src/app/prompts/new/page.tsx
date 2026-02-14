import { PromptStatus, PromptVisibility } from "@prisma/client";
import { redirect } from "next/navigation";
import { createPromptAction } from "@/app/actions";
import { PromptForm } from "@/components/prompt-form";
import { canCreatePrompt, requireSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

type NewPromptPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewPromptPage({ searchParams }: NewPromptPageProps) {
  const [params, user] = await Promise.all([searchParams, requireSessionUser()]);
  if (!canCreatePrompt(user.role)) {
    redirect("/?error=You%20do%20not%20have%20permission%20to%20create%20prompts.");
  }

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <PromptForm
        title="Create Prompt"
        subtitle="Add a reusable prompt for your internal team."
        action={createPromptAction}
        submitLabel="Create Prompt"
        categories={categories}
        error={params.error ? decodeURIComponent(params.error) : undefined}
        values={{
          title: "",
          description: "",
          content: "",
          categoryId: categories[0]?.id ?? "",
          tagsCsv: "",
          collaboratorEmailsCsv: "",
          visibility: PromptVisibility.TEAM,
          status: PromptStatus.DRAFT,
          isSaved: true,
        }}
        canManageCollaborators={true}
        persistKey="prompt-new"
      />
    </main>
  );
}
