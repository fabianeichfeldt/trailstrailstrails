-- Trail status visualization: per-GPX-track closure schedule + free-text hint.
--
-- Status ("open" / "closing soon" / "closed") is derived live from these
-- columns (see src/types/TrailStatus.ts) — there is no separate boolean flag
-- to keep in sync; the dates are the single source of truth.
--
-- No RLS changes needed. public.spot_gpx_trails already has:
--   - "public read trails" FOR SELECT USING (true)
--   - "insert own scope" FOR INSERT WITH CHECK (can_edit_spot(spot_id))
--   - "edit own scope"   FOR UPDATE USING (can_edit_spot(spot_id))
--   - "delete admin only" FOR DELETE USING (is_admin())
-- New nullable columns are automatically covered by all of the above —
-- confirmed against supabase/migrations/20260514075528_remote_schema.sql.
ALTER TABLE public.spot_gpx_trails
  ADD COLUMN closed_from timestamptz,
  ADD COLUMN closed_to   timestamptz,
  ADD COLUMN hint        text;
