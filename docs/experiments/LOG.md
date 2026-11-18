# Experiment log

Newest first. One entry per concluded experiment. Copy the numbers from `npm run experiment:report`.

## aa-baseline-2 (2026-11-10 → 2026-11-18): no_difference
- Hypothesis: A/A test, two identical variants; validates the tagging/report pipeline and measures noise.
- Season / conditions: November, mud season, ~90 visits/day; signup promo (4 weeks free Supporter) active.
- Visits per variant: a=364, b=376
- Engaged rate: a=18.7%, b=21.0% (diff +2.3 pp, 95% CI [-3.4, 8.1] pp, z=0.79, p=0.4272)
- Decision: pipeline validated; kept control.
- Learning: noise band is about ±6 pp at ~350 visits per arm, so only bold variants are detectable.

<!-- template
## <id> (<startedAt> → <endedAt>): <winner|loser|no_difference>
- Hypothesis: …
- Season / conditions: …  (winter verdicts on "ride now" features: recheck in spring)
- Visits per variant: a=…, b=…
- Engaged rate: a=…%, b=…% (lift …%, p=…)
- Avg visit time: a=…s, b=…s · spot_open/visit: a=…, b=…
- Decision: shipped B as default | kept control | …
- Learning: …
-->
