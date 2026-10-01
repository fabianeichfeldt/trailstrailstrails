-- Verification for supabase/migrations/20261001120000_spotmanager_bikeparks.sql
--
-- LOCAL database only, never production:
--   supabase start && supabase db reset
--   psql "$(supabase status -o env | grep ^DB_URL | cut -d'"' -f2)" -f scripts/verify-bikepark-rls.sql
--
-- Every check RAISEs on failure, so a clean run = all green. Runs in a
-- rolled-back transaction; throwaway rows only.

BEGIN;

CREATE OR REPLACE FUNCTION pg_temp.as_user(p_uid uuid, p_role text) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', p_role)::text, true);
  EXECUTE format('SET LOCAL ROLE %I', p_role);
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.as_user(uuid, text) TO PUBLIC;

-- Fixtures (as superuser)
INSERT INTO auth.users (id, instance_id, aud, role, email)
VALUES ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vbp-admin@test.local'),
       ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vbp-crew@test.local'),
       ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'vbp-other@test.local');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'trailcrew'),
  ('00000000-0000-0000-0000-0000000000a3', 'trailcrew')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
INSERT INTO public.parks (id, name, latitude, longitude) VALUES ('vbp-park', 'VBP Park', 50, 10);
INSERT INTO public.trails (id, name, latitude, longitude) VALUES ('vbp-trail', 'VBP Trail', 50, 10);
INSERT INTO public.trailcrew_spots (user_id, spot_id) VALUES
  ('00000000-0000-0000-0000-0000000000a2', 'vbp-park'),
  ('00000000-0000-0000-0000-0000000000a2', 'vbp-trail');

-- 1. anon cannot write bike_park_details
DO $$
BEGIN
  PERFORM pg_temp.as_user(NULL, 'anon');
  BEGIN
    INSERT INTO public.bike_park_details (id, status) VALUES ('vbp-park', 'open');
    RAISE EXCEPTION 'anon INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  -- UPDATE has no visible policy: must affect 0 rows (or be refused)
  BEGIN
    UPDATE public.bike_park_details SET status = 'closed' WHERE id = 'vbp-park';
    ASSERT NOT FOUND, 'anon UPDATE touched a row';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;
  RAISE NOTICE 'anon write rejected: OK';
END $$;

-- 2. admin and assigned trailcrew can upsert; unassigned cannot
DO $$
BEGIN
  PERFORM pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'authenticated');
  INSERT INTO public.bike_park_details (id, status) VALUES ('vbp-park', 'open');
  RESET ROLE;

  PERFORM pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'authenticated');
  UPDATE public.bike_park_details SET status = 'closed', trail_description = 'x' WHERE id = 'vbp-park';
  ASSERT FOUND, 'assigned trailcrew UPDATE failed';
  RESET ROLE;

  PERFORM pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'authenticated');
  UPDATE public.bike_park_details SET status = 'open' WHERE id = 'vbp-park';
  ASSERT NOT FOUND, 'unassigned trailcrew UPDATE succeeded';
  BEGIN
    INSERT INTO public.bike_park_details (id, status) VALUES ('vbp-park', 'open');
    RAISE EXCEPTION 'unassigned trailcrew INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege OR unique_violation THEN NULL; END;
  RESET ROLE;

  -- constraints
  BEGIN
    UPDATE public.bike_park_details SET trail_description = repeat('a', 2001) WHERE id = 'vbp-park';
    RAISE EXCEPTION 'description length check missing';
  EXCEPTION WHEN check_violation THEN NULL; END;
  RAISE NOTICE 'bike_park_details RLS: OK';
END $$;

-- 3. set_spot_website
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'authenticated');
  BEGIN
    PERFORM public.set_spot_website('vbp-park', 'https://example.com');
    RAISE EXCEPTION 'non-editor allowed';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
  RESET ROLE;

  PERFORM pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'authenticated');
  BEGIN
    PERFORM public.set_spot_website('vbp-park', 'javascript:alert(1)');
    RAISE EXCEPTION 'javascript: url accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'invalid_url', SQLERRM; END;
  BEGIN
    PERFORM public.set_spot_website('vbp-park', 'https://e.com/' || repeat('a', 500));
    RAISE EXCEPTION 'overlong url accepted';
  EXCEPTION WHEN raise_exception THEN ASSERT SQLERRM = 'invalid_url', SQLERRM; END;
  PERFORM public.set_spot_website('vbp-park', ' https://park.example ');
  PERFORM public.set_spot_website('vbp-trail', 'http://trail.example');
  RESET ROLE;

  SELECT url INTO v FROM public.parks WHERE id = 'vbp-park';
  ASSERT v = 'https://park.example', 'park url: ' || coalesce(v, 'null');
  SELECT url INTO v FROM public.trails WHERE id = 'vbp-trail';
  ASSERT v = 'http://trail.example', 'trail url: ' || coalesce(v, 'null');
  RAISE NOTICE 'set_spot_website: OK';
END $$;

-- 4. trailcrew_spots accepts park ids, rejects unknown ids
DO $$
BEGIN
  INSERT INTO public.trailcrew_spots (user_id, spot_id)
    VALUES ('00000000-0000-0000-0000-0000000000a3', 'vbp-park');
  BEGIN
    INSERT INTO public.trailcrew_spots (user_id, spot_id)
      VALUES ('00000000-0000-0000-0000-0000000000a3', 'vbp-does-not-exist');
    RAISE EXCEPTION 'unknown spot accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  RAISE NOTICE 'trailcrew_spots spot check: OK';
END $$;

-- 5. redeem_invitation with a park code (live-only objects; skipped if absent
--    locally; the function's signature is assumed to be (p_code text)).
DO $$
DECLARE r regprocedure := to_regprocedure('public.redeem_invitation(text)');
BEGIN
  IF to_regclass('public.invitation_codes') IS NULL OR r IS NULL THEN
    RAISE NOTICE 'redeem_invitation / invitation_codes missing locally: SKIPPED';
    RETURN;
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES ('00000000-0000-0000-0000-0000000000a4', 'user')
    ON CONFLICT DO NOTHING;
  RAISE NOTICE 'redeem_invitation present: complete this check against the live column set';
END $$;

ROLLBACK;
