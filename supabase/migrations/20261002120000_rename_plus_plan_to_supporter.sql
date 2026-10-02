-- Renames the level-1 plan's display name from "Plus" to "Supporter".
-- The stable id ('plus') is untouched — it's referenced by plan_provider_prices,
-- subscriptions and early_adopter_grants, and nothing about those foreign keys
-- changes. Display only; see app/entitlements/features.ts's PLAN_NAMES.
UPDATE "public"."subscription_plans" SET "name" = 'Supporter' WHERE "id" = 'plus';
