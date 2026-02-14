import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import { sanitizeAuditMetadata } from "@/lib/security";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const ACCOUNT_LOCK_MINUTES = 15;

async function writeAuthAuditLog(input: {
  actorId?: string;
  action: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: "auth",
        entityId: input.entityId,
        metadata: sanitizeAuditMetadata(input.metadata),
      },
    });
  } catch {
    // Avoid blocking auth flow due to audit storage failures.
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
    updateAge: 30 * 60,
  },
  jwt: {
    maxAge: 8 * 60 * 60,
  },
  useSecureCookies: process.env.NODE_ENV === "production",
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials) {
          return null;
        }

        const email = String(credentials.email ?? "").toLowerCase().trim();
        const password = String(credentials.password ?? "");

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
        });

        if (!user) {
          await writeAuthAuditLog({
            action: "auth.login_failed",
            entityId: email || "unknown",
            metadata: { reason: "user_not_found" },
          });
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await writeAuthAuditLog({
            actorId: user.id,
            action: "auth.login_blocked",
            entityId: user.id,
            metadata: { lockedUntil: user.lockedUntil.toISOString() },
          });
          return null;
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          const failedLogins = user.failedLogins + 1;
          const lockAccount = failedLogins >= MAX_FAILED_LOGIN_ATTEMPTS;
          const lockedUntil = lockAccount
            ? new Date(Date.now() + ACCOUNT_LOCK_MINUTES * 60 * 1000)
            : null;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLogins: failedLogins,
              lockedUntil,
            },
          });

          await writeAuthAuditLog({
            actorId: user.id,
            action: lockAccount ? "auth.locked" : "auth.login_failed",
            entityId: user.id,
            metadata: {
              failedLogins,
              lockAccount,
              lockedUntil: lockedUntil?.toISOString() ?? null,
            },
          });
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLogins: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        await writeAuthAuditLog({
          actorId: user.id,
          action: "auth.login_success",
          entityId: user.id,
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ] as NextAuthOptions["providers"],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role as UserRole;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.id ?? "");
        session.user.role = (token.role as UserRole | undefined) ?? UserRole.VIEWER;
      }
      return session;
    },
  },
};

export function getAuthSession() {
  return getServerSession(authOptions);
}
