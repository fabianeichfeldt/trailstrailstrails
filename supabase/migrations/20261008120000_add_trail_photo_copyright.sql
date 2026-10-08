-- Photo copyright credit, shown as an overlay on every photo. Optional at
-- upload time; the uploader can add or change it later on their profile.
-- 100 must match COPYRIGHT_MAX_LENGTH in app/utils/photoCopyright.ts.
ALTER TABLE "public"."trail_photos"
  ADD COLUMN IF NOT EXISTS "copyright" text
  CONSTRAINT "trail_photos_copyright_length"
  CHECK ("copyright" IS NULL OR (char_length("copyright") >= 1 AND char_length("copyright") <= 100));

-- trail_photos had no UPDATE policy at all; only the uploader may edit their row.
CREATE POLICY "update own photo" ON "public"."trail_photos"
  FOR UPDATE TO "authenticated"
  USING (auth.uid() = "creator")
  WITH CHECK (auth.uid() = "creator");

-- Column-level: the copyright is the only thing an update may touch, so
-- url/trail_id/creator stay immutable even for the uploader.
REVOKE UPDATE ON TABLE "public"."trail_photos" FROM "anon", "authenticated";
GRANT UPDATE ("copyright") ON TABLE "public"."trail_photos" TO "authenticated";
