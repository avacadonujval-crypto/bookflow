# BookFlow MVP

BookFlow is a Next.js app for digital publishing, licensing, classroom assignments, and interactive reading with quizzes and analytics.

## Prerequisites

- Node.js 20+
- Docker (for PostgreSQL)

## Setup

1. **Start the database**

   ```bash
   docker compose up -d
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   Set `AUTH_SECRET` to a long random string. Defaults in `.env.example` work for local development.

3. **Install dependencies**

   ```bash
   npm i
   ```

4. **Database schema and seed data**

   ```bash
   npm run db:setup
   ```

   This runs `prisma db push` and seeds demo users, books, classes, and analytics.

5. **Run the dev server**

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Seed credentials

All demo users share the password **`Password123!`**

| Role        | Email                      |
| ----------- | -------------------------- |
| Publisher   | `publisher@bookflow.local` |
| Instructor  | `instructor@bookflow.local` |
| Student     | `student@bookflow.local`   |
| Org admin   | `admin@bookflow.local`     |

The sample published book **Foundations of Interactive Learning** is assigned to the demo student and available in the library.

## Scripts

| Script            | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Next.js development server           |
| `npm run build`   | Production build                     |
| `npm run start`   | Start production server              |
| `npm run lint`    | ESLint                               |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`) |
| `npm run db:generate` | Generate Prisma client           |
| `npm run db:migrate`  | Prisma migrate dev               |
| `npm run db:push`     | Push schema to database          |
| `npm run db:seed`     | Run seed script                  |
| `npm run db:setup`    | `db:push` + seed                 |
| `npm run test`        | Vitest unit tests                |
| `npm run test:watch`  | Vitest watch mode                |
| `npm run test:e2e`    | Playwright end-to-end tests      |

## Testing

**Unit tests** (no database required for most suites):

```bash
npm run test
```

**E2E tests** (requires database seeded and starts `npm run dev` via Playwright):

```bash
npm run db:setup
npm run test:e2e
```

Login and reader flows use `data-testid` hooks (`login-email`, `login-password`, `login-submit`, `reader-chapter`, `quiz-submit`, `quiz-score`, `reading-progress`).

## Offline / service worker

`public/sw.js` is a minimal stub that caches static assets. To enable it, render `<ServiceWorkerRegister />` from `src/components/sw-register.tsx` in your root layout (optional — not enabled by default in the MVP).

## Limitations (MVP)

- **AI** uses a mock provider (`AI_PROVIDER=mock`); real OpenAI/Anthropic wiring is not included.
- **File storage** is local (`UPLOAD_DIR`); no S3/cloud storage.
- **PDF/EPUB** upload is supported at the metadata level; the reader primarily renders HTML chapter content.
- **Auth** is credentials-based NextAuth; no SSO.
- **Service worker** caches only static assets, not book content or API responses.
- **E2E** assumes seed data and a running Postgres instance on `localhost:5432`.

## Project layout (high level)

- `src/app` — role-based routes (publisher, instructor, student, org, reader)
- `src/lib` — auth, RBAC, Prisma, services, server actions
- `prisma` — schema and seed
- `e2e` — Playwright specs
