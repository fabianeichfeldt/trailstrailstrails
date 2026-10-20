# TrailRadar — Domain Glossary

## Terminology (German copy)

- "maintainer" → **Betreiber** (not "Pfleger") in all German-language UI copy, FAQ entries, and marketing text.

## Core concepts

**Spot**
A physical location managed in SpotManager (e.g. a trail area, bikepark, dirtpark). Represented by a row in `trails`, `parks`, or `dirt_parks`.

**Trail** (also: *trail segment*)
A single rideable section of a spot with its own difficulty, direction, and GPX track. Stored as a row in `spot_gpx_trails`. A trail is the smallest bookable unit of a spot's track network.

**Tour**
A complete loop or route at a spot that may pass through multiple trails. Stored as a row in `spot_gpx_tours`. A tour references the trails it contains via `trail_names`.

**Source track**
A full-resolution GPX recording uploaded by a trailcrew member as the raw input to the GPX Segment Editor. It covers the entire area to be split — approach, trails, connector roads, and all. A source track may optionally be saved as a Tour after segmentation.

**Segment** (also: *pending segment*)
A contiguous sub-sequence of a source track's points, defined interactively by the user in the GPX Segment Editor via the elevation scrubber. A confirmed segment becomes a Trail after processing (smooth elevation → RDP thinning → stat computation).

## Features

**GPX Segment Editor**
A two-step SpotManager workflow for splitting a source track into trail segments without external tooling.
- Step 1: upload a single source GPX file.
- Step 2: define segments using the elevation scrubber; optionally save the source track as a Tour.

**Elevation scrubber**
The interactive elevation profile shown in a bottom panel during step 2 of the GPX Segment Editor. Two draggable handles on the x-axis select the start and end of the current segment. The corresponding polyline slice updates live on the map.
