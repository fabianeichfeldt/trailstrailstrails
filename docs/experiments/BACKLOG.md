# Engagement experiment backlog

Ordered by priority. The cycle skill (`.claude/skills/experiment-cycle`) takes the top `ready` item.
Each row needs a hypothesis that can be falsified with the report's metrics.

Default primary metric: **engaged rate** (share of visits with ≥2 meaningful actions, the `engaged` event).
Secondary: avg visit time, `spot_open` per visit, bounce rate. A row with a different primary metric names it
in the "Primary metric" column; an event in `code` there does not exist yet and must be added to
`app/analytics/events.ts` first.

Status: `ready` = buildable as is · `needs events` = only the named events are missing · `needs design` =
UI/flow undecided · `needs backend` = needs a change in `trailradar-backend` (edge function, table or job).

At 300 visits per variant only a lift of roughly 10 points in engaged rate is detectable, so prefer bold
variants over small UI tweaks.

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
| 1 | `radar-free-today` | The Boden-Radar is the hook, not the product: seeing today's soil state for free brings more visitors into the map and into signup than a locked sample does | Today's soil state on the map is free without an account; Supporter keeps forecast, day strip, 10-day rain and alerts | `/map`, home promo | engaged rate; `radar_open`, `signup_done`, `plans_view` | needs backend |
| 2 | `weekend-outlook` | Winter visitors plan the weekend; a ranked answer to "where is it dry on Saturday?" gives them a reason to open several spots | Page or map sheet ranking the driest spots within 60 km for the coming weekend, linked from home and `/map` | new page, `/map` | engaged rate; `spot_open` per visit | needs design |
| 3 | `ride-checkin` | A fresh rider report makes a spot page feel alive and gives visitors a one-tap way to contribute | One-tap "Heute gefahren: trocken / feucht / matschig" on the spot page, shown as "letzter Bericht vor 2 Tagen" | spot detail | `checkin` per visit; engaged rate | needs backend |
| 4 | `plans-framing` | Patronage framing converts better than a feature list for a small community product | `/plans` leads with "hält Trailradar unabhängig und finanziert Traildaten" instead of the feature comparison | `/plans` | `checkout_start` per `plans_view` | needs events |
| 5 | `follow-spot` | Riders come back when their home spot reopens or dries out | "Folgen" on a spot; push or email on status change and on soil turning dry | spot detail, spot panel | `follow` per visit (return visits only measurable logged-in) | needs backend |
| 6 | `collections` | Curated lists help visitors who do not know what to look for on a map | Lists such as "Flowtrails für Einsteiger", "Im Winter fahrbar", "Mit der Bahn erreichbar", linked from home and `/map` | new pages, home | engaged rate; `spot_open` per visit | needs design |
| 7 | `radar-give-to-get` | Riders will trade a contribution for access, and the reports improve the soil model | One soil report or photo unlocks the Boden-Radar for 30 days (uses `SoilFeedbackSheet`) | locked radar sheet | contributions per `locked_view` | needs backend |
| 8 | `map-start-near-me` | Riders who land on trails they could ride today engage more | `/map` opens on the rider's last-viewed region (in-memory/URL only, no storage) or offers a one-tap "Trails in meiner Nähe" instead of the default overview | `/map` | engaged rate | ready |
| 9 | `nearby-carousel-detail` | Visitors arriving on a trail page via search or a shared link leave because the page is a dead end | Swipeable "Trails in der Nähe" cards at the end of `trails/[slug]` (data: `utils/near_by_trails.ts`) | spot detail | engaged rate | ready |
| 10 | `pin-status-badges` | Showing open/closed and the Boden-Radar state on pins gives a reason to tap | Status dot on pins at zoom ≥ 10 (`map/markerPresentation.ts`) | `/map` | engaged rate | ready |
| 11 | `photos-first-panel` | Photos are the most engaging content but sit below the fold | Photo strip directly below the spot hero | spot detail | engaged rate | ready |
| 12 | `map-bottom-cards` | Pin-by-pin hunting is tedious on mobile | Horizontal card strip of visible spots at the bottom of `/map`, synced with the viewport | `/map` | engaged rate | needs design |
| 13 | `first-visit-hint` | First-time visitors don't know pins open a panel | One-time 3-step coach mark (in-memory per page load, so it shows on every cold load: acceptable for a test) | `/map` | engaged rate | needs design |
| 14 | `home-is-map` | The landing page delays the product; visitors who start on the map engage more | `/` opens the live map with a thin intro sheet instead of the landing page | `/` | engaged rate; bounce rate | needs design |
| 15 | `sticky-actions` | The highest-intent actions are scattered down the spot page | Bottom bar with Anfahrt, Teilen, Merken, GPX on the spot page | spot detail | `navigate_click` + `share` + `gpx_download` per visit | needs events |
| 16 | `act-first-signup` | Asking for an account before the action loses the contribution | Like or check in anonymously, ask for an account only to keep it | spot detail, spot panel | `signup_done` per `signup_start`; `like` per visit | needs design |
| 17 | `first-photo-prompt` | An explicit ask on empty spots brings in photos | "Sei die erste Person mit einem Foto" on spots without photos, plus contributor credit per region | spot detail | `photo_upload` per visit | needs events |
| 18 | `crew-voice` | Visible trailcrew presence builds trust and donations | Trailcrew news and a "Trailbau unterstützen" block on the spot page | spot detail | `donate_click` per visit | needs backend |
| 19 | `share-card` | A picture with the soil state gets shared into ride groups more than a bare link | Share produces an image with spot name and soil state | spot detail, spot panel | `share` per visit | needs design |
| 20 | `install-after-intent` | An install prompt after shown interest is accepted more often than one on load | PWA banner after the 2nd `spot_open` instead of on page load | all pages | `install_accept` per visit | needs events |
| 21 | `radar-free-with-account` | The radar is worth an email address | Boden-Radar free with a free account (registration wall instead of paywall). Alternative to #1: run only if #1 costs too many Supporter conversions | `/map` | `signup_done` per `locked_view` | needs backend |
| 22 | `radar-home-region-free` | One free region shows the value and leaves a reason to pay | Boden-Radar free for one chosen region, the rest stays Supporter. Alternative to #1 | `/map` | `plans_view` per `radar_open` | needs backend |

Season: Nov–Feb visitors plan rather than ride. The soil rows (#1, #2, #3, #7) fit the mud season and the
planning rows (#6, #9, #11) fit winter; leave the "ride now" rows (#8, #10) for March onwards, or recheck
their winter verdict in spring.

`radar-free-today` and the signup promo: the 4-week free Supporter grant ends on 30.11.2026
(`SIGNUP_PROMO` in `app/entitlements/features.ts`). Start #1 after that date, or the promo muddies its
signup numbers.

Done experiments move to `LOG.md` with their verdict.
