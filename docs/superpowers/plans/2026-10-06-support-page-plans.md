# Support page rework — implementation plan

**Spec:** `docs/superpowers/specs/2026-10-06-support-page-plans-design.md`
**Branch / worktree:** `worktree-support-page-plans` (`.claude/worktrees/support-page-plans`)

Tasks A and B touch disjoint files and run in parallel. Task C integrates and verifies.

## Shared contract (A and B both rely on this)

- File: `app/components/plans/PlanCards.vue`
- Usage: `<PlanCards />` — **no props, no emits**. It reads `useAuthStore`, `useMapStore`, `useSubscriptionStore`, `useIsNativeApp` itself (auto-imported globals, stubbed via `vi.stubGlobal` in tests).
- Pages import it explicitly (vitest has no Nuxt auto-import): `import PlanCards from '~/components/plans/PlanCards.vue'` — same pattern as `SupportEmail` in `plans.vue`.
- Test hooks kept verbatim: `data-testid="plan-free"`, `"plan-supporter"`, `"price"`, `"supporter-cta"`, `"interval-monthly"`, `"interval-yearly"`, `"withdrawal-notice"`, `"test-mode"`.
- Price fetch inside the component: `useAsyncData('supporter-prices', () => getSupporterPrices())`, `refresh()` + `promoActive = isSignupPromoActive()` in `onMounted`.

## Task A — extract `PlanCards.vue` (owner: subagent A)

Files: `app/components/plans/PlanCards.vue` (new), `app/pages/plans.vue` (shrink). **Do not edit `app/pages/plans.test.ts`.**

1. [ ] Create `PlanCards.vue`. Move from `plans.vue`, unchanged:
   - template: the `.interval-toggle` div, the `.plans` grid with both cards, and `<p v-if="isNative" class="native-note">`. Wrap in a single root `<div class="plan-cards">`.
   - script: imports `startCheckout`, `getSupporterPrices`, `SIGNUP_PROMO`, `isSignupPromoActive`; `FREE_FEATURES`, `SUPPORTER_FEATURES`; stores; `prices`/`refresh`/`promoActive`/`onMounted`; `interval`, `testMode`, `busy`, `error`, `canBuy`, `fmt`, `onCheckout`, `money`, `priceMain`, `perMonthOfYearly`, `savingPercent` (keep their one-line comments).
   - styles: everything from `.interval-toggle` through `.native-note`, plus the `@media (min-width: 720px)` rules for `.plans`/`.plan` and the reduced-motion block. Keep the "Card-scoped selectors outrank the layout's `.page-layout .container p/h2` colours" comment; check `.container .native-note` still matches (the component renders inside `main.container`) — keep the selector as is.
2. [ ] `plans.vue` keeps: `PageHero`, back link, `<PlanCards />`, the facts section (`<section v-if="!isNative" class="facts">` — was `v-else` of the native note, now its own `v-if`), SEO meta, `SupportEmail` import, `isNative = useIsNativeApp()`, facts styles + facts media rule.
3. [ ] `npx vitest run app/pages/plans.test.ts` — all green with **zero** test changes. That is the proof the extraction is behaviour-neutral.
4. [ ] No commit — A and B share one git index; the main session commits in Task C.

## Task B — new `/support` page (owner: subagent B)

Files: `app/pages/support.vue` (rewrite), `app/pages/support.test.ts` (new), `public/assets/sticker.webp` (delete). Do not touch `plans.vue` or `components/plans/`.

1. [ ] Write `support.test.ts` first, copying the global-stub / fetch-mock setup of `app/pages/plans.test.ts` (stores, `useIsNativeApp`, `useAsyncData` stand-in, fetch mock for `/rest/v1/subscription_plans` and `/functions/v1/billing`, `NuxtLink`/`PageHero` stubs). **Do not stub `PlanCards`.** Tests:
   - story: text contains „Feierabendprojekt", „Vollzeitjob", „Bärenleite"
   - cost list: four items (Server und Datenbank / Wetter- und Bodendaten / App Stores und die Domain / Abende nach Feierabend)
   - no „PayPal", „paypal.me", „Sticker" anywhere in `w.html()`
   - plan cards: `plan-free` and `plan-supporter` exist; `price` contains `3,00` (non-breaking space before `€`) from the mocked `price_monthly_cents: 300`
   - checkout: logged in + eligible → click `supporter-cta` → one billing call with `Authorization: Bearer jwt-1`, `window.location.href` set to the returned Creem URL (copy the approach from the plans checkout test)
   - details line: link to `/plans` with „alle Details" text on web; absent when native
   - native: no `price`, no `supporter-cta`
   - „Auch ohne Geld" heading with the three items; back link `href="/map"`
2. [ ] Rewrite `support.vue` per spec §2 (copy is final — use it verbatim from the spec):
   - `PageHero` (H1 + sub), back link, `.split` story section with `<img :src="'/assets/trailbau.webp'" alt="Trailbau in der Community">`
   - „Wofür dein Beitrag ist" `<ul>` with Font Awesome icons (`fa-server`, `fa-cloud-sun-rain`, `fa-mobile-screen`, `fa-moon`, `aria-hidden="true"`)
   - `<PlanCards />` then `<p v-if="!isNative" class="plans-details">Kündigung, Geld-zurück &amp; Bezahlung – alle Details unter <NuxtLink to="/plans">Preise &amp; Pläne</NuxtLink>.</p>`
   - „Auch ohne Geld kannst du viel bewegen" list (icons `fa-map-location-dot`, `fa-flag`, `fa-share-nodes`); „Trails eintragen" links to `/map`, „Sag Bescheid" to `/kontakt`
   - unchanged footer CTA
   - SEO description: „Trailradar ist ein Feierabendprojekt. Unterstütze es mit dem Supporter-Plan – oder mit neuen Trails, Feedback und Teilen." Keep canonical/og.
   - Styles: drop `.support-box` / `.paypal-button`; keep `.split` (stacks < 900px); icon lists in the facts-grid look of `plans.vue` (icon tile `#eef0ef`, 2.25rem). Touch targets ≥ 44px for links in lists.
3. [ ] `rm public/assets/sticker.webp` (only referenced by the old support page — `grep -rn sticker app` must be empty afterwards).
4. [ ] `support.test.ts` can only fully pass once Task A's `PlanCards.vue` exists. If it doesn't yet, finish the code and report which tests are pending on A — don't create a placeholder `PlanCards.vue`.
5. [ ] No commit — the main session commits in Task C.

## Task C — integrate & verify (owner: main session)

1. [ ] `npx vitest run app/pages/support.test.ts app/pages/plans.test.ts` green.
2. [ ] `npm test` (full suite incl. `architecture.test.ts`) green; `npm run lint:arch` green.
3. [ ] Visual check `/support` and `/plans` at 375 px and desktop on a worktree dev server on port 3100 (never reuse the primary checkout's :3000).
4. [ ] Revert `public/sitemap.xml` if `nuxt prepare`/`dev` touched it.
5. [ ] Commit A (`refactor: share the plan cards between pages`) and B (`feat: support page asks for the Supporter plan instead of PayPal`) separately; tick the boxes here.
