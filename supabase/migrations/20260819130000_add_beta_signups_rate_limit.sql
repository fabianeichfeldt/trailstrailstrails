-- Global rate limit on beta_signups (see the Android beta waitlist spec).
-- The table is anon-insertable with no per-user identity to key off, so the
-- only lever against a bot flooding it is a global cap: reject inserts once
-- too many rows have landed within the last minute, regardless of who's
-- submitting.

CREATE INDEX "beta_signups_created_at" ON "public"."beta_signups" USING btree ("created_at");

CREATE OR REPLACE FUNCTION "public"."enforce_beta_signup_rate_limit"() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM "public"."beta_signups"
    WHERE created_at > now() - interval '60 seconds'
  ) >= 5 THEN
    RAISE EXCEPTION 'Gerade sehr viele Anmeldungen – bitte versuch es in ein paar Minuten erneut.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "beta_signups_rate_limit" BEFORE INSERT ON "public"."beta_signups"
  FOR EACH ROW EXECUTE FUNCTION "public"."enforce_beta_signup_rate_limit"();
