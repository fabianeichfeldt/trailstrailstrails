# Embed guide page — design spec

Date: 2026-07-09

## Goal

Give trail/spot operators and webmasters a dedicated, discoverable page that explains
the existing embed feature (they can already request a token via the admin SpotManager)
and gives them accurate, copy-pasteable code to embed a Trailradar map on their own site.
Currently this feature is undocumented outside the admin UI's "copy snippet" button.

## Scope

New content page + one homepage nav card + a small reusable code-block component +
a one-line bug fix in the existing `embed.js` snippet loader (see "Bug fix" below).
No changes to the embed token system, the `/embed/[token]` iframe page, or the
`server/routes/_embed/[token].get.ts` API — those are already built and correct.

## 1. New page: `src/pages/how-to-embed.vue` → route `/how-to-embed`

Route deliberately avoids `/embed`, which would collide with the existing
`src/pages/embed/[token].vue` folder route (Nuxt would treat a new `embed.vue` as
the parent layout for `/embed/:token`, requiring a `<NuxtPage />` — an unwanted
side effect for what should be a plain content page).

Styled identically to `src/pages/business.vue` / `src/pages/faq.vue`: `<PageHero>`,
`<main class="container">` (global styling from `layouts/default.vue`), `.back-link`
to `/map`, closing `<footer class="cta">`. No `definePageMeta` needed (default layout).

### Sections, top to bottom

1. **`<PageHero>`** — headline + subline aimed at operators/webmasters, e.g.:
   - H1: "Zeig deine Trails auf deiner eigenen Website"
   - Sub: explains the map embeds live, always up to date, zero maintenance for them.

2. **Value prop** (`.section`) — 2–3 sentences: why embed (visibility on their own
   site + always-current trail/GPX/status data pulled from Trailradar, nothing to
   maintain on their end).

3. **Visual example — "Nördliches Baden-Württemberg"** — a static, CSS-only mockup
   card (no real screenshot, no real token, no live iframe — confirmed with user).
   Styled like the homepage's `.map-teaser` fake-browser-chrome pattern
   (`src/pages/index.vue:20-46`: fake chrome-dots bar + address bar + colored marker
   dots on a muted background) so it reads as "this is what an embed looks like"
   without needing real data. Centered conceptually near Karlsruhe
   (49.0069, 8.4037) with a few fictional trail-name labels, captioned:
   "Beispiel: eingebettete Karte für ein Trailgebiet in Nordbaden".

4. **Code example** (`.section`) — real `TrailRadar.mount()` snippet, rendered via
   the new `<CodeSnippet>` component (see below):

   ```html
   <div id="trailradar-embed" style="height:500px"></div>
   <script src="https://trailradar.org/embed.js"></script>
   <script>
     TrailRadar.mount({
       token: 'DEIN-TOKEN',
       center: [49.0069, 8.4037],  // Karlsruhe – z.B. dein Trailgebiet
       zoom: 11,
       height: '500px',
     });
   </script>
   ```

   Works without an explicit `baseUrl` override once the embed.js bug fix (below)
   ships, since the corrected default is already `trailradar.org`.

5. **Customization options table** — one row per real `TrailRadar.mount()` option,
   matching `src/public/embed.js` exactly (no invented options):

   | Option | Beschreibung | Standard |
   |---|---|---|
   | `token` | Dein Embed-Token (erforderlich) | – |
   | `target` | CSS-Selector des Ziel-Elements | `#trailradar-embed` |
   | `center` | `[lat, lng]` des Kartenausschnitts | – |
   | `zoom` | Zoomstufe der Karte | – |
   | `height` | Höhe des eingebetteten Bereichs | `500px` |
   | `baseUrl` | Nur für Self-Hosting / lokale Entwicklung | `https://trailradar.org` |

6. **FAQ** (`.faq-item` pattern from `faq.vue`), 4 items:
   - Was kostet das? (kostenlos für Trailbetreiber)
   - Wie bekomme ich einen Token? (admin-only, → Kontakt-CTA below)
   - Kann ich mehrere Trailgebiete in einem Embed zeigen? (yes — a token can be
     scoped to multiple spots via the trail picker in the admin token editor)
   - Ist die eingebettete Karte responsive? (yes — `width: 100%`, fixed `height`)

7. **`<footer class="cta">`** — same pattern as `business.vue`: heading, 1-2 sentences,
   `mailto:webmaster@trailradar.org` button asking to request a token.

### SEO

`useSeoMeta` (title, description, `ogUrl: 'https://trailradar.org/how-to-embed'`,
`ogSiteName: 'Trailradar.org'`, `ogLocale: 'de_DE'`) + `useHead` canonical link,
matching the pattern in every other content page.

## 2. Homepage nav card — `src/pages/index.vue`

Add one `<NuxtLink>` inside `.quicknav-grid` (after the existing 7, grid still
divides evenly), reusing `IconCode` (already imported and used at line 76 for the
static "Integrierbare Karte" feature card — that static card is left as-is, this
is an additional, separate, clickable card):

```html
<NuxtLink to="/how-to-embed" class="qn-card">
  <div class="qn-icon">
    <IconCode />
  </div>
  <span class="qn-label">Karte einbetten</span>
  <span class="qn-sub">Für Website-Betreiber</span>
</NuxtLink>
```

No new CSS needed — `.qn-card` etc. are already defined in `index.vue`.

## 3. New component: `src/components/CodeSnippet.vue`

Nothing like this exists in the codebase today (confirmed — no `<pre>`/`<code>`
block or code-display component anywhere). Small, single-purpose:

- **Props:** `code: string`
- **Renders:** a dark `<pre><code>` block (background `var(--color-page-bg-light)`
  `#16181a`, matching the CTA-band dark tone already used on these pages) with a
  "Kopieren" button in the corner (accent `var(--color-page-accent)` `#58c27d`).
- **Copy interaction:** `navigator.clipboard.writeText(props.code)`, then flips
  button label to "✓ Kopiert" for 2s — same interaction shape as the existing
  `copySnippet()` + toast in `src/components/spotmanager/EmbedTokenList.vue`, but
  inline on the button itself rather than a floating toast (simpler, page-appropriate).
- Kept generic (just takes a `code` string) so it's reusable if another page ever
  needs a snippet block, without building anything beyond what this page needs.

## 4. Bug fix: `src/public/embed.js` default `baseUrl`

Confirmed with user: fix the default rather than work around it in the docs.

Current (line 35): `var base = (opts.baseUrl || 'https://trailradar.app').replace(...)`
→ every other canonical URL in the app (`business.vue`, `faq.vue`, `og:url` tags,
and the admin `EmbedTokenList.vue` snippet generator, which already hardcodes
`trailradar.org` in its `<script src>`) uses `trailradar.org`. The `.app` default
is an inconsistency, not an intentional alias — left as-is, any operator who omits
`baseUrl` (the common case, and what the admin UI's own generated snippet does)
gets an iframe pointing at the wrong domain.

**Fix:** change the default in `embed.js` from `https://trailradar.app` to
`https://trailradar.org`, and update the file's header comment (lines 1, 5, 13)
to match, so the comment stays accurate documentation for anyone reading the
source directly.

## Testing

- Unit test for `CodeSnippet.vue`: renders the passed code, copy button calls
  `navigator.clipboard.writeText` with the exact prop value, shows "Kopiert" state
  after click (mock `navigator.clipboard`).
- Architecture tests: none of this touches the dependency-layer boundaries
  (`communication/`, `stores/`, `map/`) — pure presentational page + component —
  so no changes expected in `src/architecture.test.ts`.
- Manual check: page renders correctly on mobile viewport (touch target size on
  the copy button, table doesn't overflow — wrap in a scroll container if needed),
  per the project's mobile-first-class rule.

## Out of scope

- No self-service token request flow (still admin-only, per existing design).
- No live/functional iframe demo on the page (static mockup only, per user decision).
- No changes to the embed token data model, RLS, or the `/embed/[token]` page itself.
