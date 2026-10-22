-- External-source identity for spot_gpx_trails, so recurring imports of official
-- trail datasets can upsert instead of duplicating. Example: source 'bw_2m',
-- source_id = the dataset's GUID. Hand-made tracks leave both NULL.
--
-- No RLS changes needed. Existing policies on public.spot_gpx_trails
-- (public read, insert/edit via can_edit_spot, admin-only delete) cover the
-- new nullable columns automatically.
ALTER TABLE public.spot_gpx_trails
  ADD COLUMN source    text,
  ADD COLUMN source_id text;

ALTER TABLE public.spot_gpx_trails
  ADD CONSTRAINT spot_gpx_trails_source_pair
  CHECK ((source IS NULL) = (source_id IS NULL));

CREATE UNIQUE INDEX spot_gpx_trails_source_uniq
  ON public.spot_gpx_trails (source, source_id)
  WHERE source IS NOT NULL;
