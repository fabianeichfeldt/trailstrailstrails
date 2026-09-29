-- Paid subscriptions: data model + entitlement framework.
-- Reference SQL for docs/superpowers/specs/2026-09-23-subscription-entitlements-design.md.
-- NOT a migration: copy into a timestamped file under supabase/migrations/ when
-- this feature actually ships, and regenerate app/types/database.types.ts after.


-- =============================================================================
-- 1. Tables (dependency order)
-- =============================================================================

-- Ordered, numeric tiers. level 0 = free (not a paid plan, but useful as a floor).
CREATE TABLE "public"."subscription_plans" (
    "id" text PRIMARY KEY,                     -- 'free', 'plus', 'pro'
    "name" text NOT NULL,
    "level" int NOT NULL UNIQUE,               -- ordering for entitlement checks
    "price_monthly_cents" int,
    "price_yearly_cents" int,
    "currency" text DEFAULT 'EUR',
    -- Retire a plan without deleting it; subscriptions/grants still reference it.
    "active" boolean DEFAULT true
);

-- Maps a plan to a payment provider's price/product id. Intentionally empty
-- until a processor is chosen — the only table a future integration populates.
CREATE TABLE "public"."plan_provider_prices" (
    "plan_id" text NOT NULL,
    "provider" text NOT NULL,                  -- 'stripe' | 'apple' | 'google' | 'revenuecat'
    "interval" text NOT NULL,                  -- 'monthly' | 'yearly'
    "provider_price_id" text NOT NULL,
    PRIMARY KEY ("plan_id", "provider", "interval")
);

ALTER TABLE ONLY "public"."plan_provider_prices"
    ADD CONSTRAINT "plan_provider_prices_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");

-- Append-only subscription history (old rows stay as 'canceled'/'expired').
CREATE TABLE "public"."subscriptions" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" uuid NOT NULL,
    "plan_id" text NOT NULL,
    "provider" text NOT NULL,                  -- 'stripe' | 'apple' | 'google' | 'manual'
    "provider_subscription_id" text,           -- null for 'manual' grants
    "status" text NOT NULL,                    -- 'active' | 'trialing' | 'past_due' | 'canceled' | 'expired'
    "discount_percent" int DEFAULT 0,          -- carried over from early_adopter_grants at signup time
    "current_period_end" timestamptz,
    "cancel_at_period_end" boolean DEFAULT false,
    "created_at" timestamptz DEFAULT now(),
    "updated_at" timestamptz DEFAULT now()
);

ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id");

-- History is append-only, so "at most one live subscription per user" can't be
-- a plain UNIQUE — only rows in a live status are constrained.
CREATE UNIQUE INDEX "one_active_subscription_per_user"
    ON "public"."subscriptions" USING btree ("user_id") WHERE "status" IN ('active', 'trialing');

-- One-time grant, backfilled for every user that exists at feature launch
-- (section 4). No trigger: signups after launch never get a row.
CREATE TABLE "public"."early_adopter_grants" (
    "user_id" uuid PRIMARY KEY,
    "granted_at" timestamptz DEFAULT now(),
    "free_tier_id" text NOT NULL,              -- top tier at launch
    "free_until" timestamptz NOT NULL,
    "discount_percent" int NOT NULL DEFAULT 20
);

ALTER TABLE ONLY "public"."early_adopter_grants"
    ADD CONSTRAINT "early_adopter_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."early_adopter_grants"
    ADD CONSTRAINT "early_adopter_grants_free_tier_id_fkey" FOREIGN KEY ("free_tier_id") REFERENCES "public"."subscription_plans"("id");


-- =============================================================================
-- 2. Row level security
-- =============================================================================
-- service_role bypasses RLS entirely, so the "service_role may write" half of
-- the design needs no policy — only the admin half does. The client (anon /
-- authenticated) never writes subscriptions or grants, same posture as user_roles.

-- subscription_plans: public pricing, admin-write-only.
ALTER TABLE "public"."subscription_plans" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read plans" ON "public"."subscription_plans" FOR SELECT USING (true);
CREATE POLICY "admins manage plans" ON "public"."subscription_plans" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

-- plan_provider_prices: public, admin-write-only.
ALTER TABLE "public"."plan_provider_prices" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read plan prices" ON "public"."plan_provider_prices" FOR SELECT USING (true);
CREATE POLICY "admins manage plan prices" ON "public"."plan_provider_prices" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

-- subscriptions: owner + admin read; admin (or service_role, via bypass) write.
ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own subscriptions" ON "public"."subscriptions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "admins manage subscriptions" ON "public"."subscriptions" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());

-- early_adopter_grants: owner + admin read; admin (or service_role, via bypass) write.
ALTER TABLE "public"."early_adopter_grants" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own early adopter grant" ON "public"."early_adopter_grants" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));
CREATE POLICY "admins manage early adopter grants" ON "public"."early_adopter_grants" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());


-- =============================================================================
-- 3. Entitlement functions (SECURITY DEFINER, mirroring get_my_role / can_edit_spot)
-- =============================================================================

-- Returns at most one row: the higher-level of (active/trialing paid
-- subscription, unexpired early-adopter grant). Empty result = free / level 0.
-- Pinned search_path + fully-qualified names because SECURITY DEFINER runs
-- with the owner's privileges.
CREATE OR REPLACE FUNCTION "public"."get_my_entitlement"()
    RETURNS TABLE("plan_id" text, "level" int, "discount_percent" int, "early_adopter_free_until" timestamptz)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH active_sub AS (
    SELECT s.plan_id, p.level, s.discount_percent
    FROM "public"."subscriptions" s
    JOIN "public"."subscription_plans" p ON p.id = s.plan_id
    WHERE s.user_id = auth.uid() AND s.status IN ('active', 'trialing')
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

-- The one helper any gated RLS policy calls, e.g. USING (public.has_min_tier(1)).
-- Same role for paid features that can_edit_spot() plays for trailcrew writes.
CREATE OR REPLACE FUNCTION "public"."has_min_tier"("required_level" int) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  SELECT COALESCE((SELECT level FROM "public"."get_my_entitlement"()), 0) >= required_level;
$$;

ALTER FUNCTION "public"."has_min_tier"("required_level" int) OWNER TO "postgres";


-- =============================================================================
-- 4. One-time early-adopter backfill
-- =============================================================================
-- Run once, in the same migration that ships this feature. Requires the
-- 'pro' row to exist in subscription_plans first (plans are seeded directly
-- in Supabase, not here).
--
-- SEED DEFAULTS — tune before this is ever turned into a real migration and
-- applied: 'pro' (top tier at launch), 6 months free, 20% discount.
-- These are values, not architectural decisions.

INSERT INTO "public"."early_adopter_grants" ("user_id", "free_tier_id", "free_until", "discount_percent")
SELECT "id", 'pro', now() + interval '6 months', 20
FROM "auth"."users";
