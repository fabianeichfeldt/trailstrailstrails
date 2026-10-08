-- The "insert" policy on trail_photos was WITH CHECK (true): any logged-in user
-- could insert a row with any creator/url/trail_id/copyright via REST, e.g.
-- reuse another rider's photo URL under their own copyright, or attribute a
-- photo to someone else. Now a row is only accepted for the caller's own,
-- already-uploaded object in the trail-photos bucket, under the matching trail.

-- SECURITY DEFINER: storage.objects is RLS-protected and has no client SELECT
-- policy, so the lookup can't run with the caller's rights. Safe to expose: it
-- only ever answers "does the *caller* own this object".
CREATE OR REPLACE FUNCTION "public"."owns_trail_photo_object"("p_trail_id" text, "p_url" text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET "search_path" TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    -- Pinned hosts: a suffix-only match would let the url point at any server.
    FROM unnest(ARRAY[
      'https://ixafegmxkadbzhxmepsd.supabase.co/storage/v1/object/public/trail-photos/',
      'http://127.0.0.1:54321/storage/v1/object/public/trail-photos/',
      'http://localhost:54321/storage/v1/object/public/trail-photos/'
    ]) AS base(prefix)
    JOIN storage.objects o
      ON o.bucket_id = 'trail-photos'
     AND o.name = substr(p_url, length(base.prefix) + 1)
    WHERE starts_with(p_url, base.prefix)
      AND (o.owner_id = (auth.uid())::text OR o.owner = auth.uid())
      AND (storage.foldername(o.name))[1] = p_trail_id
  )
$$;

ALTER FUNCTION "public"."owns_trail_photo_object"(text, text) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."owns_trail_photo_object"(text, text) FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."owns_trail_photo_object"(text, text) TO "authenticated";

DROP POLICY IF EXISTS "insert" ON "public"."trail_photos";
CREATE POLICY "insert own uploaded photo" ON "public"."trail_photos"
  FOR INSERT TO "authenticated"
  WITH CHECK (
    auth.uid() = "creator"
    AND "public"."owns_trail_photo_object"("trail_id", "url")
  );

-- One row per file, so an uploaded file can't be attached a second time.
-- Checked against production on 2026-10-08: no duplicate urls.
ALTER TABLE ONLY "public"."trail_photos"
  ADD CONSTRAINT "trail_photos_url_key" UNIQUE ("url");
