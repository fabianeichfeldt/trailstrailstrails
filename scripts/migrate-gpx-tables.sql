-- migrate-gpx-tables.sql
-- Run this once in the Supabase SQL editor before using push-gpx.js.
--
-- Tables:
--   spot_gpx_trails  — one row per individual trail GPX track
--   spot_gpx_tours   — one row per tour GPX track
--
-- spot_id references the trail.id from the existing single_trails table
-- (each "spot" in the app is a SingleTrail record in the DB).
--
-- gpx_points is stored as JSONB: [[lat, lng, alt_m], ...]
-- Coordinates are already thinned by preprocess-gpx.js (RDP ε=4m).

-- ── spot_gpx_trails ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spot_gpx_trails (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id          TEXT        NOT NULL,
  filename         TEXT,                     -- original GPX filename, for reference
  name             TEXT        NOT NULL,
  difficulty       TEXT        NOT NULL,     -- imba color: green|blue|red|black|double-black
  direction        TEXT        NOT NULL,     -- cw|ccw|one-way-down|one-way-up|both
  distance_km      REAL,
  elevation_gain   INTEGER,
  elevation_loss   INTEGER,
  duration_minutes INTEGER,                  -- null when GPX has no timestamps
  gpx_points       JSONB       NOT NULL,     -- [[lat, lng, alt], ...]
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  -- Upsert key: one trail record per (spot, filename)
  UNIQUE (spot_id, filename)
);

CREATE INDEX IF NOT EXISTS spot_gpx_trails_spot_id ON spot_gpx_trails (spot_id);

-- ── spot_gpx_tours ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spot_gpx_tours (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  spot_id          TEXT        NOT NULL,
  filename         TEXT,
  name             TEXT        NOT NULL,
  direction        TEXT        NOT NULL,     -- cw|ccw
  trail_names      JSONB,                    -- ordered list of trail names ridden, e.g. ["Flowtrail Süd","Tech Rock"]
  distance_km      REAL,
  elevation_gain   INTEGER,
  elevation_loss   INTEGER,
  duration_minutes INTEGER,
  gpx_points       JSONB       NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (spot_id, filename)
);

CREATE INDEX IF NOT EXISTS spot_gpx_tours_spot_id ON spot_gpx_tours (spot_id);

-- ── GPX file URL column (added for download support) ─────────────────────────

ALTER TABLE spot_gpx_trails ADD COLUMN IF NOT EXISTS gpx_url TEXT;
ALTER TABLE spot_gpx_tours  ADD COLUMN IF NOT EXISTS gpx_url TEXT;

-- ── Row-Level Security ────────────────────────────────────────────────────────
-- Anyone can read; only the service_role key (used by scripts) can write.

ALTER TABLE spot_gpx_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE spot_gpx_tours  ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "public read trails"
  ON spot_gpx_trails FOR SELECT
  USING (true);

CREATE POLICY "public read tours"
  ON spot_gpx_tours FOR SELECT
  USING (true);

-- Service role bypasses RLS automatically — no write policy needed.

-- ── Sanity check query ────────────────────────────────────────────────────────
-- Run after pushing data to verify:
--
-- SELECT spot_id, count(*) AS trails,
--        sum(jsonb_array_length(gpx_points)) AS total_pts
-- FROM spot_gpx_trails
-- GROUP BY spot_id;
--
-- SELECT spot_id, name, distance_km, elevation_gain, duration_minutes,
--        jsonb_array_length(gpx_points) AS pts
-- FROM spot_gpx_tours;
