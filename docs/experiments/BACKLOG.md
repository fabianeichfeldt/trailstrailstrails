# Engagement experiment backlog

Ordered by expected impact ÷ effort. The cycle skill (`.claude/skills/experiment-cycle`) takes the top
`ready` item. Each row needs a hypothesis that can be falsified with the report's metrics.

Primary metric: **engaged rate** (share of visits with ≥2 meaningful actions, the `engaged` event).
Secondary: avg visit time, `spot_open` per visit, bounce rate.

| # | Id | Hypothesis | Variant B (control = today) | Surface | Status |
|---|----|-----------|-----------------------------|---------|--------|
| 1 | `map-start-near-me` | Riders who land on trails they could ride today engage more | `/map` opens on the rider's last-viewed region (in-memory/URL only, no storage) or offers a one-tap "Trails in meiner Nähe" instead of the default overview | `/map` | ready |
| 2 | `nearby-carousel-detail` | Visitors arriving on a trail page via search or a shared link leave because the page is a dead end | Swipeable "Trails in der Nähe" cards at the end of `trails/[slug]` (data: `utils/near_by_trails.ts`) | spot detail | ready |
| 3 | `pin-status-badges` | Showing open/closed and the Boden-Radar state on pins gives a reason to tap | Status dot on pins at zoom ≥ 10 (`map/markerPresentation.ts`) | `/map` | ready |
| 4 | `photos-first-panel` | Photos are the most engaging content but sit below the fold | Photo strip directly below the spot hero | spot detail | ready |
| 5 | `map-bottom-cards` | Pin-by-pin hunting is tedious on mobile | Horizontal card strip of visible spots at the bottom of `/map`, synced with the viewport | `/map` | needs design |
| 6 | `first-visit-hint` | First-time visitors don't know pins open a panel | One-time 3-step coach mark (in-memory per page load, so it shows on every cold load: acceptable for a test) | `/map` | needs design |

Done experiments move to `LOG.md` with their verdict.
