# Engagement experiment backlog

Ordered by priority. The cycle skill (`.claude/skills/experiment-cycle`) takes the top `ready` item.
Each row needs a hypothesis that can be falsified with the report's metrics.

Default primary metric: **engaged rate** (share of visits with ≥2 meaningful actions, the `engaged` event).
Secondary: avg visit time, `spot_open` per visit, bounce rate. A row with a different primary metric names it
in the "Primary metric" column; an event in `code` there does not exist yet and must be added to
`app/analytics/events.ts` first.

Status: `ready` = buildable as is · `needs events` = only the named events are missing · `needs design` =
UI/flow undecided · `needs backend` = needs a change in `trailradar-backend` (edge function, table or job).

## Traffic budget

About 90 visits a day sitewide (10.11.2026), so a sitewide experiment needs about a week to reach 300 visits
per variant: roughly four experiments a month, one at a time. Two consequences:

- Only a lift of roughly 10 points in engaged rate is detectable, so prefer bold variants over small UI tweaks.
- An experiment on a low-traffic page (`/plans`, the locked radar sheet) blocks the slot for months. Decide
  those by judgment instead (see "Parked").

## Prerequisites for the monetisation and community rows

- **Funnel events** (add during the A/A run so they have a baseline): `radar_open`, `locked_view`,
  `signup_start`, `signup_done`, `plans_view`, `checkout_start`, `gpx_download`, `navigate_click`.
- **Stable variant for logged-in users:** derive it from a hash of the user id (no device storage), otherwise
  a paywall or unlock flips between visits. Anonymous visitors keep the per-page-load draw.
- **Server-side gates:** a variant that widens paid access must be accepted by the edge function, never by the
  client alone (CLAUDE.md "Paid features are gated by an edge function").

## Backlog

| # | Id | Hypothesis | Variant B (control = today) | Surface | Primary metric | Status |
|---|----|-----------|-----------------------------|---------|----------------|--------|
| 1 | `radar-free-today` | The Boden-Radar is the hook, not the product: seeing today's soil state for free brings more visitors into the map and into signup than a locked sample does | Today's soil state on the map is free without an account (spec below) | `/map`, home promo | engaged rate; `radar_open`, `signup_done`, `plans_view` | needs backend |
| 2 | `photos-first-panel` | Photos are the most engaging content but sit below the fold | Photo strip directly below the spot hero | spot detail | engaged rate | ready |
| 3 | `weekend-outlook` | Winter visitors plan their ride; a ranked answer to "where is it dry?" gives them a reason to open several spots | First version: "Heute am trockensten in deiner Nähe" list built from the radar's data (frontend-only once #1 is live). Later: a Saturday ranking, which needs a batch forecast in the backend | `/map`, home | engaged rate; `spot_open` per visit | needs design |
| 4 | `collections` | Curated lists help visitors who do not know what to look for on a map | Static list pages such as "Flowtrails für Einsteiger", "Im Winter fahrbar", "Mit der Bahn erreichbar", linked from home and `/map`. Needs the first three lists curated | new pages, home | engaged rate; `spot_open` per visit | needs design |
| 5 | `ride-checkin` | A fresh rider report makes a spot page feel alive and gives visitors a one-tap way to contribute | One-tap "Heute gefahren: trocken / feucht / matschig" on top of the existing `soil-report` function (logged-in), shown as "letzter Bericht vor 2 Tagen". Backend: a public read of the latest report per spot. Check-ins are too rare to measure, so judge on engaged rate | spot detail | engaged rate; `checkin` per visit | needs backend |
| 6 | `home-is-map` | The landing page delays the product; visitors who start on the map engage more | `/` opens the live map with a thin intro sheet instead of the landing page | `/` | engaged rate; bounce rate | needs design |
| 7 | `map-bottom-cards` | Pin-by-pin hunting is tedious on mobile | Horizontal card strip of visible spots at the bottom of `/map`, synced with the viewport | `/map` | engaged rate | needs design |
| 8 | `sticky-actions` | The highest-intent actions are scattered down the spot page | Bottom bar with Anfahrt, Teilen, Merken, GPX on the spot page | spot detail | `navigate_click` + `share` + `gpx_download` per visit | needs events |
| 9 | `act-first-signup` | Asking for an account before the action loses the contribution | Like or check in anonymously, ask for an account only to keep it | spot detail, spot panel | `like` per visit; `signup_done` per `signup_start` | needs design |
| 10 | `first-photo-prompt` | An explicit ask on empty spots brings in photos | "Sei die erste Person mit einem Foto" on spots without photos, plus contributor credit per region | spot detail | `photo_upload` per visit | needs events |
| 11 | `share-card` | A picture with the soil state gets shared into ride groups more than a bare link | Share produces an image with spot name and soil state | spot detail, spot panel | `share` per visit | needs design |
| 12 | `crew-voice` | Visible trailcrew presence builds trust and donations | Trailcrew news and a "Trailbau unterstützen" block on the spot page | spot detail | `donate_click` per visit | needs backend |
| 13 | `install-after-intent` | An install prompt after shown interest is accepted more often than one on load | PWA banner after the 2nd `spot_open` instead of on page load | all pages | `install_accept` per visit | needs events |
| 14 | `first-visit-hint` | First-time visitors don't know pins open a panel | One-time 3-step coach mark (in-memory per page load, so it shows on every cold load: acceptable for a test) | `/map` | engaged rate | needs design |
| 15 | `map-start-near-me` | Riders who land on trails they could ride today engage more | `/map` opens on the rider's last-viewed region (in-memory/URL only, no storage) or offers a one-tap "Trails in meiner Nähe" instead of the default overview | `/map` | engaged rate | ready (spring) |
| 16 | `pin-status-badges` | Showing open/closed and the Boden-Radar state on pins gives a reason to tap | Status dot on pins at zoom ≥ 10 (`map/markerPresentation.ts`) | `/map` | engaged rate | ready (spring) |

Season: Nov–Feb visitors plan rather than ride. The soil rows (#1, #3, #5) fit the mud season and the
planning rows (#2, #4) fit winter. The "ride now" rows (#15, #16) are marked `ready (spring)` so the cycle
skill skips them until March; set them back to `ready` then.

### Spec: `radar-free-today`

- **Decision (10.11.2026):** today's soil state becomes free for the test. There are no running
  subscriptions yet, so what Supporter keeps can still change; for now it is Trail-Zustand per spot
  (verdict, day strip, 10-day rain) and the offline GPX download.
- **Backend:** a public, today-only soil endpoint in `trailradar-backend` (anon key, no `has_min_tier` check),
  next to the gated `soil-map` function. The client calls it only in variant B. Anyone can call it directly
  during the test, which is acceptable for today's soil level.
- **Client:** in B the radar button opens the live layer instead of the sample/locked sheet for visitors
  without Supporter; `SoilRadarPromo` drops the "Supporter-Funktion" line. Control stays as today.
- **Start:** after 30.11.2026, when the 4-week free Supporter grant ends (`SIGNUP_PROMO` in
  `app/entitlements/features.ts`); before that the promo muddies the signup numbers.
- **Guardrail:** `plans_view` and `signup_done` must not fall clearly in B.

## Parked

Not in the queue. Each line says what would bring it back.

| Id | Idea | Why parked |
|----|------|-----------|
| `plans-framing` | `/plans` leads with "hält Trailradar unabhängig und finanziert Traildaten" instead of the feature comparison | `/plans` gets too few visits to reach 300 per variant in a reasonable time. Decide the framing by judgment, or test it once traffic is several times higher |
| `follow-spot` | "Folgen" on a spot; push or email on status change and on soil turning dry | Its payoff is return visits, which the consent-free setup cannot measure. Build it as a feature, not an experiment |
| `radar-give-to-get` | One soil report or photo unlocks the Boden-Radar for 30 days | Contradicts #1: nothing left to unlock if today's state is free. Fallback if #1 costs too many Supporter conversions |
| `radar-free-with-account` | Boden-Radar free with a free account (registration wall instead of paywall) | Fallback for #1, same condition |
| `radar-home-region-free` | Boden-Radar free for one chosen region, the rest stays Supporter | Fallback for #1, same condition |
| `nearby-carousel-detail` | Swipeable "Trails in der Nähe" cards at the end of `trails/[slug]` | Already live for everyone (`SpotDetailNearby.vue`), so there is no control to test against |

Done experiments move to `LOG.md` with their verdict.
