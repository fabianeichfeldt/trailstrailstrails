-- Replace the four separate hint columns on "parking" with a single
-- free-text array column. The UI now offers suggested chip labels
-- (opening hours, weight/height limit, costs, charging) but the storage
-- itself is just text[] — no per-category columns to keep in sync.

ALTER TABLE "public"."parking" ADD COLUMN "info" text[] NOT NULL DEFAULT '{}';

UPDATE "public"."parking"
SET "info" = ARRAY_REMOVE(ARRAY[
  NULLIF("weight_limit_hint", ''),
  NULLIF("opening_hours_hint", ''),
  NULLIF("cost_hint", ''),
  NULLIF("charging_hint", '')
], NULL);

ALTER TABLE "public"."parking"
  DROP COLUMN "weight_limit_hint",
  DROP COLUMN "opening_hours_hint",
  DROP COLUMN "cost_hint",
  DROP COLUMN "charging_hint";
