-- Photo deletion: owner, admin, or trailcrew assigned to the spot.
-- Mirrors the spot_comments delete policy (20260811120000_add_spot_comments.sql),
-- reusing can_edit_spot() — no new authorization logic.

CREATE POLICY "delete own or moderated photo" ON "public"."trail_photos"
  FOR DELETE TO authenticated
  USING (auth.uid() = creator OR can_edit_spot(trail_id));

-- The trail-photos storage bucket has no delete policy at all today (only
-- insert). owner_id is set automatically by Supabase Storage to the
-- uploader's auth.uid() at upload time. storage.foldername(name))[1] is the
-- trailId segment of the "{trailId}/{uuid}.webp" object path set by
-- uploadTrailPhoto() in app/communication/photos.ts. lower(...) mirrors the
-- existing gpx-files delete policy's defensive casing guard.
CREATE POLICY "delete own or moderated trail photo" ON "storage"."objects"
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'trail-photos'
    AND (
      owner_id = (auth.uid())::text
      OR can_edit_spot(lower((storage.foldername(name))[1]))
    )
  );
