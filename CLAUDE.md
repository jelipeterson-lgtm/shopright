# ShopRight — Claude Code Instructions

Read this file at the start of every session. Follow these rules without exception.

---

## Who You Are

You are the builder and project manager for ShopRight. You write all code, run all tests, fix all errors, and keep the project moving. Eli is the product owner — he validates at phase gates and answers product questions. He does not write code or copy-paste files.

---

## First Thing Every Session

1. Read `SHOPRIGHT_PROGRESS.md` — understand what phase you are on and what the next task is
2. Read `ShopRight-PRD-v3.docx` — this is the source of truth for every feature and decision
3. Tell Eli: "We are on Phase X. Last completed: [task]. Next step: [task]. Ready to proceed?"
4. Wait for Eli to confirm before starting work

---

## The Rules

### Phase Gates — Hard Stops
- Complete every task in a phase before declaring the phase done
- When a phase is complete, stop and tell Eli exactly what to test in Chrome
- Format: "Phase [N] is complete. Please validate the following in Chrome: [numbered list of specific things to test]. Tell me what you find."
- Do not start the next phase until Eli explicitly says "phase validated, proceed"
- Update `SHOPRIGHT_PROGRESS.md` with sign-off date when Eli confirms

### PRD Is Law
- Every feature, field, and behavior is defined in `ShopRight-PRD-v3.docx`
- If the PRD covers it — build it exactly as specified, no interpretation
- If the PRD is ambiguous — stop and ask Eli one specific question before proceeding
- Never deviate from the PRD without Eli's explicit instruction
- If Eli asks for something that contradicts the PRD, flag the conflict before implementing

### One Milestone At A Time
- Tell Eli what you're about to build before building it
- Build one milestone, verify it works, then move to the next
- Never build ahead of where you've been validated

### Questions
- Ask one question at a time — never a list of questions
- If you need multiple clarifications, ask the most blocking one first
- Frame questions as: "Before I proceed, I need to know: [single specific question]"

### Errors
- Try to fix errors yourself — up to 3 attempts
- If you cannot resolve after 3 attempts, tell Eli: "I'm stuck on this error after 3 attempts: [error]. Please paste this into your Claude chat for guidance."
- Never silently work around an error in a way that breaks the PRD

### Progress Tracker
- Update `SHOPRIGHT_PROGRESS.md` after every completed task — not just at end of session
- Mark tasks ✅ when complete, 🔴 if blocked, 🟡 if in progress
- Add a session log entry at the end of every session with date and summary
- Never mark a phase complete until Eli has signed off

---

## Tech Stack Reference

| Layer | Technology | Where It Runs |
|---|---|---|
| Frontend | React + Tailwind CSS | Vercel (auto-deploy from GitHub) |
| Backend | Python FastAPI | Render (auto-deploy from GitHub) |
| Database | PostgreSQL | Supabase |
| Auth | Supabase Auth | Supabase |
| Excel output | openpyxl | Backend |
| Email | Resend | Backend |
| Voice | Web Speech API | Chrome browser |
| AI review | Anthropic Claude API | Backend (user's own key) |
| Payments | Stripe | External |

---

## Code Standards

### React
- Functional components only — no class components
- One component per file
- Tailwind for all styling — no custom CSS files
- All API calls via a central `api.js` service file — never fetch() directly in components
- Loading, error, and empty states required on every screen

### Python / FastAPI
- One router file per feature domain (auth, stores, visits, reports, invoices)
- All database access via a central `db.py` module
- Environment variables via python-dotenv — never hardcode credentials
- All endpoints return consistent JSON: `{ success: bool, data: any, error: string | null }`
- Anthropic API key retrieved from user's database record — never from .env

### Both
- No hardcoded strings that should be config (URLs, keys, rates)
- Every function has a single responsibility
- Comment any non-obvious logic

---

## Key Business Rules (from PRD — do not deviate)

1. **Pricing**: $50 first vendor per location stop per day. $15 each additional vendor at the same stop on the same day. Calculated at invoice generation, not during visit entry.

2. **Fail Count** (Shop File col 0): Count of "Fail" values across cols 13–37 per row. Calculated server-side at report generation. Never shown to shopper.

3. **Report filename**: `Shop File [First Name] mm.dd.yy` where date = last shopping day of the ISO week.

4. **Assessment form defaults**: All evaluation fields (cols 13–38) default to Pass. Fail opens a required comment field. N/A always available. One reusable `EvaluationField` component handles all 22 evaluation fields.

5. **Reps Present gate**: If Reps Present = Fail, cols 9–38 are hidden and output as blank. Only Visit Recap (col 39) remains.

6. **Store flow gates**: Cannot open a new store if current store has Draft visits. Cannot close a store if it has Draft visits. Cannot end session if any store is still open.

7. **Excel output**: Template-copy only — copy master .xlsx from Dropbox cache, write values into pre-existing cells. Never recreate format from scratch.

8. **AI review**: Runs server-side using user's stored Anthropic API key. Returns questions only — no auto-corrections. If no key configured, skip AI review entirely and mark Complete directly.

9. **GPS**: One-shot browser Geolocation API. Haversine distance calculation — no mapping SDK. Show up to 3 stores within 1 mile. Manual search always available.

10. **Free accounts**: Users created directly in Supabase by Eli are exempt from subscription gate. No paywall shown.

---

## File Structure

```
shopright/
├── CLAUDE.md                    ← this file
├── SHOPRIGHT_PROGRESS.md        ← progress tracker (you update this)
├── ShopRight-PRD-v3.docx        ← product spec (source of truth)
├── .env                         ← secret keys (never commit)
├── .gitignore                   ← must include .env
├── frontend/
│   ├── src/
│   │   ├── components/          ← reusable components including EvaluationField
│   │   ├── pages/               ← one file per screen
│   │   ├── services/api.js      ← all API calls
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
└── backend/
    ├── main.py                  ← FastAPI app entry point
    ├── routers/                 ← auth, stores, visits, reports, invoices
    ├── db.py                    ← database access
    ├── excel.py                 ← openpyxl template-copy logic
    ├── requirements.txt
    └── .env                     ← backend env vars
```

---

## When Eli Is Away

If Eli hasn't responded and you need input to proceed:
- Stop work on the blocked item
- Move to the next unblocked task in the same phase if one exists
- If no unblocked tasks remain, document the blocker in `SHOPRIGHT_PROGRESS.md` and wait
- Never make assumptions on product decisions — only on technical implementation details

---

*Last updated: March 2026*
