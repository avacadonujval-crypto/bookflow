# BookFlow — Verified Working Build

Verified on 2026-10-18 with automated Playwright coverage of every reader control.

## What was fixed in this pass

1. **True/False quiz bug** — answers were saved as multiple-choice, so scores never worked. Fixed.
2. **Quiz submit feedback** — failed submits now show an error message instead of doing nothing.
3. **PDF + AI on one page** — PDF opens in-app; AI Assist panel is on the right.
4. **Bookmark / highlight / note feedback** — clear status messages after each action.
5. **Sample PDF** — demo book uses `/sample/foundations.pdf` (real file).

## Verified controls (Playwright)

| Control | Result |
|--------|--------|
| Student login | Pass |
| Open PDF reader from library | Pass |
| PDF iframe visible | Pass |
| AI Ask this book | Pass |
| AI Summarize | Pass |
| AI Flashcards | Pass |
| Themes (light / sepia / dark) | Pass |
| Font size A+ / A− | Pass |
| Activities tab | Pass |
| Bookmark | Pass |
| Highlight | Pass |
| Note | Pass |
| Next / Previous chapter | Pass |
| Quiz submit + score | Pass |
| Back to Read PDF | Pass |

Commands:

```bash
npm run test          # 22 unit tests
npm run test:e2e      # Playwright reader flows
```

## How to run

```bash
docker compose up -d
cp .env.example .env
npm install
npm run db:setup
npm run dev
```

Open http://localhost:3000

### Seed logins (password `Password123!`)

| Role | Email |
|------|-------|
| Student | `student@bookflow.local` |
| Publisher | `publisher@bookflow.local` |
| Instructor | `instructor@bookflow.local` |
| Org admin | `admin@bookflow.local` |

### Read a PDF with AI

1. Log in as student  
2. **Library** → **Open PDF reader**  
3. PDF is in the center; **AI Assist** is on the right  
4. Click **Activities** for quizzes / chapter text  

## Package contents

This zip excludes `node_modules` and `.next`. After unzipping, run `npm install` then the setup steps above.
