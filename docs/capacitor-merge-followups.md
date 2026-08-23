# Capacitor native-app branch — pre-merge review

*(Play Store rollout plan appended 2026-08-21 — see "Android → Google Play rollout"
near the bottom.)*

Branch: `feat/capacitor-native-app` → `main`
Comparison: `git diff main...HEAD` (merge-base `d4e8554`), 14 commits
Tooling: `npm test` 518/518 pass at review time, 534/534 after the test additions below ·
`npm run lint:arch` clean

**Update:** items #2, #5, and #6 below are done — `app/utils/nativeBack.test.ts`,
`app/stores/auth.test.ts` (covering `handleNativeAuthCallback`), and
`app/utils/externalLink.ts` + `.test.ts` (extracted from `capacitor.client.ts`) were
added. `npm test`: 544/544.

**Manual iOS verification (2026-08-21):** native app tested on a real iPhone 8 Plus
(iOS 16.7) and in Xcode on iOS 17 — both fine. Note: the iPhone 8 Plus has no
notch/Dynamic Island, so it doesn't exercise the `env(safe-area-inset-top)` codepath at
all (reports `0` there regardless of item #1 below); the Xcode 17 run only counts as
covering item #1 if the simulated device model has a notch/Dynamic Island — worth
double-checking which device profile was used before treating #1 as closed. Also
untouched: the **public website in mobile Safari** (not the native app) on a notched
iPhone, which is what item #1 is actually about — the regression risk is for regular web
visitors, not native-app users.

Two-axis review (Standards vs. CLAUDE.md, and Correctness/Risk since no PRD exists for
this branch — it's an iterative on-device spike). Full agent reports below the punch list.

## Fix before merging to main

1. **`viewport-fit=cover` was added globally in `nuxt.config.ts`, not gated to native.**
   This is what makes `env(safe-area-inset-*)` start reporting non-zero values on iOS
   Safari/PWA for *regular web visitors*, not just the native shell — and only `/map`'s
   components (`Drawer.vue`, `SearchBar.vue`, `UserAvatar.vue`, `map.vue`) plus
   `AuthModal.vue` got compensating safe-area padding as part of this branch.
   `AppHeader.vue` (sticky, used on every non-map page) and other fixed/sticky UI —
   `PwaBanner.vue`, `AddSpotModal.vue`, `ReportErrorModal.vue`, `NearbyModal.vue`,
   `spotmanager.vue`, `EmbedTokenList.vue` — got none.
   **Risk:** an iPhone visitor (notch/Dynamic Island) hitting the public site in Safari,
   or as an installed PWA, can see the sticky header render under/behind the status bar
   on the homepage, profile, spotmanager, etc.
   **Fix:** either scope `viewport-fit=cover` to native only, or add the same
   `calc(Npx + env(safe-area-inset-top))` treatment to `AppHeader.vue` and the other
   fixed/sticky components before merging. Worth a real iPhone/Safari check either way.

2. ~~**`app/utils/nativeBack.ts` has no unit test**~~ — **done.** Added
   `app/utils/nativeBack.test.ts`, covering registration order (LIFO), unregister
   (including double-unregister), and short-circuit-on-`true`.

## Follow-up MRs (should-fix-soon, not blocking)

3. **Android hardware back button isn't wired for most modals.** Only `/map`-scoped
   handlers are registered (`useTrailMap.ts` — spot panel, status sheet, add-mode).
   `AuthModal.vue`, `AddSpotModal.vue`, `ReportErrorModal.vue`, `NearbyModal.vue`,
   `EmbedTokenList.vue` have none — pressing back on Android while one is open falls
   through to `window.history.back()` (or the double-tap-exit toast at root) instead of
   closing the modal.

4. **Possible double-padding on Android phones with a display cutout.**
   `MainActivity.java` pads the WebView using `systemBars() | displayCutout()`
   combined — but the CSS `calc(Npx + env(safe-area-inset-top))` rules added in this
   branch (`Drawer.vue`, `SearchBar.vue`, `UserAvatar.vue`, `map.vue`) would then add the
   *same* cutout inset a second time via Chromium's own `env()` reporting, on a
   notched/punch-hole Android device specifically (not on a plain status-bar phone,
   where `env()` is 0). Needs a real device with a cutout to confirm/fix — likely an
   Android-only override to zero `env(safe-area-inset-top)` since native padding already
   covers it.

5. ~~**`stores/auth.ts`'s `handleNativeAuthCallback`** has no test coverage.~~ — **done.**
   Added `app/stores/auth.test.ts`, mocking `useSupabaseClient`/`useSupabaseUser` and
   `@capacitor/browser`; covers the `?code=` exchange path, the hash-fragment
   access/refresh-token path, code-over-hash precedence, the neither-present no-op case,
   a partial-hash-tokens case, the returned `type`, and the `exchangeCodeForSession`
   error path.

6. ~~`app/plugins/capacitor.client.ts`'s external-link origin-comparison logic was
   untested~~ — **done.** Extracted the pure decision logic into
   `app/utils/externalLink.ts` (`resolveExternalLinkUrl`), leaving `capacitor.client.ts`
   to just call it and act on the result; added `app/utils/externalLink.test.ts`
   covering cross-origin http(s), protocol-relative links, same-origin (absolute and
   relative), hash-only anchors, null/empty href, `mailto:`/`tel:`, and unparseable URLs.

7. `overscroll-behavior: none` was added globally to `html, body` in `base.css`,
   unguarded by `Capacitor.isNativePlatform()` — kills pull-to-refresh/rubber-band bounce
   for regular mobile Chrome/Safari web visitors too, not just the native shell. Minor,
   but confirm it's an intentional change for the public site, not just the app shell.

8. `capacitor.config.ts`'s `StatusBar.overlaysWebView`/`backgroundColor` are documented
   as no-ops on Android 15+ (target SDK 35), correctly superseded by the
   `MainActivity.java` native fix — but it's now a two-mechanism setup (pre-15 vs. 15+)
   that could silently drift on a future SDK bump. No action now, just a flag for
   whoever touches status-bar code next.

## Manual re-verification checklist (Android + iOS, before/after merge)

Native code structurally can't have vitest coverage — these need a real device pass:

- Google OAuth sign-in and password-reset deep-link round trip, on a fresh install *and*
  a backgrounded app, on both Android and iOS.
- Hardware back button from every modal listed in #3, plus double-tap-to-exit from
  `/map` and from root.
- Status bar / inset appearance specifically on an Android device **with a display
  cutout** (not just a plain punch-hole-free phone) — see #4.
- iOS Safari (regular tab, not installed) *and* "Add to Home Screen" PWA layout on a
  notched iPhone, given the global `viewport-fit=cover` change in #1.

## Clean / no action needed

- `getLatestPhotos` removal from `app/communication/trails.ts` — confirmed zero
  remaining references anywhere in `app/` or tests.
- Dependency-layer boundaries, `srcDir` path conventions, and the never-commit-to-main
  rule — all clean across the 14 commits (`npm run lint:arch` passes, no direct commits
  to `main`).

---

## Full sub-agent reports

### Standards axis (vs. CLAUDE.md)

`npm test` 518/518 pass, `npm run lint:arch` clean — neither a blocker.

1. **Hard violation** — `app/utils/nativeBack.ts` missing unit test (see #2 above).
2. **Judgement call** — `stores/auth.ts` native-auth-callback branches untested (no
   pre-existing auth-store test convention to break, but new behavior).
3. **Judgement call** — `capacitor.client.ts` external-link-redirect / double-tap-exit
   logic untested (no `app/plugins/` test convention exists yet either).
4. **Acknowledged gap** — `android/`, `ios/`, `capacitor.config.ts`, `MainActivity.java`
   structurally can't have vitest coverage.
5. No violations found for `srcDir` path traps, dependency-layer boundaries, or the
   git-commit-to-main rule.

**Verdict:** does not cleanly pass — the untested `nativeBack.ts` is a hard violation of
an explicit CLAUDE.md mandate and should block merge until a test is added. Everything
else is a judgement call or an acknowledged native-code gap.

### Correctness & Risk axis (no PRD exists for this branch)

**(a) Regressions to the existing web/PWA app** — see #1 and #7 above; `getLatestPhotos`
removal confirmed clean.

**(b) Native-app correctness bugs** — see #3, #4, #8 above.

**(c) Untested risk / manual re-verify** — see #5, #6, and the manual checklist above.

**Verdict:** not a blocker-free merge — fix #1 (public-web-facing regression risk)
before merging; #3/#4 are should-fix-soon but acceptable as a fast follow-up if the team
signs off. `npm test` is green and the diff is otherwise well-commented and consistent
with CLAUDE.md's architecture rules.

---

## Android → Google Play rollout: next steps & release lifecycle

Google's Play Console policies shift periodically — the below is accurate to the best
of current knowledge, but double-check the live requirements in Play Console when you
actually start, especially the closed-testing threshold.

### Concrete gaps found in this repo (fix before the first upload)

1. **No release signing config.** `android/app/build.gradle`'s `release` buildType has
   no `signingConfig` — `./gradlew bundleRelease` today won't produce a properly signed,
   upload-ready `.aab`. Needs: generate an upload keystore (`keytool -genkey -v
   -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 9125 -alias
   upload`), wire it into a `signingConfigs { release { ... } }` block reading from
   `gradle.properties`/environment variables (never hardcode the passwords in the
   committed file), and reference it from `buildTypes.release`. Keep the keystore itself
   *out* of git — `android/.gitignore` already has `*.jks`/`*.keystore` lines, just
   commented out; uncomment once a real keystore exists.
2. **Opt into Play App Signing** when creating the app in Play Console (default for new
   apps) — Google then holds the actual app-signing key and re-signs what you upload
   with your upload key. If the upload key is ever lost, Play App Signing makes recovery
   possible; without it, losing the signing key permanently blocks future updates to the
   same app listing.
3. **Confirm `/privacy` (`app/pages/privacy.vue`) satisfies Play's Data Safety
   disclosure**, not just GDPR-oriented web copy — it needs to explicitly cover what's
   collected/shared: email (Supabase auth), precise location (`ACCESS_FINE_LOCATION` +
   `ACCESS_COARSE_LOCATION` in `AndroidManifest.xml`, used for the geolocation FAB),
   uploaded trail photos, and the third-party processor (Supabase) itself. The Data
   Safety form in Play Console has to match this exactly or the listing gets rejected/
   flagged.
4. **User-generated content (photos, comments) likely needs an in-app
   report/block flow** under Play's UGC policy — check whether the existing
   `ReportErrorModal.vue` (bug/error reporting) also covers reporting *other users'*
   content, or whether a dedicated "report this photo/comment" action is needed before
   submission. This is a common first-submission rejection reason for apps with UGC.
5. Standard store-listing assets not yet prepared, as far as this repo shows: app icon
   (already have `ic_launcher_foreground`/native icons — reusable), a feature graphic
   (1024×500), phone screenshots, short + full description, category, content-rating
   questionnaire (IARC, done in Play Console), target-audience declaration, ads
   declaration (none, presumably — confirms no ad SDK is bundled).
6. `versionCode 1` / `versionName "1.0"` in `android/app/build.gradle` — fine for the
   first upload; every subsequent upload (including test tracks) must strictly increase
   `versionCode`. `versionName` is just the human-readable string and can repeat/be
   anything.

### One-time account setup

- Register a Play Console developer account (one-off $25 fee) — identity verification
  can take anywhere from under a day to a couple of days; do this early since it can
  block everything else.
- Individual vs. organization account changes some requirements (e.g. D-U-N-S number
  for orgs) — individual is almost certainly right for a solo/small-team app like this.

### Beta test requirement — why it's necessary here

Since November 2023, **new Play Console developer accounts must run a closed test with
at least 20 opted-in testers, active continuously for 14 days**, before Google grants
"Production access" (i.e. before the app can go live to the public Production track at
all). This applies regardless of how polished the app is — it's a blanket account-level
gate for new accounts, not a judgement call Google makes per-app. So yes: a beta phase
isn't optional for a first release from a new account.

### Recommended track sequence

1. **Internal testing** — up to 100 testers (added by email in Play Console), builds go
   live to testers within minutes, effectively no review. Use this first, with just
   yourself/close collaborators, to shake out install-time issues (signing, permissions
   prompts, crash-on-launch) before wider eyes see it.
2. **Closed testing** — invite via an email list or a Google Group; this is the track
   that has to satisfy the 20-testers/14-days requirement above. Needs real opted-in
   testers actually opening the app across that window, not just added-but-inactive
   emails — recruit accordingly (e.g. ask MTB community contacts, Instagram followers).
   Builds here go through a lighter review than Production, typically faster.
3. **Open testing** *(optional)* — a public beta anyone can join via a Play Store link;
   the listing shows as "Early access". Useful for broader real-world feedback but not
   required to clear the new-account gate — only closed testing counts toward that.
4. **Apply for Production access** once the closed-testing window + tester-count
   requirement is satisfied (Play Console will show whether you've met it). This
   triggers Google's full policy review of the store listing + app itself before the
   Production track can be turned on for the first time.
5. **Production**, ideally with a **staged rollout** (e.g. 10% → 25% → 50% → 100%) so a
   bad build only reaches a fraction of users before you can pause the rollout from Play
   Console — no new review cycle needed to pause/resume a staged rollout.

### Update cadence during and after beta

- **Internal testing:** update as often as you want — new builds reach testers within
  minutes, no meaningful review gate. Good track for daily iteration.
- **Closed/open testing:** no official cap on release frequency; review is generally
  fast (often within hours), but isn't instant like internal testing. Many teams ship
  multiple beta builds a week here without issue.
- **Production:** also no official hard limit on how often you can publish an update —
  some apps release several times a week. Each update is independently reviewed
  (Google's own guidance suggests most reviews complete within a few hours to ~2 days;
  first-ever submission, or an app requesting sensitive permissions like fine location,
  can take longer — up to ~7 days — and is more likely to get a manual look rather than
  pure automated review). There's no cooldown *enforced* between releases, but a pattern
  of broken or policy-violating releases can trigger stricter/manual review on
  subsequent uploads, so treat "no limit" as a ceiling, not a target.
- Every single upload (any track) needs a strictly higher `versionCode` than the last,
  regardless of which track it's going to — Play Console will reject a re-used or lower
  `versionCode` outright.
