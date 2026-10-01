-- Run against a LOCAL `supabase start` database only, never production:
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f scripts/verify-bikepark-rls.sql
-- Everything runs in one transaction and is rolled back at the end.
-- Assumes the schema from supabase/migrations is applied. Any failed
-- assertion raises and aborts the script.
BEGIN;

CREATE TEMP TABLE _r (name text, ok boolean);
GRANT ALL ON _r TO anon, authenticated;

-- Fixtures: one park, one trail, three users (admin / assigned crew / other crew).
INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin@x.test'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crew@x.test'),
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@x.test');
INSERT INTO public.parks (id, name, latitude, longitude) VALUES ('rls-park', 'RLS Park', 47, 11);
INSERT INTO public.trails (id, name, latitude, longitude) VALUES ('rls-trail', 'RLS Trail', 47, 11);
INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000b1', 'trailcrew'),
  ('00000000-0000-0000-0000-0000000000c1', 'trailcrew');
INSERT INTO public.trailcrew_spots (user_id, spot_id) VALUES ('00000000-0000-0000-0000-0000000000b1', 'rls-park');  -- park id accepted (no FK to trails)

-- Unknown spot id rejected by trigger.
DO $$ BEGIN
  BEGIN
    INSERT INTO public.trailcrew_spots (user_id, spot_id) VALUES ('00000000-0000-0000-0000-0000000000c1', 'nope');
    RAISE EXCEPTION 'unknown spot id was accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;

-- Helper: run a statement as a role/user and report whether it was blocked.
CREATE FUNCTION pg_temp.attempt(p_role text, p_uid text, p_sql text) RETURNS boolean
LANGUAGE plpgsql AS $$
DECLARE n int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', p_role)::text, true);
  EXECUTE 'SET LOCAL ROLE ' || p_role;
  BEGIN
    EXECUTE p_sql;
    GET DIAGNOSTICS n = ROW_COUNT;
    RESET ROLE;
    RETURN n > 0;
  EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN false;
  END;
END $$;

DO $$
DECLARE
  adm  text := '00000000-0000-0000-0000-0000000000a1';
  crew text := '00000000-0000-0000-0000-0000000000b1';
  oth  text := '00000000-0000-0000-0000-0000000000c1';
  ins  text := $q$INSERT INTO public.bike_park_details (id, status) VALUES ('rls-park', 'open') ON CONFLICT (id) DO UPDATE SET status = 'closed'$q$;
BEGIN
  -- anon cannot write
  IF pg_temp.attempt('anon', adm, ins) THEN RAISE EXCEPTION 'anon wrote bike_park_details'; END IF;
  -- unassigned crew cannot write
  IF pg_temp.attempt('authenticated', oth, ins) THEN RAISE EXCEPTION 'unassigned crew wrote'; END IF;
  -- assigned crew and admin can
  IF NOT pg_temp.attempt('authenticated', crew, ins) THEN RAISE EXCEPTION 'assigned crew blocked'; END IF;
  IF NOT pg_temp.attempt('authenticated', adm, ins) THEN RAISE EXCEPTION 'admin blocked'; END IF;
END $$;

-- set_spot_website
DO $$
DECLARE
  crew text := '00000000-0000-0000-0000-0000000000b1';
  oth  text := '00000000-0000-0000-0000-0000000000c1';
  adm  text := '00000000-0000-0000-0000-0000000000a1';
  v text;
BEGIN
  IF pg_temp.attempt('authenticated', oth,  $q$SELECT public.set_spot_website('rls-park','https://ok.test')$q$) THEN
    -- SELECT of a void function returns 1 row on success, so true means it was allowed
    RAISE EXCEPTION 'non-editor could set website';
  END IF;
  IF pg_temp.attempt('authenticated', crew, $q$SELECT public.set_spot_website('rls-park','javascript:alert(1)')$q$) THEN RAISE EXCEPTION 'javascript: url accepted'; END IF;
  IF pg_temp.attempt('authenticated', crew, format($q$SELECT public.set_spot_website('rls-park','https://%s')$q$, repeat('a', 600))) THEN RAISE EXCEPTION '>500 chars accepted'; END IF;
  IF NOT pg_temp.attempt('authenticated', crew, $q$SELECT public.set_spot_website('rls-park','https://park.test')$q$) THEN RAISE EXCEPTION 'crew could not set park website'; END IF;
  IF NOT pg_temp.attempt('authenticated', adm,  $q$SELECT public.set_spot_website('rls-trail','https://trail.test')$q$) THEN RAISE EXCEPTION 'admin could not set trail website'; END IF;
  SELECT url INTO v FROM public.parks WHERE id = 'rls-park';
  IF v <> 'https://park.test' THEN RAISE EXCEPTION 'park url not updated (%)', v; END IF;
  SELECT url INTO v FROM public.trails WHERE id = 'rls-trail';
  IF v <> 'https://trail.test' THEN RAISE EXCEPTION 'trail url not updated (%)', v; END IF;
END $$;

-- redeem_invitation with a park-spot code: grants trailcrew + assignment.
-- Adjust the column list below if invitation_codes differs locally.
DO $$
DECLARE c text := 'RLSPARKCODE'; n int;
BEGIN
  INSERT INTO public.invitation_codes (code, spot_id) VALUES (c, 'rls-park');
  PERFORM set_config('request.jwt.claims', json_build_object('sub','00000000-0000-0000-0000-0000000000c1','role','authenticated')::text, true);
  PERFORM public.redeem_invitation(c);
  SELECT count(*) INTO n FROM public.trailcrew_spots
    WHERE user_id = '00000000-0000-0000-0000-0000000000c1' AND spot_id = 'rls-park';
  IF n <> 1 THEN RAISE EXCEPTION 'redeem_invitation did not assign the park'; END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'verify-bikepark-rls: all assertions passed'; END $$;
ROLLBACK;
