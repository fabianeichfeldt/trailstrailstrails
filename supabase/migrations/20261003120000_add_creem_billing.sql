-- Creem billing: provider columns, past_due-as-live, event/cancel logs, checkout
-- eligibility. See docs/superpowers/specs/2026-10-03-creem-billing-design.md section 1.
-- NOT APPLIED automatically; run via `supabase db push` / SQL editor, then
-- regenerate app/types/database.types.ts.


-- =============================================================================
-- 1. subscriptions: provider columns
-- =============================================================================

ALTER TABLE "public"."subscriptions"
    ADD COLUMN "provider_customer_id" text,        -- Creem customer id, needed for the portal link
    ADD COLUMN "customer_email" text,              -- email used at Creem; may differ from the account email
    ADD COLUMN "provider_updated_at" timestamptz;  -- event time of last applied event; guards out-of-order delivery

-- Not partial: the webhook upserts via PostgREST on_conflict, which can't target a
-- partial index. NULL ids (manual grants) never collide in a unique index anyway.
CREATE UNIQUE INDEX "subscriptions_provider_sub_id"
    ON "public"."subscriptions" USING btree ("provider", "provider_subscription_id");


-- =============================================================================
-- 2. past_due counts as live (grace period while Creem retries payment)
-- =============================================================================

DROP INDEX "public"."one_active_subscription_per_user";
CREATE UNIQUE INDEX "one_active_subscription_per_user"
    ON "public"."subscriptions" USING btree ("user_id") WHERE "status" IN ('active', 'trialing', 'past_due');

CREATE OR REPLACE FUNCTION "public"."get_my_entitlement"()
    RETURNS TABLE("plan_id" text, "level" int, "discount_percent" int, "early_adopter_free_until" timestamptz)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH active_sub AS (
    SELECT s.plan_id, p.level, s.discount_percent
    FROM "public"."subscriptions" s
    JOIN "public"."subscription_plans" p ON p.id = s.plan_id
    WHERE s.user_id = auth.uid() AND s.status IN ('active', 'trialing', 'past_due')
  ),
  early_adopter AS (
    SELECT g.free_tier_id AS plan_id, p.level, g.discount_percent, g.free_until
    FROM "public"."early_adopter_grants" g
    JOIN "public"."subscription_plans" p ON p.id = g.free_tier_id
    WHERE g.user_id = auth.uid() AND g.free_until > now()
  )
  SELECT plan_id, level, discount_percent, NULL::timestamptz
  FROM active_sub
  UNION ALL
  SELECT plan_id, level, discount_percent, free_until
  FROM early_adopter
  ORDER BY level DESC
  LIMIT 1;
$$;

ALTER FUNCTION "public"."get_my_entitlement"() OWNER TO "postgres";


-- =============================================================================
-- 3. billing_events + cancel_requests (service role only: RLS on, no policies)
-- =============================================================================

CREATE TABLE "public"."billing_events" (
    "id" text PRIMARY KEY,                     -- Creem event id -> idempotency
    "provider" text NOT NULL,                  -- 'creem' | 'creem_test'
    "type" text NOT NULL,
    "payload" jsonb NOT NULL,
    "received_at" timestamptz DEFAULT now(),
    "processed_at" timestamptz,
    "error" text
);

ALTER TABLE "public"."billing_events" ENABLE ROW LEVEL SECURITY;

-- Record of receipt for every cancellation declaration (logged in or not), and
-- the rate-limit source.
CREATE TABLE "public"."cancel_requests" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "created_at" timestamptz DEFAULT now(),
    "user_id" uuid,                            -- set when the caller had a JWT
    "email" text NOT NULL,                     -- normalised lower-case
    "name" text,
    "subscription_id" uuid REFERENCES "public"."subscriptions"("id"),  -- null when nothing matched
    "ip_hash" text                             -- sha256(ip + daily salt), rate limiting only
);

ALTER TABLE "public"."cancel_requests" ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 4. Checkout eligibility: one rule for server enforcement and client UX
-- =============================================================================

-- Service role only. A grant still running more than 14 days blocks checkout
-- (the user would pay for access they already have).
CREATE OR REPLACE FUNCTION "public"."can_start_checkout"("uid" uuid)
    RETURNS TABLE("eligible" boolean, "reason" text, "eligible_from" timestamptz)
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
  grant_until timestamptz;
BEGIN
  IF EXISTS (
    SELECT 1 FROM "public"."subscriptions" s
    WHERE s."user_id" = "uid" AND s."status" IN ('active', 'trialing', 'past_due')
  ) THEN
    RETURN QUERY SELECT false, 'already_subscribed'::text, NULL::timestamptz;
    RETURN;
  END IF;

  SELECT g."free_until" INTO grant_until
  FROM "public"."early_adopter_grants" g
  WHERE g."user_id" = "uid" AND g."free_until" > now() + interval '14 days';

  IF grant_until IS NOT NULL THEN
    RETURN QUERY SELECT false, 'grant_active'::text, grant_until - interval '14 days';
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text, NULL::timestamptz;
END;
$$;

ALTER FUNCTION "public"."can_start_checkout"(uuid) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."can_start_checkout"(uuid) FROM PUBLIC, "anon", "authenticated";

-- Own uid only, so a client can never probe another user.
CREATE OR REPLACE FUNCTION "public"."get_my_checkout_eligibility"()
    RETURNS TABLE("eligible" boolean, "reason" text, "eligible_from" timestamptz)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT * FROM "public"."can_start_checkout"(auth.uid());
$$;

ALTER FUNCTION "public"."get_my_checkout_eligibility"() OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."get_my_checkout_eligibility"() FROM PUBLIC, "anon";
GRANT EXECUTE ON FUNCTION "public"."get_my_checkout_eligibility"() TO "authenticated";

-- Service role only: the billing edge function and webhook map an email to a user.
CREATE OR REPLACE FUNCTION "public"."user_id_by_email"("p_email" text) RETURNS uuid
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT u."id" FROM "auth"."users" u WHERE lower(u."email") = lower(trim("p_email")) LIMIT 1;
$$;

ALTER FUNCTION "public"."user_id_by_email"(text) OWNER TO "postgres";
REVOKE ALL ON FUNCTION "public"."user_id_by_email"(text) FROM PUBLIC, "anon", "authenticated";


-- =============================================================================
-- 5. Seed data
-- =============================================================================

-- The live plan id is 'supporter' (earlier repo seeds said 'plus'); abort rather than seed nothing.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "public"."subscription_plans" WHERE "id" = 'supporter' AND "level" = 1) THEN
    RAISE EXCEPTION 'subscription_plans needs a row id = ''supporter'' with level = 1 before this migration';
  END IF;
END $$;

-- PLACEHOLDER: set real prices before applying
UPDATE "public"."subscription_plans"
    SET "price_monthly_cents" = 299, "price_yearly_cents" = 2900
    WHERE "id" = 'supporter';

-- PLACEHOLDER: replace with the real Creem TEST-mode product ids before applying.
-- Live ('creem') rows come with go-live as a separate migration.
INSERT INTO "public"."plan_provider_prices" ("plan_id", "provider", "interval", "provider_price_id") VALUES
    ('supporter', 'creem_test', 'monthly', 'prod_5cTHXKYAv5lnranCRrVSHU'),
    ('supporter', 'creem_test', 'yearly',  'prod_TEST_YEARLY_PLACEHOLDER');
