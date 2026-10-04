-- Applied to the shopright project (eghvaqontbtnthgfrfod) on Oct 4, 2026
-- as Supabase migration vendor_visits_visit_time_nullable.
-- Accept Route inserts visit_time as null; the assessment form fills in
-- the shopper's local time when the form is first opened.
-- Safe to re-run.

ALTER TABLE public.vendor_visits ALTER COLUMN visit_time DROP NOT NULL;

COMMENT ON COLUMN public.vendor_visits.visit_time IS
  'Shopper local time when the assessment is first opened. Null when Accept Route creates the row; the form fills it in. Not the server clock and not the time the route was accepted.';

NOTIFY pgrst, 'reload schema';
