CREATE TABLE "public"."parking" (
    "id" uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    "spot_id" text NOT NULL,
    "name" text NOT NULL,
    "lat" double precision NOT NULL,
    "lng" double precision NOT NULL,
    "weight_limit_hint" text,
    "opening_hours_hint" text,
    "cost_hint" text,
    "charging_hint" text,
    "created_at" timestamptz DEFAULT now()
);
CREATE INDEX "parking_spot_id" ON "public"."parking" USING btree ("spot_id");

ALTER TABLE "public"."parking" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read parking" ON "public"."parking" FOR SELECT USING (true);
CREATE POLICY "insert own scope" ON "public"."parking" FOR INSERT TO authenticated WITH CHECK (can_edit_spot(spot_id));
CREATE POLICY "edit own scope" ON "public"."parking" FOR UPDATE TO authenticated, service_role USING (can_edit_spot(spot_id));
CREATE POLICY "delete own scope" ON "public"."parking" FOR DELETE TO authenticated, service_role USING (can_edit_spot(spot_id));
