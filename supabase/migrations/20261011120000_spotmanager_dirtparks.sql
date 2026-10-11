-- SpotManager for dirtparks: same model as bikeparks (20261001120000), plus a
-- column-safe setter for the pumptrack / dirt-jump flags on dirt_parks.

-- 1. The legacy dirt_parks SELECT policy is anon-only, so the SpotManager
--    (user JWT) would silently list zero dirtparks.
DROP POLICY IF EXISTS "select authenticated" ON public.dirt_parks;
CREATE POLICY "select authenticated" ON public.dirt_parks
  FOR SELECT TO authenticated USING (true);

-- 2. dirt_park_details: description column, status guard, real RLS.
ALTER TABLE public.dirt_park_details
  ADD COLUMN IF NOT EXISTS trail_description text,
  ADD CONSTRAINT dirt_park_details_description_len
    CHECK (trail_description IS NULL OR char_length(trail_description) <= 2000),
  ADD CONSTRAINT dirt_park_details_status_values
    CHECK (status IS NULL OR status IN ('open','closed','limited','unknown')) NOT VALID;

-- Anyone with the public anon key could write these (USING (true)).
DROP POLICY IF EXISTS "add dirt park details" ON public.dirt_park_details;
DROP POLICY IF EXISTS "update"                ON public.dirt_park_details;

-- The legacy "get details" policy is anon-only, so logged-in users could not read (or upsert) rows.
CREATE POLICY "get details authenticated" ON public.dirt_park_details
  FOR SELECT TO authenticated, service_role USING (true);
CREATE POLICY "insert own scope" ON public.dirt_park_details
  FOR INSERT TO authenticated WITH CHECK (can_edit_spot(id));
CREATE POLICY "edit own scope" ON public.dirt_park_details
  FOR UPDATE TO authenticated, service_role
  USING (can_edit_spot(id)) WITH CHECK (can_edit_spot(id));

-- 3. Pumptrack / dirt-jump flags. A function rather than an UPDATE policy:
--    RLS cannot restrict columns (name/coordinates/approved stay locked).
CREATE OR REPLACE FUNCTION public.set_dirtpark_kind(p_spot_id text, p_pumptrack boolean, p_dirtpark boolean)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT can_edit_spot(p_spot_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF NOT (coalesce(p_pumptrack, false) OR coalesce(p_dirtpark, false)) THEN
    RAISE EXCEPTION 'kind_required';
  END IF;
  UPDATE dirt_parks SET pumptrack = coalesce(p_pumptrack, false), dirtpark = coalesce(p_dirtpark, false)
    WHERE id = p_spot_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_spot'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.set_dirtpark_kind(text, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_dirtpark_kind(text, boolean, boolean) TO authenticated;
