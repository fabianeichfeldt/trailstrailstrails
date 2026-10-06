# Support page rework — plans instead of PayPal & stickers

**Date:** 2026-10-06
**Status:** design approved, not implemented
**Origin:** idea "rework support page" (local tracker)

## Goal

Now that the Supporter plan exists, `/support` should ask for support through the plan, not through PayPal or stickers — and say clearly that Trailradar is a side project by someone with a full-time job who rides and builds trails.

## Decisions

| Question | Decision |
|---|---|
| Relation to `/plans` | `/support` shows the **full plan cards** (with checkout), shared with `/plans` via one component |
| Section order | Story → Plans → free ways to help |
| Cost transparency | Qualitative "Wofür dein Beitrag ist" list, no numbers |
| What gets shared | Only the plan cards. The "Gut zu wissen" facts stay on `/plans`; `/support` links there |

## 1. Component split

**New `app/components/plans/PlanCards.vue`**, extracted from `app/pages/plans.vue` with no behaviour change. It owns:

- the monthly/yearly interval toggle (hidden in native)
- the Free and Supporter cards incl. feature lists (`FREE_FEATURES`, `SUPPORTER_FEATURES`)
- every Supporter CTA state: logged out (+ signup promo), subscribed, crew role, `grant_active`, `canBuy` (order notice, admin test mode, checkout button, inline errors), not possible / loading
- `onCheckout()` → `startCheckout()` → redirect to Creem
- the price fetch: `useAsyncData('supporter-prices', getSupporterPrices)` plus `refresh()` and `isSignupPromoActive()` on mount
- the native note ("Supporter kannst du auf trailradar.org abschließen.")
- all styles for the above (toggle, `.plans`, `.plan*`, `.native-note`)

**`app/pages/plans.vue`** keeps: `PageHero`, back link, `<PlanCards />`, the "Gut zu wissen" facts section (still `v-else` of native, i.e. hidden in native), SEO meta. It reads `useIsNativeApp()` itself for the facts.

## 2. New `/support` page (`app/pages/support.vue`)

Top to bottom:

1. **Hero**
   - H1: „Trailradar ist ein Feierabendprojekt."
   - Sub: „Gebaut von einem, der Vollzeit arbeitet, Mountainbike fährt und Trails baut – und mit deiner Unterstützung am Laufen bleibt."
2. **Back link** `← Zurück zur Karte` (static `NuxtLink to="/map"`, as on every content page).
3. **Story** — split layout with `trailbau.webp` (stacks on mobile):
   > Hinter Trailradar steckt kein Konzern und kein Startup mit Investoren – sondern ich, Fabian, Mountainbiker. Tagsüber habe ich einen ganz normalen Vollzeitjob. Abends und am Wochenende fahre ich Mountainbike, schaufle bei den Bärenleite Trails in Bayreuth mit – und baue an Trailradar.
   >
   > Trailradar ist werbefrei und unabhängig, und das soll so bleiben. Karte, Spots und Trails bleiben kostenlos. Wer mehr will – oder einfach möchte, dass das Projekt weiterläuft – hat mit dem Supporter-Plan eine Möglichkeit, mich zu unterstützen.
4. **„Wofür dein Beitrag ist"** — icon list:
   - Server und Datenbank, auf denen Karte, Fotos und GPX-Touren laufen
   - Wetter- und Bodendaten für den Trail-Zustand
   - Gebühren für die App Stores und die Domain
   - Viele Abende nach Feierabend – statt auf dem Trail
5. **`<PlanCards />`**, followed by one line (web only, hidden in native like the facts on `/plans`): „Kündigung, Geld-zurück & Bezahlung – alle Details unter [Preise & Pläne](/plans)."
6. **„Auch ohne Geld kannst du viel bewegen"**
   - **Trails eintragen** – fehlende Strecken ergänzen oder Infos aktualisieren.
   - **Fehler melden** – falscher Name, neue Streckenführung, geänderter Zustand? Sag Bescheid.
   - **Teilen** – in deiner WhatsApp-Gruppe, im Verein, auf Instagram oder im Forum.
7. **Footer CTA** — unchanged („Gemeinsam für legale Trails … Happy Trails.").

**Removed:** sticker section, PayPal box, `.paypal-button` / `.support-box` styles, `public/assets/sticker.webp` (only used here).

**SEO:** description no longer mentions „kleine Spende"; it names the Supporter plan, e.g. „Trailradar ist ein Feierabendprojekt. Unterstütze es mit dem Supporter-Plan – oder mit neuen Trails, Feedback und Teilen."

**Native app:** `PlanCards` already hides prices and buttons there (store rules), so `/support` is compliant without extra logic.

**Unchanged:** entry points — home hero „❤️ Support Trailradar", home quick-nav card „Unterstützen", footer „Unterstützen".

## 3. Tests (vitest, mocked at the `fetch` boundary)

- **`app/pages/plans.test.ts` stays untouched and must stay green.** It mounts the real page, so it now exercises `PlanCards` through `plans.vue` — proof the extraction kept behaviour. (Stubs: `PlanCards` must *not* be stubbed.)
- **New `app/pages/support.test.ts`**, same global stubs as `plans.test.ts`:
  - shows the side-project story (Vollzeitjob, Feierabendprojekt) and the four cost items
  - contains no „PayPal" / „paypal.me" / „Sticker"
  - renders both plan cards with the live monthly price from the mocked `subscription_plans` response
  - logged-in eligible user: clicking „Supporter werden" posts to `/functions/v1/billing` with the JWT and redirects to the returned Creem URL
  - native: no prices, no buttons, no `/plans` details line
  - „Auch ohne Geld" block and back link to `/map` present
- Manual: check `/support` at 375 px width (story split stacks, cards stack, toggle tappable).
- `npm test` green before reporting done. No E2E needed (no map/auth/add-spot flow touched).
