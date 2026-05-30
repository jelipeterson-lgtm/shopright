# ShopRight — Build Progress Tracker

**Last Updated:** May 29, 2026
**Current Phase:** All phases complete — active production
**Overall Status:** Production

---

## Phases 0–8 Complete

All build phases completed and validated by Eli between April 1–7, 2026.

| Phase | Description | Sign-off |
|-------|-------------|----------|
| Setup | Node, Git, GitHub, Vercel, Render, Supabase, Stripe, Resend, Dropbox, .env | April 1, 2026 |
| Phase 0 | Full stack scaffolded and deployed — React + FastAPI + Supabase, end-to-end health check | April 1, 2026 |
| Phase 1 | Auth + profile — 3-step signup, login, settings, API key test, Supabase RLS | April 1, 2026 |
| Phase 2 | Store directory from Dropbox, GPS nearby, manual search, program picklist | April 1, 2026 |
| Phase 3 | Full session flow — drafts, gates, close store, manual entry with past dates | April 1, 2026 |
| Phase 4 | Assessment form — 40 fields, conditional logic, voice input, auto-save | April 1, 2026 |
| Phase 5 | AI review — Claude Haiku, flags, re-review loop, submit anyway | April 1, 2026 |
| Phase 6 | Shop File + Invoice generation — template-copy, Resend email, Excel validated | April 2, 2026 |
| Phase 7 | Stripe subscriptions — checkout, webhooks, paywall, 14-day trial, promo codes | April 6, 2026 |
| Phase 8 | Polish + launch — PWA, responsive, bottom nav, help chatbot, landing page | April 7, 2026 |

---

## Post-Launch Changes

| Change | Date | Notes |
|--------|------|-------|
| Utah store deduplication | April 2026 | Fixed duplicate store entries for Utah Costco locations |
| Google Maps replaced with OpenRouteService | May 2026 | Route optimization now uses ORS Distance Matrix API (central key) |
| ORS URL changed to api.heigit.org | May 29, 2026 | Updated ORS API base URL to current endpoint |
| departure_time parameter removed | May 29, 2026 | Removed unsupported parameter from ORS API calls |
| git index corruption resolved | May 29, 2026 | Stray `index 2` file caused git failures; fixed by fresh clone |
| Invoice download button restored | May 30, 2026 | Download was broken (placeholder error); fixed with fetch+blob pattern |
| Invoice date filter bugs fixed | May 30, 2026 | Stale closure and toISOString() UTC flip reintroduced by May rewrite; corrected |
| Invoice period dropdowns | May 30, 2026 | Number inputs replaced with 1–31 select dropdowns; end day defaults to 31 |
| Route GPS mid-route re-optimize | May 30, 2026 | Re-optimize now uses current GPS location as start when stops are completed |
| Route drag auto-scroll | May 30, 2026 | Page auto-scrolls when dragging stops near viewport edges |
| HERE Maps routing | May 30, 2026 | Route optimizer uses HERE Maps Matrix Routing v8 (traffic-aware); ORS is automatic fallback |
| Invoice email removed | May 30, 2026 | Monthly Invoice is download-only; send/email functionality removed (Resend sandbox can't send to non-owner addresses) |

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
| Removed "End Session" concept | Session/end-session was confusing and did nothing useful. Bottom nav handles navigation. Store close gates prevent mistakes. | April 2026 |
| Renamed Session → Stores | "Session" was confusing. "Today's Stores" is clearer. Consistent Store/Vendor terminology throughout. | April 2026 |
| Landing page for Eli Peterson Consulting LLC | Stripe requires a visible business website. Landing page at root URL with company info, contact form, and ShopRight app link. | April 2026 |
| Separate Profile and Settings pages | Profile = personal info. Settings = AI review, password, subscription, sign out. Clearer separation. | April 2026 |
| Blue bottom navigation bar | Professional mobile app feel. 5 tabs: Home, Stores, Reports, Profile, Settings. | April 2026 |
| AI help chatbot | Context-aware floating ? button on every page. Uses user's Anthropic key. Comprehensive system prompt covering entire app workflow. | April 2026 |

---

## Known Issues & Remaining Work

| Item | Status | Notes |
|------|--------|-------|
| Render cold starts | Known | Free tier sleeps after 15min inactivity. First request takes ~30s. Upgrade to $7/mo paid tier to fix. |
| Resend sender domain | Not configured | Emails send from onboarding@resend.dev (goes to spam). Need verified domain for production email. |
| Custom domain | Not purchased | App runs on shopright-jet.vercel.app. Optional: buy domain (~$12/yr) for professional URL. |
| Email confirmation | Disabled | Supabase email confirmation is off for easy testing. Re-enable for production. |
| Error monitoring | Not set up | Sentry or equivalent not configured. |
| Sent reports archive | Partial | Download works, but no persistent archive of previously sent reports. |
| Kelsey real-world validation | Pending | Awaiting Kelsey's first full shopping day using the app. |
| Smart Circle acceptance | Pending | Generated Shop File not yet submitted to Smart Circle. Depends on Kelsey test. |

---

## Session Log

| Date | Phase | What Was Done | Next Step |
|------|-------|---------------|-----------|
| March 2026 | Setup | PRD v3 complete. Setup Guide, CLAUDE.md, PROGRESS.md created. Ready to begin setup. | Complete Section 3 of Setup Guide |
| April 1, 2026 | Setup + Phase 0 | All setup steps completed. Scaffolded React+Tailwind frontend and FastAPI backend. Deployed to Vercel and Render. End-to-end health check verified. | Phase 1 — Auth & Profile |
| April 1, 2026 | Phase 1 | Auth + profile complete. 3-step signup, login, settings, API key test, Supabase profiles table with RLS. Fixed auth token propagation and added inline API key setup instructions. | Phase 2 — Store Directory & GPS |
| April 1, 2026 | Phase 2 | Store directory loaded from Dropbox (44 stores, 37 geocoded). GPS nearby, manual search, program picklist all working. | Phase 3 — Session & Visit Flow |
| April 1, 2026 | Phase 3 | Full session flow working. Drafts, complete, close store, end session gates, manual entry with past dates. | Phase 4 — Assessment Form |
| April 1, 2026 | Phase 4 | Full assessment form: 3 zones, EvaluationField component, voice input, auto-save, all conditional logic working. | Phase 5 — AI Review & Submission |
| April 1, 2026 | Phase 5 | AI review with Claude Haiku, flags with field highlighting, re-review loop, submit anyway, cancel/discard. Editable program field. N/A blue highlight. | Phase 6 — Report & Invoice Generation |
| April 2, 2026 | Phase 6 | Shop File and Invoice generation with template-copy. Email via Resend. Weekly/monthly screens. Excel formatting validated. Invoice: YYMM numbering, single mileage line, uniform borders, phone formatting, date formatting. Numerous UX fixes across all phases. | Phase 7 — Payments |
| April 6, 2026 | Phase 7 | Stripe test mode checkout, webhooks, paywall, 14-day trial, promo codes, free accounts. Landing page for Eli Peterson Consulting LLC. | Phase 8 — Polish & Launch |
| April 6, 2026 | Phase 8 | Major UX overhaul: dashboard with logo, bottom nav, profile/settings split, AI help chatbot, consistent Store/Vendor terminology, Open/Completed statuses, date formatting, clean assessment header, empty store handling. | Final validation |
| April 6, 2026 | Phase 8+ | Stripe live/test key separation, production Stripe webhooks, Getting Started tutorial, Help Guide FAQ, standardized page headers, blue bottom nav, landing page logo. | Real-world test |
| April 7, 2026 | Production | Documentation overhaul. Created free accounts for Stacy Taggart and R Taggart. All 8 phases complete. App in production. Awaiting Kelsey's real-world validation. | Kelsey field test |
| April 24, 2026 | Bug fixes + Store Mgmt | Fixed "Assessed" → "Completed" on all status badges. Fixed visit timestamp bug. Fixed Costco #1019 lat/lon (South Jordan UT). Added Costco #1703 (Ridgefield WA). Added Settings → Sync Store Directory button. Fixed Supabase 1000-row limit on store queries. Improved geocoding with address fallbacks. | Continued real-world validation |
| May 29, 2026 | Maintenance | Diagnosed and fixed git repository corruption caused by stray `index 2` file. Fresh cloned repo. ORS API URL fixed (api.heigit.org). departure_time parameter removed from ORS calls. MD files updated. | Continued real-world validation |
| May 30, 2026 | Bug fixes + Feature | Invoice download button restored. Invoice date stale closure and UTC flip fixed. Invoice period dropdowns (1–31 selects, end defaults to 31). Route re-optimize uses current GPS location mid-route. Drag auto-scroll added. HERE Maps Matrix Routing v8 integrated (traffic-aware ETAs, ORS fallback). ORS diagnostic logging deployed. Invoice email/send removed — download only. | ORS timeout root cause pending — check Render logs on next failure |

---

*This file is the source of truth for ShopRight build progress.*
*Claude Code updates it after every task. Eli signs off at every phase gate.*
