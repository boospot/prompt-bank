import Link from "next/link";
import { UserRole } from "@prisma/client";
import {
  createUserAction,
  deleteUserAction,
  resetUserPasswordAction,
  unlockUserAction,
  updateUserRoleAction,
} from "@/app/actions";
import { requireSessionUser } from "@/lib/authz";
import { FormPersist } from "@/components/form-persist";
import { prisma } from "@/lib/prisma";

type UsersPageProps = {
  searchParams: Promise<{
    status?: string;
    error?: string;
  }>;
};

function statusMessage(status: string | undefined): string | null {
  if (!status) return null;
  if (status === "created") return "User created.";
  if (status === "updated") return "User role updated.";
  if (status === "password-reset") return "Password reset.";
  if (status === "unlocked") return "User unlocked.";
  if (status === "deleted") return "User deleted.";
  return null;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const currentUser = await requireSessionUser();
  if (currentUser.role !== UserRole.ADMIN) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
        <div className="mx-auto w-full max-w-4xl">
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Only admins can access User Management.
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
            >
              Back to library
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const message = statusMessage(params.status);

  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      failedLogins: true,
      lockedUntil: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          ownedPrompts: true,
          collaborations: true,
          savedPrompts: true,
        },
      },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 md:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">User Management</h1>
            <p className="mt-1 text-sm text-slate-600">Create users, change roles, reset passwords, and unlock accounts.</p>
          </div>
          <Link
            href="/"
            className="rounded-lg border border-black/15 px-4 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
          >
            Back to library
          </Link>
        </header>

        {message ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        ) : null}
        {params.error ? (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {decodeURIComponent(params.error)}
          </p>
        ) : null}

        <section className="mb-6 rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Create user</h2>
          <form id="create-user-form" action={createUserAction} className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            <FormPersist
              formId="create-user-form"
              storageKey="form:user-create"
              restoreOnMount={Boolean(params.error)}
              excludeNames={["password"]}
            />
            <label className="block space-y-1 lg:col-span-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Name</span>
              <input
                name="name"
                maxLength={80}
                placeholder="Optional"
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
              />
            </label>
            <label className="block space-y-1 lg:col-span-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Email</span>
              <input
                name="email"
                type="email"
                maxLength={254}
                required
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
              />
            </label>
            <label className="block space-y-1 lg:col-span-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Role</span>
              <select
                name="role"
                defaultValue={UserRole.VIEWER}
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
              >
                <option value={UserRole.ADMIN}>Admin</option>
                <option value={UserRole.EDITOR}>Editor</option>
                <option value={UserRole.VIEWER}>Viewer</option>
              </select>
            </label>
            <label className="block space-y-1 lg:col-span-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Temporary password</span>
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                required
                className="w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-black outline-none ring-indigo-300 transition focus:ring-2"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              >
                Create user
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Existing users</h2>
          <div className="mt-4 space-y-3">
            {users.map((user) => {
              const isSelf = user.id === currentUser.id;
              const isLocked = Boolean(user.lockedUntil && user.lockedUntil > new Date());
              return (
                <article key={user.id} className="rounded-xl border border-black/10 p-4">
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {user.name || "Unnamed user"}{" "}
                        <span className="font-normal text-slate-600">&lt;{user.email}&gt;</span>
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Created {user.createdAt.toLocaleString()}
                        {user.lastLoginAt ? ` · Last login ${user.lastLoginAt.toLocaleString()}` : " · Never logged in"}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Prompts: {user._count.ownedPrompts} owned, {user._count.collaborations} collaborations,{" "}
                        {user._count.savedPrompts} saved
                      </p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        isLocked ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isLocked ? "Locked" : "Active"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <form action={updateUserRoleAction} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <select
                        name="role"
                        defaultValue={user.role}
                        disabled={isSelf}
                        className="rounded-lg border border-black/15 px-3 py-2 text-sm text-black disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <option value={UserRole.ADMIN}>Admin</option>
                        <option value={UserRole.EDITOR}>Editor</option>
                        <option value={UserRole.VIEWER}>Viewer</option>
                      </select>
                      <button
                        type="submit"
                        disabled={isSelf}
                        className="rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Update role
                      </button>
                    </form>

                    <form action={resetUserPasswordAction} className="flex items-center gap-2">
                      <input type="hidden" name="userId" value={user.id} />
                      <input
                        name="password"
                        type="password"
                        minLength={12}
                        maxLength={128}
                        placeholder="New password"
                        required
                        className="rounded-lg border border-black/15 px-3 py-2 text-sm text-black"
                      />
                      <button
                        type="submit"
                        className="rounded-lg border border-black/15 px-3 py-2 text-sm font-medium text-black transition hover:bg-black/[0.03]"
                      >
                        Reset password
                      </button>
                    </form>

                    <form action={unlockUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        disabled={!isLocked}
                        className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Unlock
                      </button>
                    </form>

                    <form action={deleteUserAction}>
                      <input type="hidden" name="userId" value={user.id} />
                      <button
                        type="submit"
                        disabled={isSelf}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
