-- Spot comments: freeform, flat (no threading) community discussion per spot.
-- "spot_id" is a plain text column with no FK (mirrors "parking".spot_id) so
-- comments work across trail/bikepark/dirtpark spots, not just trails.

CREATE TABLE "public"."spot_comments" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "spot_id" text NOT NULL,
    "user_id" uuid NOT NULL,
    "comment_text" text NOT NULL CHECK (char_length("comment_text") <= 500 AND char_length("comment_text") > 0)
);

CREATE INDEX "spot_comments_spot_id" ON "public"."spot_comments" USING btree ("spot_id");
CREATE INDEX "spot_comments_user_id" ON "public"."spot_comments" USING btree ("user_id");

-- Two FKs on the same column (auth.users + profiles), same pattern as
-- trail_photos.creator, so PostgREST can join to profiles for display_name/avatar_url.
ALTER TABLE ONLY "public"."spot_comments"
    ADD CONSTRAINT "spot_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id");
ALTER TABLE ONLY "public"."spot_comments"
    ADD CONSTRAINT "spot_comments_user_id_fkey1" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");

ALTER TABLE "public"."spot_comments" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read comments" ON "public"."spot_comments" FOR SELECT USING (true);
CREATE POLICY "insert own comment" ON "public"."spot_comments" FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
-- Author can delete their own comment; admin/assigned-trailcrew can delete any
-- comment on a spot they can edit (reuses can_edit_spot, no new authz logic).
CREATE POLICY "delete own or moderated comment" ON "public"."spot_comments" FOR DELETE TO authenticated, service_role USING (auth.uid() = user_id OR can_edit_spot(spot_id));

-- Rate limit: one comment per user per spot per 60 seconds, to deter flooding.
CREATE OR REPLACE FUNCTION "public"."enforce_spot_comment_rate_limit"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "public"."spot_comments"
    WHERE user_id = NEW.user_id
      AND spot_id = NEW.spot_id
      AND created_at > now() - interval '60 seconds'
  ) THEN
    RAISE EXCEPTION 'Bitte warte kurz, bevor du erneut kommentierst.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "spot_comments_rate_limit" BEFORE INSERT ON "public"."spot_comments"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_spot_comment_rate_limit"();
