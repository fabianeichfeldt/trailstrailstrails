-- Temporary table for the Android beta waitlist (see
-- docs/superpowers/specs/2026-08-19-android-beta-waitlist-design.md).
-- Drop this table (and src/pages/android-beta.vue,
-- src/communication/betaSignup.ts) once the Android app has a public
-- beta/release channel and the waitlist link is retired.

CREATE TABLE "public"."beta_signups" (
    "id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "name" text NOT NULL,
    "email" text NOT NULL UNIQUE
);

ALTER TABLE "public"."beta_signups" ENABLE ROW LEVEL SECURITY;

-- Anyone can sign up; nobody can read the list back through the API — it's
-- only ever read via the Supabase dashboard (service role bypasses RLS) for
-- the manual export into a Resend audience.
CREATE POLICY "anon can sign up" ON "public"."beta_signups" FOR INSERT TO anon, authenticated WITH CHECK (true);
