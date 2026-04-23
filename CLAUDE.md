# ShopRight — Project Documentation

Read this file at the start of every session. This is the comprehensive reference for the entire project.

*Last updated: April 7, 2026*

---

## Project Overview

**ShopRight** is a web app for secret shoppers contracted to Smart Circle International. It runs in Chrome on any device (iPhone, Android, Chromebook, Windows, Mac). It replaces a manual workflow of Google Forms and spreadsheets with structured vendor assessment entry, AI-powered review, automatic weekly Shop File generation, and automatic monthly Invoice generation.

**Business**: Eli Peterson Consulting LLC
**Product Owner**: Eli Peterson (j.eli.peterson@gmail.com)
**Primary User**: Kelsey Peterson — Portland Metro / Pacific NW region
**Client Company**: Smart Circle International, LLC — Newport Beach, CA

---

## Live URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **App (Frontend)** | https://shopright-jet.vercel.app | Main app — login, assessments, reports |
| **Landing Page** | https://shopright-jet.vercel.app/ | Eli Peterson Consulting LLC landing page |
| **API (Backend)** | https://shopright-api.onrender.com | FastAPI backend |
| **API Health Check** | https://shopright-api.onrender.com/health | Verify backend is running |
| **GitHub Repo** | https://github.com/jelipeterson-lgtm/shopright | Source code (monorepo) |

---

## External Accounts & Dashboards

| Service | Dashboard URL | Account | Purpose |
|---------|--------------|---------|---------|
| **Vercel** | vercel.com/dashboard | jelipeterson-7076s-projects | Frontend hosting, auto-deploys from GitHub |
| **Render** | dashboard.render.com | Eli's account | Backend hosting, auto-deploys from GitHub |
| **Supabase** | supabase.com/dashboard | Project: shopright | PostgreSQL database + Auth |
| **Stripe** | dashboard.stripe.com | Eli Peterson Consulting LLC | Payments, subscriptions |
| **Stripe Test Mode** | dashboard.stripe.com/test | Same account | Test payments (use `4242 4242 4242 4242`) |
| **Resend** | resend.com/emails | Eli's account | Email delivery (Shop Files, Invoices) |
| **Dropbox** | dropbox.com | ShopRight-Config folder | Store directory + Excel templates |
| **GitHub** | github.com/jelipeterson-lgtm | jelipeterson-lgtm | Version control |
| **Anthropic** | console.anthropic.com | Per-user | AI review API keys (user's own account) |
| **OpenRouteService** | openrouteservice.org | Eli's account | Route optimization Distance Matrix API (central key) |

---

## Tech Stack

| Layer | Technology | Where It Runs | Cost |
|---|---|---|---|
| Frontend | React 19 + Tailwind CSS v4 + Vite | Vercel (free tier) | $0 |
| Backend | Python FastAPI + Uvicorn | Render (free tier) | $0 |
| Database | PostgreSQL | Supabase (free tier, 500MB) | $0 |
| Auth | Supabase Auth (email + password) | Supabase | $0 |
| Excel output | openpyxl (Python) | Render backend | $0 |
| Email | Resend | External | Free (3k/mo) |
| Voice input | Web Speech API | Chrome browser | $0 |
| AI review | Anthropic Claude API (Haiku) | Render backend | User's own key |
| AI help chat | Anthropic Claude API (Haiku) | Render backend | User's own key |
| Route optimization | OpenRouteService Distance Matrix API | Render backend | Central key (OPENROUTESERVICE_API_KEY) |
| Payments | Stripe (hosted checkout) | External | 2.9% + 30¢/txn |
| GPS | Browser Geolocation API + Haversine | Chrome browser | $0 |
| Store directory | Book1.xlsx on Dropbox | Dropbox | $0 |
| Templates | Dropbox folder | Dropbox | $0 |

**Total fixed monthly cost: $0.** All services on free tiers. Stripe fees only on transactions.

---

## Environment Variables

### Local (.env in project root)

```
SUPABASE_URL=https://eghvaqontbtnthgfrfod.supabase.co
SUPABASE_ANON_KEY=<public anon key>
SUPABASE_SERVICE_ROLE_KEY=<secret service role key>
RESEND_API_KEY=<resend api key>
DROPBOX_STORES_URL=<dropbox direct link to Book1.xlsx>
DROPBOX_SHOPFILE_TEMPLATE_URL=<dropbox direct link to shop file template>
DROPBOX_INVOICE_TEMPLATE_URL=<dropbox direct link to invoice template>
FRONTEND_URL=https://shopright-jet.vercel.app
STRIPE_SECRET_KEY=<stripe live secret key>
STRIPE_PUBLISHABLE_KEY=<stripe live publishable key>
```

### Render Environment Variables (backend)

All of the above plus:

```
STRIPE_TEST_SECRET_KEY=<stripe test secret key>
STRIPE_TEST_WEBHOOK_SECRET=<stripe test webhook signing secret>
STRIPE_WEBHOOK_SECRET=<stripe live webhook signing secret>
STRIPE_MONTHLY_PRICE_ID=<stripe live monthly price id>
STRIPE_ANNUAL_PRICE_ID=<stripe live annual price id>
PROMO_CODES=<comma-separated promo codes for free access>
```

### Frontend (.env.production)

```
VITE_API_URL=https://shopright-api.onrender.com
VITE_SUPABASE_URL=https://eghvaqontbtnthgfrfod.supabase.co
VITE_SUPABASE_ANON_KEY=<public anon key>
```

---

## File Structure

```
shopright/
├── CLAUDE.md                          ← THIS FILE — project documentation
├── SHOPRIGHT_PROGRESS.md              ← build progress tracker
├── ShopRight-PRD-v3.docx              ← original product requirements
├── ShopRight-Setup-Guide.docx         ← original setup guide
├── .env                               ← secret keys (NEVER commit)
├── .gitignore
├── README.md
│
├── backend/
│   ├── main.py                        ← FastAPI app, CORS, contact form, help chat
│   ├── db.py                          ← Supabase client (anon + service role)
│   ├── excel.py                       ← Shop File + Invoice generation (template-copy)
│   ├── ingest_stores.py               ← Download + geocode Book1.xlsx into database
│   ├── requirements.txt               ← Python dependencies
│   ├── .env → ../.env                 ← symlink to root .env
│   └── routers/
│       ├── __init__.py
│       ├── auth.py                    ← JWT verification, profile CRUD, API key test
│       ├── stores.py                  ← GPS nearby, search, programs
│       ├── visits.py                  ← CRUD, complete/unlock, close stop, gates
│       ├── review.py                  ← AI review via user's Anthropic key
│       ├── reports.py                 ← Shop File + Invoice generate/send via Resend
│       ├── payments.py                ← Stripe checkout, webhook, portal, promo codes
│       └── route.py                   ← Route Planner: email/check-in parsing, AI parsing, route optimization
│
├── frontend/
│   ├── index.html                     ← PWA meta tags, viewport, theme color
│   ├── vercel.json                    ← SPA rewrites for client-side routing
│   ├── vite.config.js                 ← Vite + React + Tailwind plugins
│   ├── package.json
│   ├── .env.production                ← Production API URL + Supabase keys
│   ├── .env.development               ← Local dev API URL + Supabase keys
│   │
│   ├── public/
│   │   ├── Logo.png                   ← ShopRight app logo
│   │   ├── favicon.svg
│   │   ├── manifest.json              ← PWA manifest for Add to Home Screen
│   │   └── sw.js                      ← Service worker (basic, enables PWA)
│   │
│   └── src/
│       ├── App.jsx                    ← Routes, auth guards, bottom nav, help chat
│       ├── main.jsx                   ← React root + service worker registration
│       ├── index.css                  ← Tailwind import + iOS zoom fix
│       │
│       ├── components/
│       │   ├── BottomNav.jsx          ← Blue bottom navigation bar
│       │   ├── EvaluationField.jsx    ← Reusable Pass/Fail/N/A field component
│       │   ├── HelpChat.jsx           ← AI help chatbot (floating ? button)
│       │   ├── PageHeader.jsx         ← Standardized page header with logo
│       │   └── VoiceInput.jsx         ← Web Speech API mic button
│       │
│       ├── pages/
│       │   ├── Landing.jsx            ← Eli Peterson Consulting LLC landing page
│       │   ├── Login.jsx              ← Sign in + Getting Started link
│       │   ├── Signup.jsx             ← 3-step: credentials, profile, AI setup
│       │   ├── Paywall.jsx            ← Subscription required screen
│       │   ├── Home.jsx               ← Dashboard: welcome, stats, quick actions
│       │   ├── Session.jsx            ← Today's stores + vendors
│       │   ├── NewStore.jsx           ← Add store via GPS or search
│       │   ├── Visit.jsx              ← Full assessment form (40 fields)
│       │   ├── ManualVisit.jsx        ← Add store + vendor manually (past dates)
│       │   ├── Profile.jsx            ← Personal info (name, email, phone, etc.)
│       │   ├── Settings.jsx           ← AI review, password, subscription, sign out
│       │   ├── Reports.jsx            ← Reports hub (weekly + monthly)
│       │   ├── WeeklyReport.jsx       ← Generate/send weekly Shop File
│       │   ├── MonthlyInvoice.jsx     ← Generate/send monthly invoice
│       │   ├── RoutePlanner.jsx        ← Route optimization from event emails/check-ins
│       │   ├── HelpGuide.jsx          ← Expandable FAQ sections
│       │   └── Tutorial.jsx           ← Step-by-step Getting Started guide
│       │
│       └── services/
│           ├── api.js                 ← All API calls (centralized, auth headers)
│           ├── supabase.js            ← Supabase client initialization
│           └── AuthContext.jsx         ← React auth state + token management
```

---

## Database Schema (Supabase)

### profiles
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | References auth.users |
| full_name | text | |
| report_email | text | Email for sending reports |
| phone | text | |
| home_address | text | |
| mileage_rate | numeric(4,3) | Default 0.725 (2025 IRS rate) |
| invoice_number_start | integer | Default 1 |
| next_invoice_number | integer | Default 1 |
| anthropic_api_key | text | User's own key for AI review |
| default_start_address | text | Default start address for Route Planner |
| default_end_address | text | Default end address for Route Planner |
| ai_review_enabled | boolean | Default false |
| is_free_account | boolean | Default false — bypasses paywall |
| stripe_customer_id | text | Stripe customer ID |
| subscription_status | text | none / active / expired |
| trial_ends_at | timestamptz | Set to created_at + 14 days on signup |
| created_at | timestamptz | |
| updated_at | timestamptz | |

RLS: Users can only read/update their own profile. Auto-created on signup via database trigger (`handle_new_user`) which also sets `trial_ends_at` to 14 days from creation.

**Note**: `next_invoice_number` is legacy — invoice IDs are now derived from YYMM format, not sequential. `anthropic_api_key` is stored in plaintext — acceptable because each user stores only their own key.

### stores
| Column | Type | Notes |
|--------|------|-------|
| id | serial (PK) | |
| retailer_name | text | Costco, Costco BC, Kroger - Fred Meyer, Lowe's, Sam's Club, Target |
| store_number | text | |
| account | text | Legacy — no longer used |
| program | text | Legacy — nullable, programs now in separate table |
| address, city, state, zip_code | text | |
| latitude, longitude | double precision | Geocoded via Nominatim |
| created_at | timestamptz | |

Unique constraint on (retailer_name, store_number). RLS: authenticated users can read. 236 stores loaded.

### programs
| Column | Type | Notes |
|--------|------|-------|
| code | text (PK) | e.g., RTL-ATT-EDM, RS-CKE |
| created_at | timestamptz | |

RLS: authenticated users can read. 8 programs loaded from Book1.xlsx Program worksheet. Users can also enter custom program codes not in this list.

### vendor_visits (50 columns)
| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → profiles) | |
| store_id | integer (FK → stores) | |
| retailer_name, store_number, program | text | Denormalized for report generation |
| address, city, state | text | |
| status | text | Draft or Complete (displayed as Open/Completed in UI) |
| visit_date | date | |
| visit_time | time | |
| session_date | date | |
| stop_open | boolean | True until store is closed |
| reps_present | text | Pass or Fail |
| rep_names, rep_description | text | Optional |
| rep_count | integer | Required when reps present |
| rep_count_reason | text | Required when count > 4 |
| eval_engaging | text | Pass/Fail/N/A |
| eval_engaging_comment | text | Required when Fail |
| eval_greeting, eval_greeting_comment | text | Same pattern for all eval fields |
| eval_one_no, eval_one_no_comment | text | |
| eval_pushy, eval_pushy_comment | text | |
| eval_clogging, eval_clogging_comment | text | |
| eval_leaning, eval_leaning_comment | text | |
| eval_food_drink, eval_food_drink_comment | text | |
| eval_dress_code, eval_dress_code_comment | text | |
| eval_name_badge, eval_name_badge_comment | text | |
| eval_badge_location_pass | text | Pass/Fail/N/A for badge at shoulder height |
| eval_badge_location_comment | text | Required when badge location Fail |
| eval_badge_where | text | Free text — where was badge located |
| eval_other_area, eval_other_area_comment | text | |
| eval_other_store_areas, eval_other_store_areas_comment | text | |
| eval_soft_selling | text | N/A for non-Water programs |
| eval_soft_selling_comment | text | Required when Fail |
| eval_resource_guide | text | Yes/No/N/A — Costco only |
| visit_recap | text | Main narrative field |
| created_at, updated_at | timestamptz | |

RLS: Users can read/insert/update/delete their own visits.

---

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | /health | No | Health check |
| POST | /contact | No | Landing page contact form |
| POST | /help/chat | Yes | AI help chatbot |
| GET | /auth/profile | Yes | Get user profile |
| PUT | /auth/profile | Yes | Update profile |
| POST | /auth/test-api-key | Yes | Test Anthropic API key |
| GET | /stores/nearby | Yes | GPS nearby stores (Haversine) |
| GET | /stores/search | Yes | Search stores by name/number |
| GET | /stores/programs | Yes | Get all available vendor program codes |
| POST | /visits | Yes | Create vendor visit |
| GET | /visits | Yes | List visits (filter by date/status) |
| GET | /visits/{id} | Yes | Get single visit |
| PUT | /visits/{id} | Yes | Update visit fields |
| POST | /visits/{id}/complete | Yes | Mark visit complete |
| POST | /visits/{id}/unlock | Yes | Unlock completed visit |
| DELETE | /visits/{id} | Yes | Delete visit |
| POST | /visits/close-stop | Yes | Close a store (gate check) |
| GET | /visits/check/open-stops | Yes | Check for open stores |
| POST | /review | Yes | AI review via user's key |
| GET | /reports/weekly | Yes | Get visits for ISO week |
| GET | /reports/generate/shopfile | Yes | Download Shop File .xlsx |
| POST | /reports/send/shopfile | Yes | Email Shop File |
| POST | /reports/generate/invoice | Yes | Generate Invoice .xlsx |
| POST | /reports/send/invoice | Yes | Email Invoice |
| GET | /payments/status | Yes | Subscription status check |
| POST | /payments/checkout | Yes | Create Stripe checkout session |
| POST | /payments/portal | Yes | Stripe customer portal |
| POST | /payments/redeem | Yes | Redeem promo code |
| POST | /payments/webhook | No | Stripe webhook handler |
| POST | /visits/batch | Yes | Batch create visits from accepted route |
| DELETE | /visits/by-store | Yes | Delete Draft visits by store/date (route skip/remove) |
| POST | /route/parse-email | Yes | Parse event email into store/vendor entries (AI + fallback) |
| POST | /route/parse-checkin | Yes | Parse check-in text into store/vendor entries (AI + fallback) |
| POST | /route/optimize | Yes | Optimize route via OpenRouteService Distance Matrix API |
| GET | /route/geocode | Yes | Geocode address to lat/lng via Nominatim |
| GET | /route/plan/{date} | Yes | Get saved route plan for date |
| POST | /route/plan | Yes | Save route plan |
| POST | /route/plan/{date}/complete-stop | Yes | Record store visit in history |

---

## Key Business Rules

1. **Pricing**: $50 first vendor per store per day. $15 each additional vendor at same store same day. Calculated at invoice generation.

2. **Fail Count**: Count of "Fail" values across evaluation fields per row. Blank if 0. Calculated server-side at Shop File generation. Never shown to user.

3. **Shop File filename**: `Shop File [First Name] mm.dd.yy` — date = last shopping day of the ISO week.

4. **Invoice filename**: `Invoice [Month Name] [YYYY].xlsx`

5. **Invoice number**: `INVOICE #YYMM` (e.g., INVOICE #2604 for April 2026).

6. **Assessment defaults**: All evaluation fields default to Pass. Fail opens a required comment. N/A always available.

7. **Reps Present gate**: If Fail, all evaluation fields hidden. Only Visit Recap shown. Output cols 9–38 as blank.

8. **Store flow gates**: Cannot add a new store if current store is still open. Cannot close a store if it has unsubmitted vendors.

9. **Excel output**: Template-copy only. Downloads master .xlsx from Dropbox, writes values into cells. Never recreates formatting.

10. **AI review**: Server-side using user's stored Anthropic API key. Returns questions only. Flags highlighted in yellow. Re-review loop available. If no key, skip review entirely.

11. **Free accounts**: `is_free_account = true` in profiles table. Bypasses all payment gates. Set by Eli directly in database.

12. **Trial**: 14 days from signup. Set automatically by database trigger.

13. **Dates**: All dates displayed as MM/DD/YY on the website and in Excel. Times as hh:mm AM/PM.

14. **Phone numbers**: Always formatted as (555) 555-5555 in invoice output regardless of input format.

15. **Route Planner (Primary Page)**: The main workflow page. Parses event emails and SMS check-ins (AI-first, pattern-match fallback). Optimizes route using OpenRouteService Distance Matrix API with time window constraint. Shows estimated arrival/departure per stop. "Accept Route" batch-creates Draft vendor visits. Individual vendor assessment status shown per store — tap to assess. Add stores manually via search (name, number, city, address). Add vendors to any store. "Skip"/"Remove" deletes Draft visits. Re-optimize uses current time and traffic. Stores tab removed from nav — all workflow through Route page. Close-store gate removed.

16. **Dates**: All dates use local timezone (not UTC). Previous bug caused dates to flip to next day after 5 PM Pacific.

---

## Terminology (User-Facing)

| Term | Meaning |
|------|---------|
| **Store** | A physical retail location (e.g., Costco #1287) |
| **Vendor** | A program/brand being assessed at a store (e.g., RTL-ATT-EDM) |
| **Assessment** | The evaluation form filled out for each vendor |
| **Open** | Store or vendor not yet completed (green badge) |
| **Completed** | Store or vendor assessment submitted (blue badge) |

Never use "visit," "session," "draft," or "assessed" in user-facing text. Internal route stop status `completed` surfaces to the user as "Completed" — never "Assessed."

**Known variance**: The Stores page URL path is `/session` (not `/stores`). This is internal only — visible in the browser address bar but not in any UI text. Not renamed to avoid breaking user bookmarks. Zero user impact.

---

## Dropbox Files (ShopRight-Config folder)

| File | Purpose | Updated By |
|------|---------|------------|
| Book1.xlsx | Two worksheets: **Retail** (store directory — retailer, store #, address, city, state, zip) and **Program** (list of vendor program codes) | Eli, when stores or programs change |
| ShopFile_Template.xlsx | Master Shop File format — headers, colors, widths | Eli, when Smart Circle changes format |
| Invoice_Template.xlsx | Master Invoice format — headers, formulas | Eli, when format changes |

Backend downloads these on demand and caches in memory. After updating Book1.xlsx, run `python3 ingest_stores.py` from the backend directory to reload.

---

## Stripe Configuration

| Item | Live | Test |
|------|------|------|
| Monthly price | price_1TJIMBRsPFnm3irYLta8jhrl ($10/mo) | price_1TJJFLRsPFnm3irYAcJCEFOO |
| Annual price | price_1TJIMBRsPFnm3irY4NJddmvd ($100/yr) | price_1TJJG2RsPFnm3irYWWUYfogX |
| Webhook URL | https://shopright-api.onrender.com/payments/webhook | Same |
| Webhook events | checkout.session.completed, customer.subscription.updated, customer.subscription.deleted | Same |
| Test card | — | 4242 4242 4242 4242, any future date, any CVC |

Code prioritizes live keys (`STRIPE_SECRET_KEY`) over test keys (`STRIPE_TEST_SECRET_KEY`).

---

## User Accounts

| Name | Email | Type | Notes |
|------|-------|------|-------|
| Eli Peterson | j.eli.peterson@gmail.com | Free (owner) | Product owner, admin |
| Kelsey Peterson | kelseympeterson@gmail.com | Free | Primary user |
| Stacy Taggart | stacytaggart66@gmail.com | Free | |
| R Taggart | rtag0824@gmail.com | Free | |
| James (test) | eli@cedarandiron.net | Test account | Used for Stripe/payment testing |

To create a free account: sign up through the app, then run:
```sql
UPDATE public.profiles SET is_free_account = true WHERE report_email = 'email@example.com';
```

---

## Common Operations

### Deploy
Push to `main` branch → Vercel auto-deploys frontend, Render auto-deploys backend.
If Render doesn't auto-deploy, go to Render dashboard → Manual Deploy → Deploy latest commit.

### Add a new store to the directory
1. Update Book1.xlsx in Dropbox
2. Run `python3 ingest_stores.py` from the backend directory (with venv activated)

### Create a free account
1. User signs up through the app
2. In Supabase SQL Editor: `UPDATE public.profiles SET is_free_account = true WHERE report_email = 'their@email.com';`

### Change Stripe from test to live mode
1. On Render, ensure `STRIPE_SECRET_KEY` has the live key (`sk_live_...`)
2. Ensure `STRIPE_MONTHLY_PRICE_ID` and `STRIPE_ANNUAL_PRICE_ID` have live price IDs
3. Ensure `STRIPE_WEBHOOK_SECRET` has the live webhook signing secret

---

## Technical Details

| Item | Value |
|------|-------|
| Python version | 3.9+ (system Python on macOS) |
| Node.js version | v24 LTS |
| Render service ID | srv-d76lou8ule4c73f1m9og |
| Render service name | shopright-api |
| Git user.name | Eli Peterson |
| Git user.email | j.eli.peterson@gmail.com |
| Geocoding service | OpenStreetMap Nominatim (free, 1 request/sec rate limit) |
| Backend .env | Symlinked to root .env (`ln -sf ../../.env backend/.env`) |

### CORS Configuration
Backend allows requests from:
- `http://localhost:5173` (local dev)
- `FRONTEND_URL` env var value
- Any `https://shopright*.vercel.app` (regex match for Vercel preview deploys)

### Supabase Auth Configuration
- Email confirmation: **disabled** (for ease of testing — re-enable for production)
- Password minimum: 6 characters

---

## Working Preferences (Eli)

- Always proceed without asking — never ask "want to proceed?" or "should I continue?"
- Only pause at phase gates where Chrome validation is needed
- Store = location, Vendor = program within store — consistent terminology everywhere
- AI review flags should be read-only with "Re-Review with AI" / "Submit Anyway" — no inline editing
- All user-facing dates: MM/DD/YY. Times: hh:mm AM/PM
- Buttons should look like buttons, not text links
- Render env vars must be managed by Eli through the dashboard — Claude Code cannot access Render

---

## What's Left

- [ ] Kelsey real-world test on an actual shopping day
- [ ] Generated Shop File submitted to and accepted by Smart Circle
- [ ] Custom domain (optional, ~$12/year)
- [ ] Resend verified domain for professional email sender address
- [ ] Error monitoring (Sentry or equivalent)
- [ ] Email confirmation re-enabled for production signups
