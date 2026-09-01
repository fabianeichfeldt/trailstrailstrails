-- Name-slug URLs for spot detail pages (/trails/<slug>/ instead of /trails/<uuid>/).
--
-- See docs/superpowers/specs/2026-09-01-trail-slug-urls-design.md.
--
-- The primary key (trails.id / parks.id / dirt_parks.id, all `text`) is NOT
-- touched — it is the FK target of ~15 tables plus storage paths. `slug` is a
-- new, separately-maintained public URL token.
--
-- Slug generation lives in Postgres, not app code, because new spots are
-- created through Supabase edge functions that are not in this repo, and
-- SpotManager writes spot rows too. A BEFORE INSERT/UPDATE trigger covers every
-- write path uniformly and keeps the prerender build (which reads straight from
-- the DB) consistent.

-- ── slugify(text) ────────────────────────────────────────────────────────────
-- Self-contained (no unaccent extension) so it is IMMUTABLE and trivially
-- testable. German digraphs are transliterated explicitly (ä→ae, not ä→a) to
-- match the existing region slugs (muenchen, koeln, fraenkische-schweiz);
-- other Latin accents are folded to their base letter via translate().
CREATE OR REPLACE FUNCTION "public"."slugify"("input" text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  s text;
BEGIN
  s := lower(coalesce(input, ''));

  -- German transliteration first.
  s := replace(s, 'ä', 'ae');
  s := replace(s, 'ö', 'oe');
  s := replace(s, 'ü', 'ue');
  s := replace(s, 'ß', 'ss');

  -- Fold remaining Latin-1/Latin Extended-A accents to base letters. The two
  -- argument strings are the same length, character for character.
  s := translate(
    s,
    'àáâãåāăąçćĉċčďđèéêëēĕėęěìíîïĩīĭįıñńņňòóôõøōŏőŕŗřśŝşšţťùúûũūŭůűųýÿŷźżž',
    'aaaaaaaacccccddeeeeeeeeeiiiiiiiiinnnnoooooooorrrssssttuuuuuuuuuyyyzzz'
  );

  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');  -- non-alnum → hyphen
  s := regexp_replace(s, '-{2,}', '-', 'g');       -- collapse runs
  s := trim(both '-' from s);

  -- Cap at 60 chars on a hyphen boundary.
  IF length(s) > 60 THEN
    s := left(s, 60);
    s := regexp_replace(s, '-[^-]*$', '');
    s := trim(both '-' from s);
  END IF;

  IF s = '' THEN
    s := 'spot';
  END IF;

  RETURN s;
END;
$$;

COMMENT ON FUNCTION "public"."slugify"(text) IS
  'Lowercase, German-transliterated, hyphenated, 60-char-capped URL slug. Not unique on its own — see spot_slug_trigger().';

-- ── slug registry ───────────────────────────────────────────────────────────
-- One table spanning all three spot tables plus the region slugs, so
-- uniqueness across the shared /trails/ namespace is a single indexed check,
-- and old slugs (is_current = false) remain reserved for redirect lookups.
CREATE TABLE "public"."spot_slugs" (
  "slug"       text PRIMARY KEY,
  "spot_id"    text NOT NULL,
  "spot_type"  text NOT NULL CHECK ("spot_type" IN ('trail', 'bikepark', 'dirtpark', 'region')),
  "is_current" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "spot_slugs_lookup" ON "public"."spot_slugs" USING btree ("spot_id", "spot_type");
CREATE UNIQUE INDEX "spot_slugs_one_current" ON "public"."spot_slugs" USING btree ("spot_id", "spot_type") WHERE "is_current";

ALTER TABLE "public"."spot_slugs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read spot_slugs" ON "public"."spot_slugs" FOR SELECT USING (true);
-- No write policies: the only writer is spot_slug_trigger() (SECURITY DEFINER).

-- ── slug columns ────────────────────────────────────────────────────────────
-- Nullable for now; NOT NULL is a follow-up migration once the backfill below
-- and the trigger have been through a full deploy cycle (see the spec's
-- rollout section).
ALTER TABLE "public"."trails"     ADD COLUMN "slug" text;
ALTER TABLE "public"."parks"      ADD COLUMN "slug" text;
ALTER TABLE "public"."dirt_parks" ADD COLUMN "slug" text;

-- ── trigger ─────────────────────────────────────────────────────────────────
-- SECURITY DEFINER: an anon INSERT into trails has no write policy on
-- spot_slugs, so the trigger must run with the owner's rights to maintain the
-- registry. TG_ARGV[0] carries the spot_type for the table the trigger is on.
CREATE OR REPLACE FUNCTION "public"."spot_slug_trigger"()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type      text := TG_ARGV[0];
  v_base      text;
  v_candidate text;
  v_i         int := 1;
  v_old_stem  text;
BEGIN
  -- No-op when the name did not actually change.
  IF TG_OP = 'UPDATE' AND NEW.name IS NOT DISTINCT FROM OLD.name THEN
    NEW.slug := OLD.slug;
    RETURN NEW;
  END IF;

  v_base := public.slugify(NEW.name);

  -- Keep the current slug if only cosmetic changes to the name left the stem
  -- identical (e.g. trailing whitespace, punctuation) — avoids pointless
  -- redirect churn.
  IF TG_OP = 'UPDATE' AND OLD.slug IS NOT NULL THEN
    v_old_stem := regexp_replace(OLD.slug, '-[0-9]+$', '');
    IF v_old_stem = v_base THEN
      NEW.slug := OLD.slug;
      RETURN NEW;
    END IF;
  END IF;

  -- Resolve collisions against every reserved slug (current or historical),
  -- except this spot's own rows.
  v_candidate := v_base;
  WHILE EXISTS (
    SELECT 1 FROM public.spot_slugs s
    WHERE s.slug = v_candidate
      AND NOT (s.spot_id = NEW.id AND s.spot_type = v_type)
  ) LOOP
    v_i := v_i + 1;
    v_candidate := v_base || '-' || v_i;
  END LOOP;

  NEW.slug := v_candidate;

  -- Resolved to the same slug it already had (e.g. name changed in a way that
  -- does not affect the slug) — nothing to record.
  IF TG_OP = 'UPDATE' AND v_candidate = OLD.slug THEN
    RETURN NEW;
  END IF;

  -- Retire the previous current slug (it stays in the table as a redirect
  -- source), then record the new one. ON CONFLICT handles renaming a spot
  -- back to a name it used before — its own historical slug is reactivated.
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.spot_slugs
      SET is_current = false
      WHERE spot_id = NEW.id AND spot_type = v_type AND is_current;
  END IF;

  INSERT INTO public.spot_slugs (slug, spot_id, spot_type, is_current)
    VALUES (v_candidate, NEW.id, v_type, true)
  ON CONFLICT (slug) DO UPDATE
    SET is_current = true,
        spot_id    = EXCLUDED.spot_id,
        spot_type  = EXCLUDED.spot_type;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "trails_slug"     BEFORE INSERT OR UPDATE OF "name" ON "public"."trails"
  FOR EACH ROW EXECUTE FUNCTION "public"."spot_slug_trigger"('trail');
CREATE TRIGGER "parks_slug"      BEFORE INSERT OR UPDATE OF "name" ON "public"."parks"
  FOR EACH ROW EXECUTE FUNCTION "public"."spot_slug_trigger"('bikepark');
CREATE TRIGGER "dirt_parks_slug" BEFORE INSERT OR UPDATE OF "name" ON "public"."dirt_parks"
  FOR EACH ROW EXECUTE FUNCTION "public"."spot_slug_trigger"('dirtpark');

-- ── seed region slugs (reserved) ────────────────────────────────────────────
-- Keys of `regions` in build/region.ts. Anything the region page owns under
-- /trails/ must not be claimable by a spot slug.
INSERT INTO "public"."spot_slugs" ("slug", "spot_id", "spot_type", "is_current")
SELECT x, x, 'region', true
FROM unnest(ARRAY[
  'allgaeu','berlin','hamburg','muenchen','koeln','stuttgart','duesseldorf',
  'leipzig','dortmund','fraenkische-schweiz','oberpfalz','schwarzwald',
  'schwaebische-alb','taunus','freiburg','odenwald','rhoen','pfalz',
  'bayerischerwald','nuernberg','schweiz','oesterreich','tschechien','tirol',
  'innsbruck','frankfurt','wiesbaden','karlsruhe','graz','darmstadt','augsburg',
  'wien','essen','mannheim','vorarlberg','saarbruecken','heidelberg','kassel'
]) AS x
ON CONFLICT (slug) DO NOTHING;

-- ── backfill existing spots ─────────────────────────────────────────────────
-- Earliest created_at wins the bare slug; later duplicates get -2, -3, …
-- Ordering by (created_at, id) makes a re-run deterministic. Writing only the
-- `slug` column here does not fire the triggers above (they are UPDATE OF name).
DO $$
DECLARE
  r           record;
  v_base      text;
  v_candidate text;
  v_i         int;
BEGIN
  FOR r IN
    SELECT id, name, created_at, 'trail'::text    AS t FROM public.trails
    UNION ALL
    SELECT id, name, created_at, 'bikepark'::text AS t FROM public.parks
    UNION ALL
    SELECT id, name, created_at, 'dirtpark'::text AS t FROM public.dirt_parks
    ORDER BY created_at, id
  LOOP
    v_base := public.slugify(r.name);
    v_candidate := v_base;
    v_i := 1;
    WHILE EXISTS (SELECT 1 FROM public.spot_slugs WHERE slug = v_candidate) LOOP
      v_i := v_i + 1;
      v_candidate := v_base || '-' || v_i;
    END LOOP;

    INSERT INTO public.spot_slugs (slug, spot_id, spot_type, is_current)
      VALUES (v_candidate, r.id, r.t, true);

    IF r.t = 'trail' THEN
      UPDATE public.trails     SET slug = v_candidate WHERE id = r.id;
    ELSIF r.t = 'bikepark' THEN
      UPDATE public.parks      SET slug = v_candidate WHERE id = r.id;
    ELSE
      UPDATE public.dirt_parks SET slug = v_candidate WHERE id = r.id;
    END IF;
  END LOOP;
END $$;

-- ── per-table unique indexes (defence in depth + planner) ────────────────────
-- Cross-table uniqueness is already guaranteed by spot_slugs.PK + the trigger's
-- collision loop; these just enforce it locally and speed up slug lookups.
CREATE UNIQUE INDEX "trails_slug_key"     ON "public"."trails"     USING btree ("slug");
CREATE UNIQUE INDEX "parks_slug_key"      ON "public"."parks"      USING btree ("slug");
CREATE UNIQUE INDEX "dirt_parks_slug_key" ON "public"."dirt_parks" USING btree ("slug");
