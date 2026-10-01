-- Verification for supabase/migrations/20261001120000_spotmanager_bikeparks.sql
--
-- !! LOCAL DATABASE ONLY (`supabase start` / `supabase db reset`). NEVER run
-- !! this against production: it inserts auth.users rows and throwaway spots.
--
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/verify-bikepark-rls.sql
--
-- Every check RAISEs EXCEPTION on failure, so a clean run = all green.
-- Everything runs in one transaction that is rolled back.

BEGIN;

-- Fixtures (as the postgres superuser) ----------------------------------------
INSERT INTO auth.users (id, instance_id, aud, role, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vbp-admin@example.test'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vbp-crew@example.test'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vbp-other@example.test'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vbp-invitee@example.test'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vbp-plain@example.test');

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'trailcrew'),
  ('00000000-0000-0000-0000-0000000000a3', 'trailcrew')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.trails (id, name, latitude, longitude) VALUES ('vbp-trail', 'VBP Trail', 50, 10);
INSERT INTO public.parks  (id, name, latitude, longitude) VALUES ('vbp-park',  'VBP Park',  50, 10);

INSERT INTO public.trailcrew_spots (user_id, spot_id)
VALUES ('00000000-0000-0000-0000-0000000000a2', 'vbp-park');

-- Helpers ---------------------------------------------------------------------
CREATE FUNCTION pg_temp.act_as(uid uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL role authenticated';
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.act_as(uuid) TO PUBLIC;

-- anon cannot write bike_park_details -----------------------------------------
SET LOCAL role anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$
DECLARE n int;
BEGIN
  BEGIN
    INSERT INTO public.bike_park_details (id, status) VALUES ('vbp-park', 'open');
    RAISE EXCEPTION 'anon INSERT on bike_park_details was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;  -- RLS violation = 42501
  END;
  UPDATE public.bike_park_details SET status = 'closed' WHERE id = 'vbp-park';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'anon UPDATE touched % rows', n; END IF;
END $$;
RESET role;

-- admin can upsert ------------------------------------------------------------
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
DO $$
BEGIN
  INSERT INTO public.bike_park_details (id, status, trail_description)
  VALUES ('vbp-park', 'open', 'admin text')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, trail_description = EXCLUDED.trail_description;
  IF (SELECT trail_description FROM public.bike_park_details WHERE id = 'vbp-park') <> 'admin text' THEN
    RAISE EXCEPTION 'admin upsert not visible';
  END IF;
END $$;
RESET role;

-- assigned trailcrew can upsert (update path of the same row) ------------------
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
DO $$
BEGIN
  INSERT INTO public.bike_park_details (id, status, trail_description)
  VALUES ('vbp-park', 'limited', 'crew text')
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, trail_description = EXCLUDED.trail_description;
  IF (SELECT status FROM public.bike_park_details WHERE id = 'vbp-park') <> 'limited' THEN
    RAISE EXCEPTION 'assigned trailcrew upsert did not apply';
  END IF;
  -- status guard: new writes with a bad value are rejected
  BEGIN
    UPDATE public.bike_park_details SET status = 'bogus' WHERE id = 'vbp-park';
    RAISE EXCEPTION 'bad status accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
END $$;
RESET role;

-- unassigned trailcrew cannot -------------------------------------------------
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
DO $$
DECLARE n int;
BEGIN
  BEGIN
    INSERT INTO public.bike_park_details (id, status) VALUES ('vbp-trail', 'open');
    RAISE EXCEPTION 'unassigned trailcrew INSERT allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.bike_park_details SET status = 'closed' WHERE id = 'vbp-park';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'unassigned trailcrew UPDATE touched % rows', n; END IF;
END $$;
RESET role;

-- set_spot_website ------------------------------------------------------------
SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');  -- non-editor
DO $$
BEGIN
  BEGIN
    PERFORM public.set_spot_website('vbp-park', 'https://evil.example');
    RAISE EXCEPTION 'non-editor set_spot_website allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET role;

SELECT pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');  -- admin
DO $$
BEGIN
  BEGIN
    PERFORM public.set_spot_website('vbp-park', 'javascript:alert(1)');
    RAISE EXCEPTION 'javascript: URL accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid_url' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.set_spot_website('vbp-park', 'https://example.com/' || repeat('a', 500));
    RAISE EXCEPTION '>500 char URL accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid_url' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM public.set_spot_website('vbp-nope', 'https://example.com');
    RAISE EXCEPTION 'unknown spot accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT IN ('unknown_spot') THEN RAISE; END IF;
  END;

  PERFORM public.set_spot_website('vbp-trail', ' https://trail.example/x ');
  PERFORM public.set_spot_website('vbp-park',  'https://park.example/y');
  IF (SELECT url FROM public.trails WHERE id = 'vbp-trail') <> 'https://trail.example/x' THEN
    RAISE EXCEPTION 'trail url not updated/trimmed';
  END IF;
  IF (SELECT url FROM public.parks WHERE id = 'vbp-park') <> 'https://park.example/y' THEN
    RAISE EXCEPTION 'park url not updated';
  END IF;
  IF (SELECT url FROM public.trails WHERE id = 'vbp-trail') = (SELECT url FROM public.parks WHERE id = 'vbp-park') THEN
    RAISE EXCEPTION 'wrong table updated';
  END IF;
END $$;
RESET role;

-- anon cannot even call it
SET LOCAL role anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.set_spot_website('vbp-park', 'https://evil.example');
    RAISE EXCEPTION 'anon may execute set_spot_website';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET role;

-- trailcrew_spots accepts park ids, rejects unknown ones ----------------------
DO $$
BEGIN
  INSERT INTO public.trailcrew_spots (user_id, spot_id)
  VALUES ('00000000-0000-0000-0000-0000000000a3', 'vbp-park');
  BEGIN
    INSERT INTO public.trailcrew_spots (user_id, spot_id)
    VALUES ('00000000-0000-0000-0000-0000000000a3', 'vbp-does-not-exist');
    RAISE EXCEPTION 'unknown spot id accepted by trailcrew_spots';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;
END $$;

-- redeem_invitation with a park code -----------------------------------------
-- invitation_codes / redeem_invitation exist only in the live DB (no migration);
-- skipped with a NOTICE on a DB that lacks them.
DO $$
BEGIN
  IF to_regclass('public.invitation_codes') IS NULL
     OR to_regprocedure('public.redeem_invitation(text)') IS NULL THEN
    RAISE NOTICE 'SKIPPED redeem_invitation check: invitation_codes/redeem_invitation not present locally';
    RETURN;
  END IF;

  INSERT INTO public.invitation_codes (code, spot_id, created_by, expires_at)
  VALUES ('VBPTST', 'vbp-park', '00000000-0000-0000-0000-0000000000a1', now() + interval '1 day');

  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
  PERFORM public.redeem_invitation('VBPTST');
  RESET role;

  IF (SELECT role FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-0000000000a4') <> 'trailcrew' THEN
    RAISE EXCEPTION 'redeem_invitation did not grant trailcrew';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trailcrew_spots
                 WHERE user_id = '00000000-0000-0000-0000-0000000000a4' AND spot_id = 'vbp-park') THEN
    RAISE EXCEPTION 'redeem_invitation did not assign the park';
  END IF;
END $$;

DO $$ BEGIN RAISE NOTICE 'verify-bikepark-rls: all checks passed'; END $$;
ROLLBACK;
