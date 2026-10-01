-- SpotManager for bikeparks: park-aware spot checks, bikepark details write
-- access via can_edit_spot(), and a column-safe website setter.

-- 1. One existence check across the three spot tables.
CREATE OR REPLACE FUNCTION public.spot_exists(p_id text) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM trails WHERE id = p_id)
      OR EXISTS (SELECT 1 FROM parks WHERE id = p_id)
      OR EXISTS (SELECT 1 FROM dirt_parks WHERE id = p_id)
$$;

-- 2. trailcrew_spots / invitation_codes pointed at trails(id) only, which
--    blocked assigning parks. Replace the FKs with a trigger over all types.
CREATE OR REPLACE FUNCTION public.check_spot_exists() RETURNS trigger
  LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NOT spot_exists(NEW.spot_id) THEN
    RAISE EXCEPTION 'unknown spot %', NEW.spot_id USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END $$;

ALTER TABLE public.trailcrew_spots DROP CONSTRAINT IF EXISTS trailcrew_spots_spot_id_fkey;
CREATE TRIGGER trailcrew_spots_spot_exists
  BEFORE INSERT OR UPDATE OF spot_id ON public.trailcrew_spots
  FOR EACH ROW EXECUTE FUNCTION public.check_spot_exists();

-- invitation_codes is live-DB only (in no migration), so guard for fresh local DBs.
DO $$
BEGIN
  IF to_regclass('public.invitation_codes') IS NOT NULL THEN
    ALTER TABLE public.invitation_codes DROP CONSTRAINT IF EXISTS invitation_codes_spot_id_fkey;
    DROP TRIGGER IF EXISTS invitation_codes_spot_exists ON public.invitation_codes;
    CREATE TRIGGER invitation_codes_spot_exists
      BEFORE INSERT OR UPDATE OF spot_id ON public.invitation_codes
      FOR EACH ROW EXECUTE FUNCTION public.check_spot_exists();
  END IF;
END $$;

-- 3. bike_park_details: description column, status guard, real RLS.
ALTER TABLE public.bike_park_details
  ADD COLUMN IF NOT EXISTS trail_description text,
  ADD CONSTRAINT bike_park_details_description_len
    CHECK (trail_description IS NULL OR char_length(trail_description) <= 2000),
  ADD CONSTRAINT bike_park_details_status_values
    CHECK (status IS NULL OR status IN ('open','closed','limited','unknown')) NOT VALID;

-- Anyone with the public anon key could write these (USING (true)).
DROP POLICY IF EXISTS "set"    ON public.bike_park_details;
DROP POLICY IF EXISTS "update" ON public.bike_park_details;

-- The legacy "get" policy is anon-only, so logged-in users could not read (or upsert) rows.
CREATE POLICY "get details authenticated" ON public.bike_park_details
  FOR SELECT TO authenticated, service_role USING (true);
CREATE POLICY "insert own scope" ON public.bike_park_details
  FOR INSERT TO authenticated WITH CHECK (can_edit_spot(id));
CREATE POLICY "edit own scope" ON public.bike_park_details
  FOR UPDATE TO authenticated, service_role
  USING (can_edit_spot(id)) WITH CHECK (can_edit_spot(id));

-- 4. Website setter. A function rather than an UPDATE policy: RLS cannot
--    restrict columns, and a policy would let trailcrew rewrite
--    name/coordinates/approved on the base rows.
CREATE OR REPLACE FUNCTION public.set_spot_website(p_spot_id text, p_url text) RETURNS void
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_url text := coalesce(btrim(p_url), '');
BEGIN
  IF NOT can_edit_spot(p_spot_id) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF v_url <> '' AND (v_url !~* '^https?://\S+$' OR char_length(v_url) > 500) THEN
    RAISE EXCEPTION 'invalid_url';
  END IF;
  UPDATE trails SET url = v_url WHERE id = p_spot_id;
  IF NOT FOUND THEN UPDATE parks SET url = v_url WHERE id = p_spot_id; END IF;
  IF NOT FOUND THEN UPDATE dirt_parks SET url = v_url WHERE id = p_spot_id; END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown_spot'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.set_spot_website(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_spot_website(text, text) TO authenticated;
