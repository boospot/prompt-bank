import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PromptStatus, PromptVisibility, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { isStrongPassword } from "../src/lib/security";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  }),
});

async function main() {
  const users = [
    { email: "admin@promptbank.local", name: "Admin User", password: "Admin@12345!!", role: UserRole.ADMIN },
    { email: "editor@promptbank.local", name: "Editor User", password: "Editor@12345!!", role: UserRole.EDITOR },
    { email: "viewer@promptbank.local", name: "Viewer User", password: "Viewer@12345!!", role: UserRole.VIEWER },
  ];

  for (const user of users) {
    if (!isStrongPassword(user.password)) {
      throw new Error(`Seed password for ${user.email} does not meet security policy.`);
    }

    const passwordHash = await bcrypt.hash(user.password, 12);
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
        failedLogins: 0,
        lockedUntil: null,
      },
    });
  }

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@promptbank.local" },
  });
  const editor = await prisma.user.findUniqueOrThrow({
    where: { email: "editor@promptbank.local" },
  });

  const categories = [
    {
      name: "Marketing",
      description: "Campaign, ad copy, messaging, and audience positioning prompts.",
    },
    {
      name: "Engineering",
      description: "Code generation, debugging, design review, and architecture prompts.",
    },
    {
      name: "Customer Success",
      description: "Customer response, onboarding, and support workflow prompts.",
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: { description: category.description },
      create: category,
    });
  }

  const marketing = await prisma.category.findUniqueOrThrow({
    where: { name: "Marketing" },
  });
  const engineering = await prisma.category.findUniqueOrThrow({
    where: { name: "Engineering" },
  });

  const starterPrompts = [
    {
      title: "Launch email campaign draft",
      description: "Generate a structured launch email in brand tone.",
      content:
        "You are our senior lifecycle marketer. Draft a launch email for [product] aimed at [audience]. Keep tone [brand tone]. Include subject line options, preview text, body copy, CTA, and an A/B test idea.",
      categoryId: marketing.id,
      ownerId: admin.id,
      tags: ["email", "launch", "gtm"],
      visibility: PromptVisibility.TEAM,
      status: PromptStatus.APPROVED,
      savedByUserId: admin.id,
    },
    {
      title: "Code review checklist assistant",
      description: "Return prioritized code review comments with risk levels.",
      content:
        "Act as a principal engineer. Review the pull request diff below. Return findings grouped by severity: critical, major, minor, nit. Include concrete fix suggestions and test gaps.",
      categoryId: engineering.id,
      ownerId: editor.id,
      tags: ["code-review", "quality", "testing"],
      visibility: PromptVisibility.TEAM,
      status: PromptStatus.DRAFT,
      savedByUserId: editor.id,
    },
  ];

  for (const prompt of starterPrompts) {
    const created = await prisma.prompt.upsert({
      where: { id: `seed-${prompt.title.toLowerCase().replace(/\s+/g, "-")}` },
      update: {
        title: prompt.title,
        description: prompt.description,
        content: prompt.content,
        categoryId: prompt.categoryId,
        ownerId: prompt.ownerId,
        visibility: prompt.visibility,
        status: prompt.status,
        tags: {
          deleteMany: {},
          create: prompt.tags.map((tagName) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName },
              },
            },
          })),
        },
      },
      create: {
        id: `seed-${prompt.title.toLowerCase().replace(/\s+/g, "-")}`,
        title: prompt.title,
        description: prompt.description,
        content: prompt.content,
        categoryId: prompt.categoryId,
        ownerId: prompt.ownerId,
        visibility: prompt.visibility,
        status: prompt.status,
        tags: {
          create: prompt.tags.map((tagName) => ({
            tag: {
              connectOrCreate: {
                where: { name: tagName },
                create: { name: tagName },
              },
            },
          })),
        },
        savedBy: {
          create: {
            userId: prompt.savedByUserId,
          },
        },
      },
    });

    await prisma.promptVersion.upsert({
      where: { promptId_version: { promptId: created.id, version: 1 } },
      update: {},
      create: {
        promptId: created.id,
        version: 1,
        title: created.title,
        description: created.description,
        content: created.content,
        categoryId: created.categoryId,
        tagsCsv: prompt.tags.join(", "),
        visibility: created.visibility,
        status: created.status,
        changedById: created.ownerId,
      },
    });

    await prisma.savedPrompt.upsert({
      where: { promptId_userId: { promptId: created.id, userId: prompt.savedByUserId } },
      update: {},
      create: {
        promptId: created.id,
        userId: prompt.savedByUserId,
      },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
