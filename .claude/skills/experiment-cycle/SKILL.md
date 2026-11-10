---
name: experiment-cycle
description: Run one round of the Trailradar engagement experiment loop. Read the active A/B test's Umami results, conclude it if the data is sufficient, and open a PR with the next variant from the backlog. Use when the user says "experiment cycle", "check the experiment", "next experiment", or a scheduled run invokes it.
---

# Experiment cycle

One round = read → decide → (conclude + build next) → PR. The user merges and deploys. Never merge, never
push to `main`, and never change a running experiment's variants: that invalidates its data.

## 1. Read

```bash
npm run experiment:report -- --json
```

Credentials come from the macOS keychain (`trailradar-umami`, account `reporter`). If they are missing or empty, stop and
tell the user to run `security add-generic-password -U -s trailradar-umami -a reporter -w` in a normal Terminal
window (not via `!`: no TTY there, so it stores an empty password). Never ask for the password in chat.

## 2. Decide

The report gives one verdict per variant vs. control (`a`):

| Verdict | Action |
|---|---|
| `need_more_data` | Stop. Report the visit counts and the estimated days to `minVisitsPerVariant` at the current rate. No PR. |
| `no_difference` | Conclude. Keep control, unless B is clearly simpler. |
| `winner` | Conclude. Make B the default for everyone and remove the variant branch. |
| `loser` | Conclude. Remove B. |

Sanity checks before trusting a verdict:
- Visits per variant should be within ±10% of each other. A bigger skew means the assignment or tagging is broken, so investigate instead of concluding.
- A guardrail metric must not get clearly worse (bounce rate up >5 points, visit time down >20%) in a "winner".
- The A/A test (`aa-baseline`) must end as `no_difference`. If it doesn't, the pipeline is broken: stop and report.
- Weekend vs. weekday and weather skew both arms equally in an A/B test, so they don't block a verdict. Do call out a big rain week in the log, though.

## Seasonality (traffic drops Oct–Mar)

- Both arms of an A/B test see the same season, so a verdict **within** one experiment stays valid. Never compare
  absolute numbers across experiments or against an earlier baseline: only the lift inside one experiment counts.
- Fewer visits make experiments longer. Estimate the days left to `minVisitsPerVariant` from the visits so far and
  report that. Never conclude early because a trend "looks clear" (peeking inflates false winners).
- The winter audience plans rides instead of riding today. Mark a winter verdict on a "ride now" hypothesis
  (e.g. `map-start-near-me`, `pin-status-badges`) as `recheck_in_spring` in the log, and prefer planning-content
  hypotheses (`nearby-carousel-detail`, `photos-first-panel`) between November and February.
- Record the season (and any unusual weather week) in each LOG.md entry.

## 3. Conclude (only if not `need_more_data`)

In a new worktree (see CLAUDE.md "Git commits & worktrees"):
1. In `app/analytics/experiments.json`, set the experiment's `status: "concluded"`, `endedAt`, and `result` (verdict + key numbers), and set `active` to the next experiment's id.
2. Apply the decision in code (ship B or remove it) and delete the `useExperiment('<id>')` branches.
3. Add an entry to `docs/experiments/LOG.md` and remove the row from `BACKLOG.md`.

## 4. Build the next variant

Take the top `ready` row of `docs/experiments/BACKLOG.md`. If none is ready, propose two new hypotheses based on
the log's learnings and stop without a PR.
- Add the experiment to `experiments.json` (`variants: ["a","b"]`, `status: "running"`, and `startedAt: null`; the user sets it on deploy day).
- Gate the change with `const variant = useExperiment('<id>')` and treat `variant === 'b'`. SSR and prerender render control, and the client may switch after mount. Avoid layout shift: reserve the space or render B below the fold.
- No storage of any kind for the variant (legal: § 25 TDDDG, see `/privacy` "Reichweitenmessung").
- If the variant introduces a new user action, add an event to `app/analytics/events.ts`, and update the privacy page's event examples if the action is a new kind of thing.
- Mobile first, with tests per CLAUDE.md. `npm test` must pass.

## 5. PR

Open a PR titled `experiment: conclude <old> (<verdict>), start <new>`. In the body, put the report table, the
decision, the hypothesis, and **"set `startedAt` to the deploy date after merging"**. Then tell the user what to check.
