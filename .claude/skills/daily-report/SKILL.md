---
name: daily-report
description: Short Trailradar traffic report from Umami. Shows yesterday (or a given day) vs. the 7-day average, returning visitors, top spots and pages, sources, and the running experiment's status. Use when the user says "daily report", "how was yesterday", "traffic report", "do people come back", or /daily-report.
---

# Daily report

Keep it cheap: the script does all the math. Your job is only to show its table and add a few sentences.

1. Run `npm run -s daily:report` (or `-- --date YYYY-MM-DD` if the user names a day).
   - Credentials missing or empty: tell the user to run
     `security add-generic-password -U -s trailradar-umami -a reporter -w` in a normal Terminal window (not via `!`). Stop.
   - 401 on stats: the `reporter` user is no longer in the Umami team that owns the trailradar website. It rejoins with the team's access code (`POST /api/teams/join`). Stop and say so.
2. Show the script's markdown as is. Don't recompute or reformat it.
3. Add **at most 3 sentences**:
   - the biggest change against the 7-day average and a plausible reason (weekday/weekend, weather, a deploy, a social post), labelled as a guess
   - the returning-visitor trend, always remembering it is a lower bound
   - the experiment line, and only if it says "ready": suggest `/experiment-cycle`
4. Don't read code, git history or other files unless the user asks a follow-up.

Season: traffic falls October–March. A drop against the 7-day average late in the year is normal and not a finding by itself.
