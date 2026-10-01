-- LOCAL ONLY: run against a `supabase start` database, NEVER production.
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f scripts/verify-bikepark-rls.sql
-- Runs in one transaction that is rolled back at the end. Raises on the first
-- failed assertion, prints PASS notices otherwise.
-- Needs migration 20261001120000_spotmanager_bikeparks.sql applied.
-- Section 5 is skipped when invitation_codes / redeem_invitation are absent
-- (they exist only on the live DB, not in repo migrations).

BEGIN;

-- Fixtures (superuser, bypasses RLS).
INSERT INTO auth.users (id, aud, role, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'authenticated', 'authenticated', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'authenticated', 'authenticated', 'crew-assigned@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'authenticated', 'authenticated', 'crew-other@test.local');
INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000a2', 'trailcrew'),
  ('00000000-0000-0000-0000-0000000000a3', 'trailcrew');

-- Minimal trail/park rows; other NOT NULL columns without default get dummies.
DO $$
DECLARE r record; cols text; vals text;
BEGIN
  FOR r IN SELECT * FROM (VALUES ('trails','zz-test-trail'),('parks','zz-test-park')) v(t,i) LOOP
    SELECT string_agg(quote_ident(column_name), ','),
           string_agg(CASE WHEN column_name = 'id' THEN quote_literal(r.i)
                           WHEN data_type IN ('text','character varying') THEN quote_literal('x')
                           WHEN data_type = 'boolean' THEN 'true'
                           WHEN data_type = 'uuid' THEN 'gen_random_uuid()'
                           ELSE '0' END, ',')
      INTO cols, vals
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = r.t
      AND is_nullable = 'NO' AND column_default IS NULL;
    EXECUTE format('INSERT INTO public.%I (%s) VALUES (%s)', r.t, cols, vals);
  END LOOP;
END $$;
INSERT INTO public.trailcrew_spots (user_id, spot_id)
  VALUES ('00000000-0000-0000-0000-0000000000a2', 'zz-test-park');

-- Helper: switch to anon (NULL) or a JWT user for the following statements.
CREATE FUNCTION pg_temp.act_as(p_uid text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_uid IS NULL THEN
    PERFORM set_config('request.jwt.claims', '', true);
    EXECUTE 'SET LOCAL ROLE anon';
  ELSE
    PERFORM set_config('request.jwt.claims',
      json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION pg_temp.act_as(text) TO PUBLIC;
GRANT USAGE ON SCHEMA pg_temp TO PUBLIC;

-- 1. anon cannot write bike_park_details --------------------------------------
DO $$
DECLARE n int;
BEGIN
  PERFORM pg_temp.act_as(NULL);
  BEGIN
    INSERT INTO public.bike_park_details (id, status) VALUES ('zz-test-park', 'open');
    RAISE EXCEPTION 'FAIL: anon INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon INSERT rejected';
  END;
  RESET ROLE;
  INSERT INTO public.bike_park_details (id, status) VALUES ('zz-test-park', 'open');
  PERFORM pg_temp.act_as(NULL);
  UPDATE public.bike_park_details SET status = 'closed' WHERE id = 'zz-test-park';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: anon UPDATE changed % rows', n; END IF;
  RAISE NOTICE 'PASS: anon UPDATE affects no rows';
  RESET ROLE;
  DELETE FROM public.bike_park_details WHERE id = 'zz-test-park';
END $$;

-- 2. admin / assigned trailcrew can write; unassigned trailcrew cannot --------
DO $$
DECLARE n int;
BEGIN
  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  INSERT INTO public.bike_park_details (id, status) VALUES ('zz-test-park', 'open');
  UPDATE public.bike_park_details SET status = 'closed' WHERE id = 'zz-test-park';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: admin UPDATE affected % rows', n; END IF;
  RAISE NOTICE 'PASS: admin can insert/update park details';
  RESET ROLE;

  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
  UPDATE public.bike_park_details SET status = 'open', trail_description = 'ok' WHERE id = 'zz-test-park';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: assigned trailcrew UPDATE affected % rows', n; END IF;
  RAISE NOTICE 'PASS: assigned trailcrew can update park details';
  RESET ROLE;

  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
  UPDATE public.bike_park_details SET status = 'closed' WHERE id = 'zz-test-park';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: unassigned trailcrew UPDATE affected % rows', n; END IF;
  RAISE NOTICE 'PASS: unassigned trailcrew UPDATE affects no rows';
  RESET ROLE;

  DELETE FROM public.bike_park_details WHERE id = 'zz-test-park';
  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
  INSERT INTO public.bike_park_details (id, status) VALUES ('zz-test-park', 'open');
  RAISE NOTICE 'PASS: assigned trailcrew can insert park details';
  RESET ROLE;
  DELETE FROM public.bike_park_details WHERE id = 'zz-test-park';

  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
  BEGIN
    INSERT INTO public.bike_park_details (id, status) VALUES ('zz-test-park', 'open');
    RAISE EXCEPTION 'FAIL: unassigned trailcrew INSERT was allowed';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: unassigned trailcrew INSERT rejected';
  END;
  RESET ROLE;
END $$;

-- 3. set_spot_website ------------------------------------------------------------
DO $$
DECLARE v text;
BEGIN
  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a3');
  BEGIN
    PERFORM public.set_spot_website('zz-test-park', 'https://evil.example');
    RAISE EXCEPTION 'FAIL: non-editor could set website';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: non-editor rejected (42501)';
  END;
  RESET ROLE;

  PERFORM pg_temp.act_as(NULL);
  BEGIN
    PERFORM public.set_spot_website('zz-test-park', 'https://evil.example');
    RAISE EXCEPTION 'FAIL: anon could call set_spot_website';
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'PASS: anon cannot execute set_spot_website';
  END;
  RESET ROLE;

  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  BEGIN
    PERFORM public.set_spot_website('zz-test-park', 'javascript:alert(1)');
    RAISE EXCEPTION 'FAIL: javascript: URL accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid_url' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: javascript: URL rejected';
  END;
  BEGIN
    PERFORM public.set_spot_website('zz-test-park', 'https://example.com/' || repeat('a', 500));
    RAISE EXCEPTION 'FAIL: >500 char URL accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'invalid_url' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: >500 char URL rejected';
  END;

  PERFORM public.set_spot_website('zz-test-park', 'https://park.example');
  PERFORM public.set_spot_website('zz-test-trail', 'https://trail.example');
  RESET ROLE;
  SELECT url INTO v FROM public.parks WHERE id = 'zz-test-park';
  IF v IS DISTINCT FROM 'https://park.example' THEN RAISE EXCEPTION 'FAIL: parks.url = %', v; END IF;
  SELECT url INTO v FROM public.trails WHERE id = 'zz-test-trail';
  IF v IS DISTINCT FROM 'https://trail.example' THEN RAISE EXCEPTION 'FAIL: trails.url = %', v; END IF;
  RAISE NOTICE 'PASS: website written to parks and trails respectively';

  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a2');
  PERFORM public.set_spot_website('zz-test-park', '');
  RESET ROLE;
  SELECT url INTO v FROM public.parks WHERE id = 'zz-test-park';
  IF v IS DISTINCT FROM '' THEN RAISE EXCEPTION 'FAIL: blank url not stored, got %', v; END IF;
  RAISE NOTICE 'PASS: assigned trailcrew can clear park website';

  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a1');
  BEGIN
    PERFORM public.set_spot_website('zz-nope', 'https://x.example');
    RAISE EXCEPTION 'FAIL: unknown spot accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'unknown_spot' THEN RAISE; END IF;
    RAISE NOTICE 'PASS: unknown spot rejected';
  END;
  RESET ROLE;
END $$;

-- 4. trailcrew_spots accepts park ids, rejects unknown ids ----------------------
DO $$
BEGIN
  INSERT INTO public.trailcrew_spots (user_id, spot_id)
    VALUES ('00000000-0000-0000-0000-0000000000a3', 'zz-test-park');
  RAISE NOTICE 'PASS: trailcrew_spots accepts a park id';
  BEGIN
    INSERT INTO public.trailcrew_spots (user_id, spot_id)
      VALUES ('00000000-0000-0000-0000-0000000000a3', 'zz-unknown-spot');
    RAISE EXCEPTION 'FAIL: unknown spot id accepted';
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE 'PASS: unknown spot id rejected (foreign_key_violation)';
  END;
END $$;

-- 5. redeem_invitation with a park code (only if present locally) ---------------
DO $$
DECLARE n int;
BEGIN
  IF to_regclass('public.invitation_codes') IS NULL
     OR to_regprocedure('public.redeem_invitation(text)') IS NULL THEN
    RAISE NOTICE 'SKIP: invitation_codes / redeem_invitation not present locally';
    RETURN;
  END IF;
  -- Columns as used by app/communication/invitations.ts.
  INSERT INTO public.invitation_codes (code, spot_id, created_by, expires_at)
    VALUES ('ZZTEST', 'zz-test-park', '00000000-0000-0000-0000-0000000000a1', now() + interval '1 day');
  INSERT INTO auth.users (id, aud, role, email)
    VALUES ('00000000-0000-0000-0000-0000000000a4', 'authenticated', 'authenticated', 'newcrew@test.local');
  PERFORM pg_temp.act_as('00000000-0000-0000-0000-0000000000a4');
  PERFORM public.redeem_invitation('ZZTEST');
  RESET ROLE;
  SELECT count(*) INTO n FROM public.user_roles
    WHERE user_id = '00000000-0000-0000-0000-0000000000a4' AND role = 'trailcrew';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: redeem did not grant trailcrew'; END IF;
  SELECT count(*) INTO n FROM public.trailcrew_spots
    WHERE user_id = '00000000-0000-0000-0000-0000000000a4' AND spot_id = 'zz-test-park';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: redeem did not assign the park'; END IF;
  RAISE NOTICE 'PASS: redeem_invitation grants trailcrew + park assignment';
END $$;

ROLLBACK;
