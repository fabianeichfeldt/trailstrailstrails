---
name: ui-summary
description: Use after changing UI (app/**/*.vue, CSS, pages, components) and before opening a PR. Captures before/after screenshots of the affected routes (desktop and mobile) and publishes one self-contained HTML overview as a private Artifact to link in the PR.
---

# UI overview for a PR

Never use production env. Never fake a view: if a route needs auth or data the mocks don't provide, say so in the note and in the final message.

1. **Affected routes.** `git diff --name-only main...HEAD -- app`. Map changed `app/pages/**` files to routes; for changed components/CSS, grep which pages use them (layouts or global CSS affect many: pick the main ones). List routes, and skipped ones with the reason.
2. **Screenshots.**
   - Start the app on a free port with the placeholder env from `playwright.config.ts`:
     `PORT=<free> E2E=1 NUXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co NUXT_PUBLIC_SUPABASE_KEY=placeholder-anon-key VITE_SUPABASE_URL=https://placeholder.supabase.co VITE_SUPABASE_ANON_KEY=placeholder-anon-key npm run dev` (in the background; stop it afterwards). Reuse the `page.route` mocks from `tests/*.spec.ts` where a page needs data.
   - Write a throwaway Playwright script in the scratchpad (not in the repo). For each route capture desktop 1280x800 and mobile 390x844 PNGs.
   - "Before" set: `git worktree add ../trailstrailstrails_worktrees/ui-before main` (or reuse it), `npm ci`, start it on another free port, same capture. If not feasible, skip it and say "no before set". Remove the worktree again if you created it only for this.
3. **Build.** Write a manifest JSON: `[{"route","title","note","before":"/abs/before.png","after":[{"label":"desktop","png":"/abs/a.png"},{"label":"mobile","png":"/abs/b.png"}]}]` (`before` is optional). Then run:
   `UI_SUMMARY_E2E="E2E: 12 passed" node scripts/ui-summary/build-overview.mjs <manifest.json> <out.html>`
   The E2E line comes from the last `npx playwright test` run (default "E2E: not run"). Branch and date are filled in automatically. Images are downscaled/JPEG-compressed with `sips` when available; the script warns if the file exceeds 8MB.
4. **Publish.** Load the `artifact-design` skill, then publish `<out.html>` with the Artifact tool, title "UI overview <branch>", private by default.
5. **Link.** Put the URL in the PR description under `## UI overview` and in the final message, with routes covered/skipped and any limits (mocked data, no auth, no before set).
