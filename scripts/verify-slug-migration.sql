-- Verification for supabase/migrations/20260901120000_add_spot_slugs.sql
--
-- Run against a database that already has the migration applied:
--   supabase db reset                # applies all migrations to local
--   psql "$(supabase db url)" -f scripts/verify-slug-migration.sql
--
-- Every check RAISEs EXCEPTION on failure, so a clean run = all green.
-- Wrapped in a rolled-back transaction: it inserts throwaway spot rows and
-- leaves the database untouched.

BEGIN;

DO $$
DECLARE
  v text;
BEGIN
  -- ── slugify() ────────────────────────────────────────────────────────────
  ASSERT public.slugify('Bierstadttrails Kulmbach')       = 'bierstadttrails-kulmbach';
  ASSERT public.slugify('Wällertour – Hoher Westerwald')  = 'waellertour-hoher-westerwald';
  ASSERT public.slugify('Böser Wolf')                     = 'boeser-wolf';
  ASSERT public.slugify('Trailpark Rabenberg (Erzgebirge)') = 'trailpark-rabenberg-erzgebirge';
  ASSERT public.slugify('Café del Mar')                   = 'cafe-del-mar';
  ASSERT public.slugify('  spaced  out  ')                = 'spaced-out';
  ASSERT public.slugify('Äöü Straße')                     = 'aeoeue-strasse';
  ASSERT public.slugify('🚵 Secret')                      = 'secret';
  ASSERT public.slugify('!!!')                            = 'spot';
  ASSERT public.slugify('')                               = 'spot';
  ASSERT public.slugify(NULL)                             = 'spot';
  -- 60-char cap, trimmed at a hyphen boundary
  v := public.slugify(repeat('ab ', 40));
  ASSERT length(v) <= 60, format('length cap failed: %s (%s)', v, length(v));
  ASSERT right(v, 1) <> '-';
  RAISE NOTICE 'slugify(): OK';
END $$;

DO $$
DECLARE
  v_slug text;
  v_slug2 text;
  v_id  text := 'test-slug-' || gen_random_uuid()::text;
  v_id2 text := 'test-slug-' || gen_random_uuid()::text;
BEGIN
  -- ── INSERT assigns a slug ────────────────────────────────────────────────
  INSERT INTO public.trails (id, name, latitude, longitude)
    VALUES (v_id, 'Verify Flowtrail', 47.1, 11.1);
  SELECT slug INTO v_slug FROM public.trails WHERE id = v_id;
  ASSERT v_slug = 'verify-flowtrail', format('insert slug: %s', v_slug);
  ASSERT EXISTS (SELECT 1 FROM public.spot_slugs
                 WHERE slug = 'verify-flowtrail' AND spot_id = v_id
                   AND spot_type = 'trail' AND is_current);

  -- ── collision → -2 ──────────────────────────────────────────────────────
  INSERT INTO public.parks (id, name, latitude, longitude)
    VALUES (v_id2, 'Verify Flowtrail', 47.2, 11.2);
  SELECT slug INTO v_slug2 FROM public.parks WHERE id = v_id2;
  ASSERT v_slug2 = 'verify-flowtrail-2', format('collision slug: %s', v_slug2);

  -- ── region reservation ──────────────────────────────────────────────────
  UPDATE public.trails SET name = 'Tirol' WHERE id = v_id;
  SELECT slug INTO v_slug FROM public.trails WHERE id = v_id;
  ASSERT v_slug = 'tirol-2', format('region-guarded slug: %s', v_slug);
  -- old slug retired but retained for redirects
  ASSERT EXISTS (SELECT 1 FROM public.spot_slugs
                 WHERE slug = 'verify-flowtrail' AND spot_id = v_id AND NOT is_current);

  -- ── rename produces a history row, one current slug ─────────────────────
  UPDATE public.trails SET name = 'Verify Renamed Line' WHERE id = v_id;
  ASSERT (SELECT count(*) FROM public.spot_slugs
          WHERE spot_id = v_id AND spot_type = 'trail' AND is_current) = 1;
  ASSERT (SELECT count(*) FROM public.spot_slugs
          WHERE spot_id = v_id AND spot_type = 'trail') = 3;

  -- ── rename back reactivates the old slug, still one current ─────────────
  UPDATE public.trails SET name = 'Tirol' WHERE id = v_id;
  SELECT slug INTO v_slug FROM public.trails WHERE id = v_id;
  ASSERT v_slug = 'tirol-2', format('rename-back slug: %s', v_slug);
  ASSERT (SELECT count(*) FROM public.spot_slugs
          WHERE spot_id = v_id AND spot_type = 'trail' AND is_current) = 1;

  -- ── cosmetic name edit keeps the slug ──────────────────────────────────
  UPDATE public.parks SET name = 'Verify Flowtrail ' WHERE id = v_id2;  -- trailing space
  SELECT slug INTO v_slug2 FROM public.parks WHERE id = v_id2;
  ASSERT v_slug2 = 'verify-flowtrail-2', format('cosmetic-edit slug: %s', v_slug2);

  RAISE NOTICE 'trigger: OK';
END $$;

DO $$
BEGIN
  -- ── backfill covered every existing spot ────────────────────────────────
  ASSERT NOT EXISTS (SELECT 1 FROM public.trails     WHERE slug IS NULL);
  ASSERT NOT EXISTS (SELECT 1 FROM public.parks      WHERE slug IS NULL);
  ASSERT NOT EXISTS (SELECT 1 FROM public.dirt_parks WHERE slug IS NULL);
  ASSERT (SELECT count(*) FROM public.spot_slugs WHERE spot_type = 'region') = 38;
  RAISE NOTICE 'backfill: OK';
END $$;

ROLLBACK;
