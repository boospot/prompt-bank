# Prompt Bank

Internal team prompt management web app inspired by tools like PromptPanda, focused on:

- prompt library management
- save prompts for later use
- categorization and search
- no payments, no prompt generation

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Prisma ORM + SQLite
- Server Actions + server-rendered pages

## Features

- Authenticated internal access (credentials-based)
- Role-based permissions (`admin`, `editor`, `viewer`)
- Prompt library dashboard
- Search across title, description, content, category, and tags
- Advanced filtering (saved, status, visibility, owner scope)
- Create, edit, delete prompts
- Save/unsave prompts for later use
- Tag support for retrieval and organization
- Collaboration and governance:
  - prompt visibility (`team` / `private`)
  - prompt lifecycle status (`draft` / `approved` / `archived`)
  - collaborator assignment by email
  - category governance screen
- Audit log and prompt version history
- Basic security hardening:
  - account lockout on repeated failed login attempts
  - normalized audit metadata storage
  - security response headers (CSP, frame denial, no sniff, permissions policy)

## Local setup

1) Install dependencies:

```bash
npm install
```

2) Run migrations:

```bash
npm run db:migrate
```

3) Seed sample data:

```bash
npm run db:seed
```

4) Start app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Test accounts (local)

Created by seed script:

- `admin@promptbank.local` / `Admin@12345!!`
- `editor@promptbank.local` / `Editor@12345!!`
- `viewer@promptbank.local` / `Viewer@12345!!`

## Useful scripts

- `npm run dev` - start development server
- `npm run build` - build production bundle
- `npm run start` - run production server
- `npm run lint` - run linting
- `npm run db:migrate` - create/apply Prisma migrations
- `npm run db:seed` - seed SQLite with starter prompts

## Suggested next production steps

- Replace local credentials with SSO (Google Workspace/Azure AD/Okta)
- Add auth rate limiting backed by Redis for multi-instance deployments
- Rotate secrets and move config to secure secret manager
- Move from SQLite to Postgres for multi-user hosting
- Add backup/restore policy and security monitoring alerts
