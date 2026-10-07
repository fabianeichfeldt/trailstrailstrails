-- Self-service account deletion (delete-account edge function in trailradar-backend).
-- Photos and comments outlive their author, anonymized: NO ACTION FKs here would
-- otherwise make auth.admin.deleteUser fail for anyone who ever posted one.

-- trail_photos.creator: both FKs (auth.users and profiles) NO ACTION -> SET NULL
ALTER TABLE ONLY "public"."trail_photos"
    DROP CONSTRAINT IF EXISTS "trail_photos_creator_fkey";
ALTER TABLE ONLY "public"."trail_photos"
    ADD CONSTRAINT "trail_photos_creator_fkey" FOREIGN KEY ("creator") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."trail_photos"
    DROP CONSTRAINT IF EXISTS "trail_photos_creator_fkey1";
ALTER TABLE ONLY "public"."trail_photos"
    ADD CONSTRAINT "trail_photos_creator_fkey1" FOREIGN KEY ("creator") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;

-- spot_comments.user_id: nullable, both FKs (auth.users and profiles, which cascades from auth.users) -> SET NULL
ALTER TABLE "public"."spot_comments" ALTER COLUMN "user_id" DROP NOT NULL;

ALTER TABLE ONLY "public"."spot_comments"
    DROP CONSTRAINT IF EXISTS "spot_comments_user_id_fkey";
ALTER TABLE ONLY "public"."spot_comments"
    ADD CONSTRAINT "spot_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;

ALTER TABLE ONLY "public"."spot_comments"
    DROP CONSTRAINT IF EXISTS "spot_comments_user_id_fkey1";
ALTER TABLE ONLY "public"."spot_comments"
    ADD CONSTRAINT "spot_comments_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
