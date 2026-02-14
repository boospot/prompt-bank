import { CollaboratorRole, Prompt, UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { getAuthSession } from "@/auth";

export type SessionUser = {
  id: string;
  role: UserRole;
  email: string;
  name?: string | null;
};

function safeCallbackPath(callbackPath?: string): string {
  if (!callbackPath) return "/";
  if (!callbackPath.startsWith("/") || callbackPath.startsWith("//")) return "/";
  if (callbackPath.startsWith("/login")) return "/";
  return callbackPath;
}

export async function requireSessionUser(callbackPath?: string): Promise<SessionUser> {
  const session = await getAuthSession();
  const user = session?.user;

  if (!user?.id || !user?.email || !user.role) {
    const nextPath = safeCallbackPath(callbackPath);
    redirect(`/login?callbackUrl=${encodeURIComponent(nextPath)}`);
  }

  return {
    id: user.id,
    role: user.role,
    email: user.email,
    name: user.name,
  };
}

export function canManageCategories(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.EDITOR;
}

export function canCreatePrompt(role: UserRole) {
  return role === UserRole.ADMIN || role === UserRole.EDITOR;
}

type AccessPrompt = Pick<Prompt, "ownerId" | "visibility"> & {
  collaborators: { userId: string; role: CollaboratorRole }[];
};

export function canViewPrompt(user: SessionUser, prompt: AccessPrompt): boolean {
  if (user.role === UserRole.ADMIN) return true;
  if (prompt.ownerId && prompt.ownerId === user.id) return true;
  if (prompt.visibility === "TEAM") return true;
  return prompt.collaborators.some((collaborator) => collaborator.userId === user.id);
}

export function canEditPrompt(user: SessionUser, prompt: AccessPrompt): boolean {
  if (user.role === UserRole.ADMIN) return true;
  if (prompt.ownerId && prompt.ownerId === user.id) return true;
  return prompt.collaborators.some(
    (collaborator) => collaborator.userId === user.id && collaborator.role === CollaboratorRole.EDIT,
  );
}

export function canDeletePrompt(user: SessionUser, prompt: Pick<Prompt, "ownerId">): boolean {
  if (user.role === UserRole.ADMIN) return true;
  return Boolean(prompt.ownerId && prompt.ownerId === user.id);
}
