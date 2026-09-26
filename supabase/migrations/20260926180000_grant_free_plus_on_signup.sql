-- =============================================================================
-- Promotion: every signup gets free paid-tier access for a limited time.
-- =============================================================================
-- TUNABLES (both live in public.grant_free_access(), in its DECLARE block):
--   free_period       = interval '6 months'
--       A ROLLING, PER-USER window measured from the moment the grant is made
--       (signup, or this migration for the backfill). It is NOT a fixed campaign
--       end date: a user who signs up in month N is covered until N + 6 months.
--       To end the promotion for everyone, drop the trigger (below).
--   free_discount_pct = 0
--       Deliberately 0. A discount is a commercial promise nobody has decided on.
--       Existing launch-backfill rows keep their own 20 (column default).
--
-- Which plan is granted is decided here in SQL, not hardcoded: the ACTIVE plan
-- with the LOWEST level that is >= 1 (the lowest level that unlocks a paid
-- feature; see FEATURES in app/entitlements/features.ts). If no plan qualifies
-- the grant is skipped. Reads as an entitlement via get_my_entitlement().
--
-- Signup must never fail because of this: the trigger swallows any error.
-- NOT APPLIED automatically by anything but `supabase db push` / SQL editor.

CREATE OR REPLACE FUNCTION "public"."grant_free_access"("p_user_id" uuid) RETURNS void
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  free_period       interval := interval '6 months';
  free_discount_pct int      := 0;
  plan_id_to_grant  text;
BEGIN
  SELECT p."id" INTO plan_id_to_grant
  FROM "public"."subscription_plans" p
  WHERE p."active" IS NOT FALSE AND p."level" >= 1
  ORDER BY p."level" ASC
  LIMIT 1;

  -- No qualifying plan: nothing to grant, and that is not an error.
  IF plan_id_to_grant IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO "public"."early_adopter_grants" ("user_id", "free_tier_id", "free_until", "discount_percent")
  VALUES (p_user_id, plan_id_to_grant, now() + free_period, free_discount_pct)
  ON CONFLICT ("user_id") DO NOTHING;
END;
$$;

ALTER FUNCTION "public"."grant_free_access"(uuid) OWNER TO "postgres";
-- Internal helper: only the trigger function and this migration call it.
REVOKE ALL ON FUNCTION "public"."grant_free_access"(uuid) FROM PUBLIC, "anon", "authenticated";


CREATE OR REPLACE FUNCTION "public"."grant_free_access_on_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
BEGIN
  PERFORM "public"."grant_free_access"(NEW."id");
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a signup over a promotion.
  RAISE WARNING 'grant_free_access_on_signup failed for user %: %', NEW."id", SQLERRM;
  RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."grant_free_access_on_signup"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."grant_free_access_on_signup"() FROM PUBLIC, "anon", "authenticated";

CREATE TRIGGER "grant_free_access_on_signup" AFTER INSERT ON "auth"."users"
    FOR EACH ROW EXECUTE FUNCTION "public"."grant_free_access_on_signup"();


-- One-time backfill: users who signed up after the entitlements launch backfill
-- and so have no grant row. Same values as a fresh signup (window starts now).
DO $$
BEGIN
  PERFORM "public"."grant_free_access"(u."id")
  FROM "auth"."users" u
  WHERE NOT EXISTS (
    SELECT 1 FROM "public"."early_adopter_grants" g WHERE g."user_id" = u."id"
  );
END;
$$;
