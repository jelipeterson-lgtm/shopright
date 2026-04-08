# Route Planner — Feature Plan

## Overview
Optional feature that helps shoppers plan their shopping day route to maximize earnings per hour ($100/hr target). Takes pasted email/text inputs, builds an optimized route considering drive times, vendor counts per store, and earnings.

---

## Data Flow

### Morning (before leaving)
1. User receives email from Smart Circle with active events for the week
2. User opens Route Planner in ShopRight
3. Sets start location (default: profile home address) and end location (default: same)
4. Pastes email content into a text box
5. App parses the email → extracts stores + vendors active today
6. Filters to stores within reasonable driving distance of start location
7. Checks which stores have already been visited 2x this calendar month (skip those unless they have an unassessed vendor)
8. Builds initial optimized route using Google Maps Distance Matrix API

### 11am Check-in
1. User receives text message with check-ins
2. Pastes text into Route Planner "Add Check-ins" box
3. App parses → adds confirmed vendors to the route
4. Re-optimizes considering: current location (or last completed store), remaining time, new stops

### 2pm Check-in
1. Same as 11am — paste, parse, re-optimize
2. Route accounts for what's already been completed today

---

## Route Optimization Logic

### Inputs
- List of stores with confirmed vendors (from email + check-ins)
- Store coordinates (from stores table, geocoded)
- Start location + end location (coordinates)
- Time constraints: ~20min per store + ~7.5min per additional vendor
- Drive times between all locations (Google Maps Distance Matrix, traffic-aware)
- Monthly visit history (max 2 visits per store per calendar month unless unassessed vendor)

### Earnings Model
- First vendor at a store: $50
- Each additional vendor at same store: $15
- Goal: maximize $/hour from departure to return

### Algorithm
1. Calculate earnings per store: $50 + ($15 × additional_vendors)
2. Calculate time per store: 20min + (7.5min × additional_vendors)
3. Get drive time matrix between all candidate stores (Google Maps)
4. Use greedy nearest-neighbor with earnings weighting:
   - Score each next store = earnings / (drive_time + assessment_time)
   - Pick highest score
   - Repeat until estimated return time or no more stores
5. Re-run when check-ins add new stores

### Output
- Ordered list of stores with:
  - Store name, number, address
  - Vendors to assess at each stop
  - Estimated arrival time
  - Estimated time at store
  - Estimated earnings at this stop
  - Drive time/distance to next stop
- Running totals: total earnings, total time, $/hour projection
- Stores grouped: Completed | Current/Next | Upcoming | Skipped

---

## Database Changes

### profiles table — new columns
- `google_maps_api_key` text — user's own Google Maps API key
- `default_start_address` text — default route start (falls back to home_address)
- `default_end_address` text — default route end (falls back to start address)

### New table: route_plans
- `id` uuid PK
- `user_id` uuid FK → profiles
- `plan_date` date
- `start_address` text
- `end_address` text
- `raw_email_input` text — original pasted email
- `raw_checkin_inputs` text[] — array of pasted check-in texts
- `stores_data` jsonb — parsed stores + vendors + order + status
- `created_at` timestamptz
- `updated_at` timestamptz

### New table: store_visit_history
- `id` uuid PK
- `user_id` uuid FK → profiles
- `store_number` text
- `retailer_name` text
- `visit_month` text — YYYY-MM format
- `visit_count` integer
- Unique on (user_id, store_number, retailer_name, visit_month)

This tracks the "2 visits per store per calendar month" rule. Updated when a vendor assessment is completed.

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /route/parse-email | Parse pasted email → return extracted stores/vendors |
| POST | /route/parse-checkin | Parse pasted check-in text → return confirmed stores |
| POST | /route/optimize | Build/rebuild optimized route given stores + start/end |
| GET | /route/plan/{date} | Get saved route plan for a date |
| PUT | /route/plan/{date} | Update route (reorder, add/remove stores) |
| POST | /route/plan/{date}/complete-stop | Mark a store as completed on the route |
| GET | /route/visit-history | Get monthly visit counts for stores |

---

## Frontend Pages

### Route Planner (new page, accessible from Home + bottom nav)
- **Header**: date, start/end locations (editable)
- **Input section**: 
  - "Paste Event Email" — large text box + Parse button
  - "Paste Check-in Text" — large text box + Parse button (can be used multiple times)
- **Route display**:
  - Ordered list of stores
  - Each store card shows: name, #, address, vendors, est. arrival, est. time, est. earnings
  - Color coding: green = completed, blue = next up, white = upcoming, grey = skipped
  - Drag-and-drop reorder
  - Tap to expand: see individual vendors, add/remove stores
- **Summary bar** (sticky): total stops, total earnings, est. time, projected $/hr
- **Manual add**: search for a store and add it to the route

### Settings additions
- Google Maps API key (same pattern as Anthropic key: instructions, paste, test, save)
- Default start address
- Default end address

---

## Phases

### Phase 9A — Database + Parsing (1 session)
- Add profile columns + new tables (SQL)
- Backend: email parser (handles the 3 sample formats)
- Backend: check-in text parser (handles tab-delimited format)
- Backend: monthly visit history tracking
- Settings: Google Maps API key + default addresses
- Lowe's N/A rule: when Reps Present = N/A at Lowe's, default all fields to N/A

### Phase 9B — Route Optimization (1 session)
- Backend: Google Maps Distance Matrix integration
- Backend: route optimization algorithm
- Backend: re-optimization with completed stops
- Frontend: Route Planner page with paste + parse + display

### Phase 9C — Route UX (1 session)
- Drag-and-drop reorder
- Complete stop tracking
- Manual store add/remove
- Summary bar with earnings projection
- Update to Reps Present: add N/A option for Lowe's

---

## Assessment Change: Reps Present N/A Option
Applies to ALL stores (not just Lowe's):
- Reps Present now has 3 options: Pass / Fail / N/A
- N/A = vendor not applicable or just confirming presence
- When N/A selected: ALL evaluation fields default to N/A
- Visit Recap still required
- Different from Fail: Fail means "reps should be here but aren't" and hides eval fields with blank output. N/A means "not applicable" and outputs N/A for all fields.

---

## Google Maps API Setup Instructions (for Settings)
1. Go to console.cloud.google.com
2. Create a project (or select existing)
3. Go to APIs & Services > Library
4. Enable "Distance Matrix API"
5. Go to APIs & Services > Credentials
6. Create API Key (or copy existing)
7. Paste in ShopRight Settings
8. Typical cost: $5/1000 route calculations
