# ShopRight — Build Progress Tracker

**Last Updated:** April 1, 2026
**Current Phase:** 🟡 Phase 1 — Auth & Profile
**Overall Status:** 🟢 Active Build

---

## How This Works

| Symbol | Meaning |
|---|---|
| ✅ | Complete and validated by Eli |
| 🟡 | In progress |
| ⬜ | Not started |
| 🔴 | Blocked — see notes |
| 🛑 GATE | Waiting for Eli validation before proceeding |

**Claude Code updates this file after every task.**
**Eli signs off at every phase gate.**
**Neither proceeds past a gate without the other.**

---

## Pre-Build Setup

| # | Step | Status | Notes |
|---|------|--------|-------|
| S1 | Install Node.js | ✅ | |
| S2 | Install Claude Code | ✅ | |
| S3 | Create Anthropic account + connect Claude Code | ✅ | |
| S4 | Install Git | ✅ | |
| S5 | Create GitHub account | ✅ | jelipeterson-lgtm |
| S6 | Create Vercel account | ✅ | Connected to GitHub |
| S7 | Create Render account | ✅ | Connected to GitHub |
| S8 | Create Supabase project | ✅ | Project: shopright |
| S9 | Create Stripe account | ✅ | |
| S10 | Create Resend account | ✅ | API key in .env |
| S11 | Create Dropbox config folder | ✅ | Book1.xlsx + templates uploaded |
| S12 | Create ShopRight folder on Mac | ✅ | Documents/ShopRight |
| S13 | Copy PRD, CLAUDE.md, PROGRESS.md into folder | ✅ | |
| S14 | Create GitHub repo + push initial files | ✅ | github.com/jelipeterson-lgtm/shopright |
| S15 | Create .env file with all credentials | ✅ | |
| S16 | Verify .gitignore includes .env | ✅ | Confirmed .env excluded from git |
| S17 | Start Claude Code and verify it reads PRD | ✅ | |

**Setup Sign-off:** ✅ Eli confirms all setup steps complete — Date: April 1, 2026

---

## Phase 0 — Project Foundation
**Goal:** Full stack scaffolded, deployed, and communicating. Chrome loads the app at a live URL.
**Estimated Sessions:** 1–2

| # | Task | Status | Notes |
|---|------|--------|-------|
| 0.1 | Create GitHub repo — monorepo with /frontend and /backend | ✅ | github.com/jelipeterson-lgtm/shopright |
| 0.2 | Scaffold frontend — React + Tailwind, basic routing, placeholder home screen | ✅ | Vite + React Router + Tailwind v4 |
| 0.3 | Scaffold backend — FastAPI app, health check endpoint, requirements.txt | ✅ | /health returns 200 |
| 0.4 | Connect Supabase — verify backend reaches database | ✅ | Auth health 200, db.py configured |
| 0.5 | Deploy frontend to Vercel — confirm live URL loads in Chrome | ✅ | shopright-74hpouudf-jelipeterson-7076s-projects.vercel.app |
| 0.6 | Deploy backend to Render — confirm health check returns 200 | ✅ | shopright-api.onrender.com/health returns 200 |
| 0.7 | Frontend calls backend health check — full stack communicates end to end | ✅ | .env.production + CORS configured |

**🛑 GATE — Phase 0 Validation:**
- [x] Vercel URL loads placeholder home screen in Chrome
- [x] Render health check URL returns OK
- [x] Frontend successfully calls backend (confirmed in browser console)

**Phase 0 Sign-off:** ✅ Validated by Eli — Date: April 1, 2026

---

## Phase 1 — Auth & Profile
**Goal:** Shoppers can create accounts, complete profile, optionally configure Anthropic API key.
**Estimated Sessions:** 1–2

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1.1 | Plan mode: auth flow, user model, profile fields, API key storage | ⬜ | |
| 1.2 | Supabase Auth integration — email + password signup, login, logout, sessions | ⬜ | |
| 1.3 | Account creation Step 1 — email + password | ⬜ | |
| 1.4 | Account creation Step 2 — profile fields | ⬜ | Name, email, phone, home address, mileage rate, invoice number start |
| 1.5 | Account creation Step 3 — AI review setup (Yes path) | ⬜ | Guide + API key entry + connection test + encrypted storage |
| 1.6 | Account creation Step 3 — AI review setup (Skip path) | ⬜ | AI features hidden, enable later from Settings |
| 1.7 | Settings screen — edit all profile fields, update API key, change password | ⬜ | |
| 1.8 | Loading, error, and empty states on all screens | ⬜ | |

**🛑 GATE — Phase 1 Validation:**
- [ ] Create new account with email + password
- [ ] Complete profile — all fields save correctly
- [ ] Configure API key — connection test passes
- [ ] Log out → log back in → profile data persists
- [ ] Skip API key at signup → no AI features shown → enable from Settings

**Phase 1 Sign-off:** ⬜ Validated by Eli — Date: ___________

---

## Phase 2 — Store Directory & GPS
**Goal:** Store directory loaded from Dropbox. GPS suggests nearby stores. Manual search fallback.
**Estimated Sessions:** 1–2

| # | Task | Status | Notes |
|---|------|--------|-------|
| 2.1 | Plan mode: store ingest, Haversine calculation, search | ⬜ | |
| 2.2 | Backend: poll Dropbox HEAD on launch — download Book1.xlsx if newer | ⬜ | |
| 2.3 | Backend: parse Book1.xlsx into database | ⬜ | Retailer Name, Store #, Program, Address, City, State, Zip |
| 2.4 | Backend: /stores/nearby — Haversine, returns up to 3 within 1 mile | ⬜ | |
| 2.5 | Backend: /stores/search — text query, retailer name or store number | ⬜ | |
| 2.6 | Frontend: New Store — fires GPS, calls /stores/nearby, shows list with distances | ⬜ | |
| 2.7 | Frontend: no stores within 1 mile → auto-show search input | ⬜ | |
| 2.8 | Frontend: 'Search Instead' always available | ⬜ | |
| 2.9 | Frontend: confirm store → program picklist filtered to that store | ⬜ | |
| 2.10 | Loading, error, and empty states on all screens | ⬜ | |

**🛑 GATE — Phase 2 Validation:**
- [ ] Backend pulls Book1.xlsx from Dropbox — stores visible in database
- [ ] Open on iPhone in Chrome → tap New Store → GPS fires → nearby stores shown with distances
- [ ] Correct store appears for a known location
- [ ] Manual search works by store number and retailer name
- [ ] Program picklist shows correct options after store confirmed

**Phase 2 Sign-off:** ⬜ Validated by Eli — Date: ___________

---

## Phase 3 — Session & Visit Flow
**Goal:** Full session flow — new store, new vendor, multiple drafts, all gates, manual entry.
**Estimated Sessions:** 1–2

| # | Task | Status | Notes |
|---|------|--------|-------|
| 3.1 | Plan mode: visit state machine, data model, gate logic | ⬜ | |
| 3.2 | VendorVisit data model — all fields, Draft/Complete status | ⬜ | |
| 3.3 | Home screen — active session card, Start Session button, past sessions list | ⬜ | |
| 3.4 | Session screen — vendor visits grouped by store, status badges | ⬜ | |
| 3.5 | New Store flow — GPS/search, confirm, open stop | ⬜ | |
| 3.6 | New Vendor — program picklist, creates Draft VendorVisit, opens form | ⬜ | |
| 3.7 | Multiple drafts — toggle between open drafts from session screen | ⬜ | |
| 3.8 | After completing vendor: 'Add Another Vendor' or 'Close Store' options | ⬜ | |
| 3.9 | Close Store gate — blocks if Draft visits exist at stop | ⬜ | |
| 3.10 | New Store gate — blocks if any stop from today is still open | ⬜ | |
| 3.11 | End Session gate — blocks if any open stops | ⬜ | |
| 3.12 | Manual visit entry — full store search, date/time fields, same form | ⬜ | |
| 3.13 | Loading, error, and empty states on all screens | ⬜ | |

**🛑 GATE — Phase 3 Validation:**
- [ ] Start session → add store via GPS → add two vendors as drafts → toggle between them
- [ ] Complete first vendor → complete second → 'Close Store' works
- [ ] Try to open new store before closing first → gate fires with correct message
- [ ] End session with open stop → gate fires
- [ ] End session with all closed → succeeds
- [ ] Manual entry from home with a past date → appears in correct week

**Phase 3 Sign-off:** ⬜ Validated by Eli — Date: ___________

---

## Phase 4 — Assessment Form
**Goal:** Full 40-field form — all conditional logic, program/retailer rules, voice input, auto-save.
**Estimated Sessions:** 1–2

| # | Task | Status | Notes |
|---|------|--------|-------|
| 4.1 | Plan mode: EvaluationField component, form layout, voice, conditional visibility | ⬜ | |
| 4.2 | EvaluationField component — Pass (default) / Fail / N/A, Fail opens comment | ⬜ | One component, used 22 times |
| 4.3 | Voice input — Web Speech API, mic button on all comment fields + Visit Recap | ⬜ | |
| 4.4 | Zone 1 — Visit header: store, program, time, Reps Present gate | ⬜ | |
| 4.5 | Reps Present = Pass flow: names, description, count, reason if count > 4 | ⬜ | |
| 4.6 | Reps Present = Fail flow: cols 9–38 hidden, Visit Recap only | ⬜ | |
| 4.7 | Zone 2 — 22 EvaluationField components, cols 13–38 | ⬜ | |
| 4.8 | Soft Selling — hidden for non-Water programs, output N/A | ⬜ | |
| 4.9 | Resource Guide — Yes/No at Costco only, output N/A elsewhere | ⬜ | |
| 4.10 | Badge location (col 32) — always visible when reps present | ⬜ | |
| 4.11 | Zone 3 — Visit Recap, large field, always shown | ⬜ | |
| 4.12 | Auto-save — saves to database on every field change | ⬜ | |
| 4.13 | Loading, error, and empty states on all screens | ⬜ | |

**🛑 GATE — Phase 4 Validation:**
- [ ] All-Pass visit completes quickly with minimal interaction
- [ ] 5 Fail fields — comments required, all show correctly
- [ ] Reps Present = Fail — cols 9–38 hidden, only Visit Recap shown
- [ ] Water program — Soft Selling field shown
- [ ] Non-Water program — Soft Selling hidden
- [ ] Costco — Resource Guide shows as Yes/No
- [ ] Non-Costco — Resource Guide hidden
- [ ] Voice input works on Visit Recap and two comment fields in Chrome
- [ ] Close browser mid-form → reopen → all data still present

**Phase 4 Sign-off:** ⬜ Validated by Eli — Date: ___________

---

## Phase 5 — AI Review & Submission
**Goal:** AI review runs at end of visit, flags issues, shopper submits. All paths (no flags, no signal, no key) work.
**Estimated Sessions:** 1

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5.1 | Plan mode: API call structure, prompt, flag display, all edge paths | ⬜ | |
| 5.2 | Backend: /review endpoint — calls Claude API with user's key, returns flags | ⬜ | |
| 5.3 | AI prompt — Smart Circle field manager persona, questions only, no corrections | ⬜ | |
| 5.4 | Review & Submit button — calls /review, shows spinner | ⬜ | |
| 5.5 | Flags screen — field name + question, tap to edit inline, dismiss | ⬜ | |
| 5.6 | No flags path — skip flags screen, mark Complete | ⬜ | |
| 5.7 | No signal / API error path — submit proceeds, warning banner | ⬜ | |
| 5.8 | 'Looks good, submit anyway' bypass on flags screen | ⬜ | |
| 5.9 | Visit marked Complete — locked with unlock option | ⬜ | |
| 5.10 | No API key path — submit marks Complete directly, no flags | ⬜ | |
| 5.11 | Loading, error, and empty states on all screens | ⬜ | |

**🛑 GATE — Phase 5 Validation:**
- [ ] Submit visit with obvious voice errors → flags screen appears with relevant questions
- [ ] Edit a flagged item inline → dismiss → submit → Complete
- [ ] Submit clean visit → no flags screen → straight to Complete
- [ ] Disconnect network → submit → warning banner → visit still marked Complete
- [ ] Account with no API key → submit → straight to Complete, no flags shown

**Phase 5 Sign-off:** ⬜ Validated by Eli — Date: ___________

---

## Phase 6 — Report & Invoice Generation
**Goal:** Shop File and Invoice .xlsx match Kelsey's real submissions exactly when opened in Excel.
**Estimated Sessions:** 2–3

| # | Task | Status | Notes |
|---|------|--------|-------|
| 6.1 | Plan mode: Excel generation, cell mapping audit, email delivery | ⬜ | |
| 6.2 | Eli provides Shop File template + Invoice template → upload to Dropbox | ⬜ | Eli action required |
| 6.3 | Audit Shop File template — document every cell position, width, color, font | ⬜ | |
| 6.4 | Audit Invoice template — same | ⬜ | |
| 6.5 | Backend: /generate/shopfile — copy template, write rows, calculate Fail Count | ⬜ | |
| 6.6 | Weekly summary screen — visits grouped by day, second-chance edit | ⬜ | |
| 6.7 | File naming — 'Shop File [First Name] mm.dd.yy' | ⬜ | Date = last shopping day of ISO week |
| 6.8 | Backend: /send/shopfile — Resend, attach .xlsx, send to Smart Circle | ⬜ | |
| 6.9 | Send confirmation screen | ⬜ | |
| 6.10 | Sent reports archive — read-only, downloadable | ⬜ | |
| 6.11 | Backend: /generate/invoice — copy template, vendor rows + mileage rows | ⬜ | |
| 6.12 | Monthly summary screen — visits by day, mileage entry per day | ⬜ | |
| 6.13 | Invoice numbering — auto-increment, overrideable | ⬜ | |
| 6.14 | Backend: /send/invoice — same pattern as Shop File | ⬜ | |
| 6.15 | Validate Shop File output vs Kelsey's real submission | ⬜ | Open in Excel on Mac — zero discrepancies |
| 6.16 | Validate Invoice output vs Kelsey's real submission | ⬜ | Same |
| 6.17 | Loading, error, and empty states on all screens | ⬜ | |

**🛑 GATE — Phase 6 Validation:**
- [ ] Generate Shop File for a week with visits on 2 days
- [ ] Open generated file in Excel on Mac
- [ ] Compare every column to Kelsey's real submission — zero discrepancies
- [ ] Confirm email arrives at test address with correct attachment and subject
- [ ] Generate Invoice with mileage entries → pricing correct ($50/$15 rule)
- [ ] Open Invoice in Excel → matches Kelsey's real invoice

**Phase 6 Sign-off:** ⬜ Validated by Eli — Date: ___________

---

## Phase 7 — Payments
**Goal:** Stripe subscriptions for new users. Free accounts for Kelsey + coworkers. Paywall works.
**Estimated Sessions:** 1

| # | Task | Status | Notes |
|---|------|--------|-------|
| 7.1 | Stripe account setup — monthly + annual subscription products | ⬜ | Eli creates products in Stripe dashboard |
| 7.2 | Stripe hosted checkout integration | ⬜ | |
| 7.3 | 14-day free trial on signup | ⬜ | |
| 7.4 | Subscription gate — paywall after trial | ⬜ | |
| 7.5 | Manual free accounts — exempt flag in Supabase | ⬜ | Eli creates these directly in Supabase |
| 7.6 | Subscription management in Settings | ⬜ | |
| 7.7 | Graceful expiry — data readable, new visits blocked | ⬜ | |

**🛑 GATE — Phase 7 Validation:**
- [ ] New user signup → 14-day trial → full access
- [ ] Trial expires (test mode) → paywall shown
- [ ] Subscribe via Stripe → full access restored
- [ ] Kelsey's manually-created account → never sees paywall

**Phase 7 Sign-off:** ⬜ Validated by Eli — Date: ___________

---

## Phase 8 — Polish & Real-World Launch
**Goal:** App works on all target devices. Kelsey uses it on a real shopping day.
**Estimated Sessions:** 1

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8.1 | Responsive design audit — iPhone, Android, Chromebook, desktop Chrome | ⬜ | |
| 8.2 | PWA setup — manifest.json, service worker, Add to Home Screen prompt | ⬜ | |
| 8.3 | Empty states on all screens | ⬜ | |
| 8.4 | Accessibility — keyboard nav, ARIA labels, color contrast | ⬜ | |
| 8.5 | Real-world use — Kelsey uses app on a real shopping day | ⬜ | Eli + Kelsey |
| 8.6 | Output validation — generated report accepted by Smart Circle | ⬜ | |
| 8.7 | Error monitoring setup — Sentry or equivalent | ⬜ | |

**🛑 GATE — Phase 8 Validation:**
- [ ] App tested on iPhone Chrome, Android Chrome, Chromebook
- [ ] 'Add to Home Screen' works on iPhone Chrome
- [ ] Kelsey completes a real shopping day using only the app
- [ ] Generated Shop File submitted to Smart Circle and accepted

**Phase 8 Sign-off:** ⬜ Validated by Eli — Date: ___________

---

## Architecture Decisions Log

| Decision | Rationale | Date |
|----------|-----------|------|
| Web app (React + Python) over native iOS | Works on all devices, half the build time, no App Store, Stripe instead of Apple 30% cut | March 2026 |
| Template-copy Excel via openpyxl | Eliminates riskiest build component — format already exists in template | March 2026 |
| Flat VendorVisit data model (no nested stops) | Draft/Complete status per visit is simpler than managing nested stop/vendor state | March 2026 |
| Haversine math for GPS (no mapping SDK) | Store directory is small — local distance math is trivial, free, no API key | March 2026 |
| User's own Anthropic API key | Zero AI cost to Eli. ~$1-3/month per user on their own account. | March 2026 |
| Reusable EvaluationField component | 22 identical field behaviors — build once, configure 22 times | March 2026 |
| TestFlight replaced by Vercel URL | Web app — anyone with the URL can use it on any device | March 2026 |

---

## Known Issues & Blockers

*None at project start. Claude Code adds entries here when blocked.*

---

## Session Log

| Date | Phase | What Was Done | Next Step |
|------|-------|---------------|-----------|
| March 2026 | Setup | PRD v3 complete. Setup Guide, CLAUDE.md, PROGRESS.md created. Ready to begin setup. | Complete Section 3 of Setup Guide |
| April 1, 2026 | Setup + Phase 0 | All setup steps completed. Scaffolded React+Tailwind frontend and FastAPI backend. Deployed to Vercel and Render. End-to-end health check verified. | Phase 1 — Auth & Profile |

---

*This file is the source of truth for ShopRight build progress.*
*Claude Code updates it after every task. Eli signs off at every phase gate.*
