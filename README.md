# BookFlow

Next.js eBook learning platform with PDF reading, publisher upload tools, and a Gemini-powered AI tutor (Audio Overview, Live Tutor, flashcards, quizzes).

## Local development

1. Copy env: `cp .env.example .env` and fill values
2. Start Postgres: `docker compose up -d`
3. Install & migrate: `npm install && npx prisma db push && npm run db:seed`
4. Run: `npm run dev` → http://localhost:3000

### Seed logins (password `Password123!`)

| Role | Email |
|------|-------|
| Student | `student@bookflow.local` |
| Publisher | `publisher@bookflow.local` |
| Instructor | `instructor@bookflow.local` |
| Org admin | `admin@bookflow.local` |

## Production (Vercel)

Required environment variables:

- `DATABASE_URL` — Postgres connection string (Neon / Supabase / Railway)
- `AUTH_SECRET` — long random string
- `AUTH_URL` / `NEXTAUTH_URL` — your deployed HTTPS URL
- `AUTH_TRUST_HOST=true`
- `AI_PROVIDER=gemini` (optional)
- `GEMINI_API_KEY` — for AI tutor / TTS
- `UPLOAD_DIR=./uploads` (or configure durable storage for files)

After deploy, run migrations against the production database:

```bash
npx prisma db push
npm run db:seed
```
