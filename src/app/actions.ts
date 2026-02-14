"use server";

import { CollaboratorRole, PromptStatus, PromptVisibility, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canCreatePrompt, canDeletePrompt, canEditPrompt, canManageCategories, canViewPrompt, requireSessionUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { promptSchema } from "@/lib/prompt-schema";
import { isStrongPassword, sanitizeAuditMetadata } from "@/lib/security";
import { parseEmails, parseTags } from "@/lib/tags";

function getPromptValues(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    content: String(formData.get("content") ?? ""),
    categoryId: String(formData.get("categoryId") ?? ""),
    tagsCsv: String(formData.get("tagsCsv") ?? ""),
    collaboratorEmailsCsv: String(formData.get("collaboratorEmailsCsv") ?? ""),
    visibility: (String(formData.get("visibility") ?? "TEAM") as PromptVisibility) ?? PromptVisibility.TEAM,
    status: (String(formData.get("status") ?? "DRAFT") as PromptStatus) ?? PromptStatus.DRAFT,
    isSaved: formData.get("isSaved") === "on",
  };
}

async function connectTags(tags: string[]) {
  return tags.map((tagName) => ({
    tag: {
      connectOrCreate: {
        where: { name: tagName },
        create: { name: tagName },
      },
    },
  }));
}

async function replacePromptTags(promptId: string, tags: string[]) {
  await prisma.prompt.update({
    where: { id: promptId },
    data: {
      tags: {
        deleteMany: {},
        create: await connectTags(tags),
      },
    },
  });
}

function redirectWithError(path: string, message: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(message)}`);
}

async function writeAuditLog(input: {
  actorId?: string;
  action: string;
  entityType: string;
  entityId: string;
  promptId?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      promptId: input.promptId,
      metadata: sanitizeAuditMetadata(input.metadata),
    },
  });
}

async function assertCategoryExists(categoryId: string) {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true },
  });

  if (!category) {
    throw new Error("Category not found.");
  }
}

async function createPromptVersion(promptId: string, changedById: string) {
  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      tags: {
        include: { tag: true },
        orderBy: { tag: { name: "asc" } },
      },
    },
  });

  if (!prompt) {
    return;
  }

  const latest = await prisma.promptVersion.findFirst({
    where: { promptId },
    orderBy: { version: "desc" },
    select: { version: true },
  });

  await prisma.promptVersion.create({
    data: {
      promptId,
      version: (latest?.version ?? 0) + 1,
      title: prompt.title,
      description: prompt.description,
      content: prompt.content,
      categoryId: prompt.categoryId,
      tagsCsv: prompt.tags.map((item) => item.tag.name).join(", "),
      visibility: prompt.visibility,
      status: prompt.status,
      changedById,
    },
  });
}

async function syncCollaborators(promptId: string, ownerId: string, emails: string[]) {
  if (emails.length === 0) {
    await prisma.promptCollaborator.deleteMany({ where: { promptId } });
    return { unknownEmails: [] as string[] };
  }

  const users = await prisma.user.findMany({
    where: { email: { in: emails } },
    select: { id: true, email: true },
  });

  const knownIds = users.map((user) => user.id).filter((id) => id !== ownerId);
  const knownEmails = new Set(users.map((user) => user.email));
  const unknownEmails = emails.filter((email) => !knownEmails.has(email));

  await prisma.promptCollaborator.deleteMany({
    where: {
      promptId,
      ...(knownIds.length > 0 ? { userId: { notIn: knownIds } } : {}),
    },
  });

  if (knownIds.length > 0) {
    await Promise.all(
      knownIds.map((userId) =>
        prisma.promptCollaborator.upsert({
          where: { promptId_userId: { promptId, userId } },
          update: { role: CollaboratorRole.EDIT },
          create: {
            promptId,
            userId,
            role: CollaboratorRole.EDIT,
          },
        }),
      ),
    );
  }

  return { unknownEmails };
}

export async function createPromptAction(formData: FormData) {
  const user = await requireSessionUser();
  if (!canCreatePrompt(user.role)) {
    redirectWithError("/", "You do not have permission to create prompts.");
  }

  const parsed = promptSchema.safeParse(getPromptValues(formData));

  if (!parsed.success) {
    const message = encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid prompt data.");
    redirect(`/prompts/new?error=${message}`);
  }

  const tags = parseTags(parsed.data.tagsCsv ?? "");
  const collaboratorEmails = parseEmails(parsed.data.collaboratorEmailsCsv ?? "");

  try {
    await assertCategoryExists(parsed.data.categoryId);

    const prompt = await prisma.prompt.create({
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        content: parsed.data.content,
        categoryId: parsed.data.categoryId,
        ownerId: user.id,
        visibility: parsed.data.visibility,
        status: parsed.data.status,
        tags: {
          create: await connectTags(tags),
        },
      },
    });

    await syncCollaborators(prompt.id, user.id, collaboratorEmails);
    await createPromptVersion(prompt.id, user.id);
    if (parsed.data.isSaved) {
      await prisma.savedPrompt.upsert({
        where: { promptId_userId: { promptId: prompt.id, userId: user.id } },
        update: {},
        create: { promptId: prompt.id, userId: user.id },
      });
    }
    await writeAuditLog({
      actorId: user.id,
      action: "prompt.create",
      entityType: "prompt",
      entityId: prompt.id,
      promptId: prompt.id,
      metadata: {
        visibility: parsed.data.visibility,
        status: parsed.data.status,
        collaboratorCount: collaboratorEmails.length,
      },
    });
  } catch {
    redirectWithError("/prompts/new", "Unable to create prompt. Please try again.");
  }

  revalidatePath("/");
  redirect("/?status=created");
}

export async function updatePromptAction(formData: FormData) {
  const user = await requireSessionUser();
  const promptId = String(formData.get("promptId") ?? "");

  if (!promptId) {
    redirect("/?error=Prompt%20not%20found");
  }

  const permissionPrompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      ownerId: true,
      visibility: true,
      collaborators: {
        select: { userId: true, role: true },
      },
    },
  });

  if (!permissionPrompt || !canEditPrompt(user, permissionPrompt)) {
    redirectWithError("/", "You do not have permission to update this prompt.");
  }
  const promptOwnerId = permissionPrompt.ownerId ?? user.id;

  const parsed = promptSchema.safeParse(getPromptValues(formData));
  if (!parsed.success) {
    const message = encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid prompt data.");
    redirect(`/prompts/${promptId}/edit?error=${message}`);
  }

  const tags = parseTags(parsed.data.tagsCsv ?? "");
  const collaboratorEmails = parseEmails(parsed.data.collaboratorEmailsCsv ?? "");

  try {
    await assertCategoryExists(parsed.data.categoryId);

    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        title: parsed.data.title,
        description: parsed.data.description || null,
        content: parsed.data.content,
        categoryId: parsed.data.categoryId,
        visibility: parsed.data.visibility,
        status: parsed.data.status,
      },
    });
    await replacePromptTags(promptId, tags);

    await syncCollaborators(promptId, promptOwnerId, collaboratorEmails);
    await createPromptVersion(promptId, user.id);
    if (parsed.data.isSaved) {
      await prisma.savedPrompt.upsert({
        where: { promptId_userId: { promptId, userId: user.id } },
        update: {},
        create: { promptId, userId: user.id },
      });
    } else {
      await prisma.savedPrompt.deleteMany({
        where: { promptId, userId: user.id },
      });
    }
    await writeAuditLog({
      actorId: user.id,
      action: "prompt.update",
      entityType: "prompt",
      entityId: promptId,
      promptId,
      metadata: {
        visibility: parsed.data.visibility,
        status: parsed.data.status,
        collaboratorCount: collaboratorEmails.length,
      },
    });
  } catch {
    redirectWithError(`/prompts/${promptId}/edit`, "Unable to update prompt. Please try again.");
  }

  revalidatePath("/");
  redirect("/?status=updated");
}

export async function deletePromptAction(formData: FormData) {
  const user = await requireSessionUser();
  const promptId = String(formData.get("promptId") ?? "");

  if (!promptId) {
    redirect("/?error=Prompt%20not%20found");
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: { ownerId: true },
  });

  if (!prompt || !canDeletePrompt(user, prompt)) {
    redirectWithError("/", "You do not have permission to delete this prompt.");
  }

  try {
    await prisma.prompt.delete({
      where: { id: promptId },
    });
    await writeAuditLog({
      actorId: user.id,
      action: "prompt.delete",
      entityType: "prompt",
      entityId: promptId,
    });
  } catch {
    redirectWithError("/", "Unable to delete prompt. It may no longer exist.");
  }

  revalidatePath("/");
  redirect("/?status=deleted");
}

export async function toggleSavedAction(formData: FormData) {
  const user = await requireSessionUser();
  const promptId = String(formData.get("promptId") ?? "");

  if (!promptId) {
    redirect("/?error=Prompt%20not%20found");
  }

  const prompt = await prisma.prompt.findUnique({
    where: { id: promptId },
    select: {
      ownerId: true,
      visibility: true,
      collaborators: {
        select: { userId: true, role: true },
      },
    },
  });

  if (!prompt || !canViewPrompt(user, prompt)) {
    redirect("/?error=Prompt%20not%20found");
  }

  try {
    const existing = await prisma.savedPrompt.findUnique({
      where: {
        promptId_userId: {
          promptId,
          userId: user.id,
        },
      },
    });

    if (existing) {
      await prisma.savedPrompt.delete({
        where: { promptId_userId: { promptId, userId: user.id } },
      });
    } else {
      await prisma.savedPrompt.create({
        data: { promptId, userId: user.id },
      });
    }

    await writeAuditLog({
      actorId: user.id,
      action: "prompt.toggleSaved",
      entityType: "prompt",
      entityId: promptId,
      promptId,
    });
  } catch {
    redirectWithError("/", "Unable to update saved state. Please try again.");
  }

  revalidatePath("/");
  redirect("/?status=saved-toggled");
}

export async function duplicatePromptAction(formData: FormData) {
  const user = await requireSessionUser();
  if (!canCreatePrompt(user.role)) {
    redirectWithError("/", "You do not have permission to duplicate prompts.");
  }

  const promptId = String(formData.get("promptId") ?? "");
  const duplicateTitle = String(formData.get("duplicateTitle") ?? "").trim();
  if (!promptId) {
    redirectWithError("/", "Prompt not found.");
  }

  const source = await prisma.prompt.findUnique({
    where: { id: promptId },
    include: {
      collaborators: {
        select: { userId: true, role: true },
      },
      tags: {
        include: { tag: true },
        orderBy: { tag: { name: "asc" } },
      },
    },
  });

  if (!source || !canViewPrompt(user, source)) {
    redirectWithError("/", "You do not have permission to duplicate this prompt.");
  }

  try {
    const finalTitle = duplicateTitle.length >= 3 && duplicateTitle.length <= 120
      ? duplicateTitle
      : `${source.title} (Copy)`;

    const duplicated = await prisma.prompt.create({
      data: {
        title: finalTitle,
        description: source.description,
        content: source.content,
        categoryId: source.categoryId,
        ownerId: user.id,
        visibility: source.visibility,
        status: PromptStatus.DRAFT,
        tags: {
          create: source.tags.map((item) => ({
            tag: {
              connectOrCreate: {
                where: { name: item.tag.name },
                create: { name: item.tag.name },
              },
            },
          })),
        },
      },
    });

    await prisma.savedPrompt.upsert({
      where: {
        promptId_userId: { promptId: duplicated.id, userId: user.id },
      },
      update: {},
      create: { promptId: duplicated.id, userId: user.id },
    });

    await createPromptVersion(duplicated.id, user.id);
    await writeAuditLog({
      actorId: user.id,
      action: "prompt.duplicate",
      entityType: "prompt",
      entityId: duplicated.id,
      promptId: duplicated.id,
      metadata: {
        sourcePromptId: source.id,
      },
    });
  } catch {
    redirectWithError("/", "Unable to duplicate prompt. Please try again.");
  }

  revalidatePath("/");
  redirect("/?status=created");
}

export async function restorePromptVersionAction(formData: FormData) {
  const user = await requireSessionUser();
  const versionId = String(formData.get("versionId") ?? "");
  const promptId = String(formData.get("promptId") ?? "");

  if (!versionId || !promptId) {
    redirectWithError("/", "Version not found.");
  }

  const version = await prisma.promptVersion.findUnique({
    where: { id: versionId },
    include: {
      prompt: {
        select: {
          id: true,
          ownerId: true,
          visibility: true,
          collaborators: {
            select: { userId: true, role: true },
          },
        },
      },
    },
  });

  if (!version || !version.prompt || version.prompt.id !== promptId) {
    redirectWithError("/", "Version not found.");
  }

  if (!canEditPrompt(user, version.prompt)) {
    redirectWithError("/", "You do not have permission to restore this version.");
  }

  const tags = parseTags(version.tagsCsv);

  try {
    await assertCategoryExists(version.categoryId);

    await prisma.prompt.update({
      where: { id: promptId },
      data: {
        title: version.title,
        description: version.description,
        content: version.content,
        categoryId: version.categoryId,
        visibility: version.visibility,
        status: version.status,
      },
    });
    await replacePromptTags(promptId, tags);
    await createPromptVersion(promptId, user.id);

    await writeAuditLog({
      actorId: user.id,
      action: "prompt.restoreVersion",
      entityType: "prompt",
      entityId: promptId,
      promptId,
      metadata: {
        restoredFromVersionId: versionId,
        restoredVersionNumber: version.version,
      },
    });
  } catch {
    redirectWithError(`/prompts/${promptId}/history`, "Unable to restore this version.");
  }

  revalidatePath("/");
  revalidatePath(`/prompts/${promptId}/history`);
  redirect(`/?status=updated`);
}

export async function createCategoryAction(formData: FormData) {
  const user = await requireSessionUser();
  if (!canManageCategories(user.role)) {
    redirectWithError("/", "You do not have permission to manage categories.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (name.length < 2 || name.length > 60) {
    redirectWithError("/categories", "Category name must be between 2 and 60 characters.");
  }

  try {
    const category = await prisma.category.create({
      data: {
        name,
        description: description || null,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "category.create",
      entityType: "category",
      entityId: category.id,
    });
  } catch {
    redirectWithError("/categories", "Unable to create category. Name may already exist.");
  }

  revalidatePath("/");
  revalidatePath("/categories");
  redirect("/categories?status=created");
}

export async function deleteCategoryAction(formData: FormData) {
  const user = await requireSessionUser();
  if (!canManageCategories(user.role)) {
    redirectWithError("/", "You do not have permission to manage categories.");
  }

  const categoryId = String(formData.get("categoryId") ?? "");
  if (!categoryId) {
    redirectWithError("/categories", "Category not found.");
  }

  try {
    await prisma.category.delete({ where: { id: categoryId } });
    await writeAuditLog({
      actorId: user.id,
      action: "category.delete",
      entityType: "category",
      entityId: categoryId,
    });
  } catch {
    redirectWithError("/categories", "Unable to delete category. It might be used by prompts.");
  }

  revalidatePath("/");
  revalidatePath("/categories");
  redirect("/categories?status=deleted");
}

async function assertAdminUser() {
  const user = await requireSessionUser();
  if (user.role !== UserRole.ADMIN) {
    redirectWithError("/", "Only admins can manage users.");
  }
  return user;
}

async function assertAtLeastOneAdminRemains(excludingUserId?: string) {
  const adminCount = await prisma.user.count({
    where: {
      role: UserRole.ADMIN,
      ...(excludingUserId ? { id: { not: excludingUserId } } : {}),
    },
  });

  if (adminCount < 1) {
    throw new Error("At least one admin user must remain.");
  }
}

export async function createUserAction(formData: FormData) {
  const actor = await assertAdminUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const roleValue = String(formData.get("role") ?? UserRole.VIEWER);
  const password = String(formData.get("password") ?? "");
  const role = Object.values(UserRole).includes(roleValue as UserRole)
    ? (roleValue as UserRole)
    : UserRole.VIEWER;

  if (!email || email.length > 254 || !email.includes("@")) {
    redirectWithError("/users", "Provide a valid email.");
  }
  if (!isStrongPassword(password)) {
    redirectWithError(
      "/users",
      "Password must be 12-128 chars and include upper, lower, number, and symbol.",
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    const created = await prisma.user.create({
      data: {
        name: name || null,
        email,
        role,
        passwordHash,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "user.create",
      entityType: "user",
      entityId: created.id,
      metadata: { role: created.role, email: created.email },
    });
  } catch {
    redirectWithError("/users", "Unable to create user. Email may already exist.");
  }

  revalidatePath("/users");
  redirect("/users?status=created");
}

export async function updateUserRoleAction(formData: FormData) {
  const actor = await assertAdminUser();
  const userId = String(formData.get("userId") ?? "");
  const roleValue = String(formData.get("role") ?? "");
  if (!userId || !Object.values(UserRole).includes(roleValue as UserRole)) {
    redirectWithError("/users", "Invalid role update request.");
  }
  const role = roleValue as UserRole;

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!target) {
    redirectWithError("/users", "User not found.");
  }

  if (target.role === UserRole.ADMIN && role !== UserRole.ADMIN) {
    await assertAtLeastOneAdminRemains(userId);
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "user.role_update",
      entityType: "user",
      entityId: userId,
      metadata: {
        previousRole: target.role,
        nextRole: role,
        email: target.email,
      },
    });
  } catch {
    redirectWithError("/users", "Unable to update user role.");
  }

  revalidatePath("/users");
  redirect("/users?status=updated");
}

export async function resetUserPasswordAction(formData: FormData) {
  const actor = await assertAdminUser();
  const userId = String(formData.get("userId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!userId) {
    redirectWithError("/users", "User not found.");
  }
  if (!isStrongPassword(password)) {
    redirectWithError(
      "/users",
      "Password must be 12-128 chars and include upper, lower, number, and symbol.",
    );
  }

  try {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "user.password_reset",
      entityType: "user",
      entityId: userId,
    });
  } catch {
    redirectWithError("/users", "Unable to reset password.");
  }

  revalidatePath("/users");
  redirect("/users?status=password-reset");
}

export async function unlockUserAction(formData: FormData) {
  const actor = await assertAdminUser();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) {
    redirectWithError("/users", "User not found.");
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        failedLogins: 0,
        lockedUntil: null,
      },
    });

    await writeAuditLog({
      actorId: actor.id,
      action: "user.unlock",
      entityType: "user",
      entityId: userId,
    });
  } catch {
    redirectWithError("/users", "Unable to unlock user.");
  }

  revalidatePath("/users");
  redirect("/users?status=unlocked");
}

export async function deleteUserAction(formData: FormData) {
  const actor = await assertAdminUser();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) {
    redirectWithError("/users", "User not found.");
  }
  if (userId === actor.id) {
    redirectWithError("/users", "You cannot delete your own account.");
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true },
  });
  if (!target) {
    redirectWithError("/users", "User not found.");
  }
  if (target.role === UserRole.ADMIN) {
    await assertAtLeastOneAdminRemains(userId);
  }

  try {
    await prisma.user.delete({ where: { id: userId } });
    await writeAuditLog({
      actorId: actor.id,
      action: "user.delete",
      entityType: "user",
      entityId: userId,
      metadata: { email: target.email, role: target.role },
    });
  } catch {
    redirectWithError("/users", "Unable to delete user.");
  }

  revalidatePath("/users");
  redirect("/users?status=deleted");
}
