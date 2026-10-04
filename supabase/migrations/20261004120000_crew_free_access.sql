-- Trailcrew and admins get paid-tier access for as long as they hold the role —
-- no end date, unlike the signup grant in early_adopter_grants.
-- Plan granted: the ACTIVE plan with the HIGHEST level (crew get every paid feature),
-- picked in SQL, no hardcoded plan id. Revoking the role revokes the access.
-- get_my_entitlement() gains a crew_role column ('trailcrew' | 'admin' | NULL) so
-- the UI can say *why* it is free; has_min_tier() reads it, so the edge-function
-- gate follows automatically.
-- NOT APPLIED automatically; run via `supabase db push` / SQL editor, then
-- regenerate app/types/database.types.ts.

-- Return type changes, so CREATE OR REPLACE is not enough. has_min_tier() calls it by
-- name at run time (no stored dependency), so the drop does not cascade.
DROP FUNCTION "public"."get_my_entitlement"();

CREATE FUNCTION "public"."get_my_entitlement"()
    RETURNS TABLE("plan_id" text, "level" int, "discount_percent" int, "early_adopter_free_until" timestamptz, "crew_role" text)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  WITH active_sub AS (
    SELECT s.plan_id, p.level, s.discount_percent
    FROM "public"."subscriptions" s
    JOIN "public"."subscription_plans" p ON p.id = s.plan_id
    WHERE s.user_id = auth.uid() AND s.status IN ('active', 'trialing', 'past_due')
  ),
  crew AS (
    SELECT p.id AS plan_id, p.level, r.role::text AS crew_role
    FROM "public"."user_roles" r
    CROSS JOIN LATERAL (
      SELECT sp.id, sp.level FROM "public"."subscription_plans" sp
      WHERE sp.active IS NOT FALSE AND sp.level >= 1
      ORDER BY sp.level DESC
      LIMIT 1
    ) p
    WHERE r.user_id = auth.uid() AND r.role IN ('trailcrew', 'admin')
  ),
  early_adopter AS (
    SELECT g.free_tier_id AS plan_id, p.level, g.discount_percent, g.free_until
    FROM "public"."early_adopter_grants" g
    JOIN "public"."subscription_plans" p ON p.id = g.free_tier_id
    WHERE g.user_id = auth.uid() AND g.free_until > now()
  )
  -- Tie-break: a real subscription (manageable in the UI), then crew (no end date), then the dated grant.
  SELECT plan_id, level, discount_percent, early_adopter_free_until, crew_role FROM (
    SELECT plan_id, level, discount_percent, NULL::timestamptz AS early_adopter_free_until, NULL::text AS crew_role, 0 AS rank
    FROM active_sub
    UNION ALL
    SELECT plan_id, level, 0, NULL::timestamptz, crew_role, 1
    FROM crew
    UNION ALL
    SELECT plan_id, level, discount_percent, free_until, NULL::text, 2
    FROM early_adopter
  ) sources
  ORDER BY level DESC, rank ASC
  LIMIT 1;
$$;

ALTER FUNCTION "public"."get_my_entitlement"() OWNER TO "postgres";
