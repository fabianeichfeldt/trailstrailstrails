#!/usr/bin/env bash
# Quiet test hook. Tests run when an agent says it's done, not after every edit (red is expected mid-TDD).
#   run-tests.sh subagent  (SubagentStop: tests related to the changed .ts/.vue files)
#   run-tests.sh stop      (Stop: full unit suite, main agent)
# Success => no output, exit 0. Failure => <=25 line summary on stderr, exit 2 (fed back to the agent).
set -u
mode="${1:-stop}"
input="$(cat)"
jqr() { printf '%s' "$input" | jq -r "$1" 2>/dev/null; }

cd "$(jqr '.cwd // empty' | grep . || echo "${CLAUDE_PROJECT_DIR:-.}")" 2>/dev/null || exit 0
[ -x node_modules/.bin/vitest ] || exit 0
[ "$(jqr '.stop_hook_active // false')" = true ] && exit 0   # already retried once: never loop

# One run at a time per checkout; parallel agents skip instead of piling up. Stale after 10 min.
key="$(pwd | shasum | cut -c1-12)"
lock="${TMPDIR:-/tmp}/claude-tests-$key.lock"
if [ -d "$lock" ] && [ -n "$(find "$lock" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then rmdir "$lock" 2>/dev/null; fi
mkdir "$lock" 2>/dev/null || exit 0

# Changed since the last green full run (mtime, so mid-turn commits still count); no marker yet => uncommitted changes.
marker="${TMPDIR:-/tmp}/claude-tests-$key.green"
stamp="$marker.$$"; touch "$stamp"; trap 'rmdir "$lock" 2>/dev/null; rm -f "$stamp"' EXIT   # taken before the run: edits during it count next time
if [ -f "$marker" ]; then
  changed="$(find app server -type f \( -name '*.ts' -o -name '*.vue' \) -newer "$marker" 2>/dev/null)"
else
  changed="$(git status --porcelain 2>/dev/null | awk '{print $NF}' | grep -E '\.(ts|vue)$')"
  [ -z "$changed" ] && mv "$stamp" "$marker"   # clean tree: start the mtime baseline here
fi
changed="$(printf '%s\n' "$changed" | grep -vE '(^|/)(node_modules|\.nuxt|\.output|tests)/|\.d\.ts$' | grep .)" || exit 0   # tests/ = playwright e2e

if [ "$mode" = stop ]; then
  args=(run); limit=240
else
  # shellcheck disable=SC2086
  args=(related --run $changed); limit=90
fi

# Fresh worktree, or app/ files added/removed since the last prepare (dir mtime) => stale .nuxt auto-imports/tsconfig.
if [ ! -f .nuxt/tsconfig.json ] || [ -n "$(find app -type d -newer .nuxt/tsconfig.json -print -quit 2>/dev/null)" ]; then
  if ! node_modules/.bin/nuxt prepare >/dev/null 2>&1; then
    echo "nuxt prepare failed; run \`npx nuxt prepare\` and fix its error before trusting test results." >&2
    exit 2
  fi
fi

out="$(perl -e 'alarm shift; exec @ARGV' "$limit" node_modules/.bin/vitest "${args[@]}" --reporter=default --no-color 2>&1)"
rc=$?
if [ $rc -eq 0 ]; then
  [ "$mode" = stop ] && mv "$stamp" "$marker"
  exit 0
fi

clean="$(printf '%s' "$out" | tr -d '\000' | sed -E $'s/\x1b\\[[0-9;?]*[A-Za-z]//g')"
if [ $rc -eq 142 ]; then summary="Tests timed out after ${limit}s."
else
  # failing test names, first error line of each, then the totals
  summary="$(printf '%s\n' "$clean" | grep -E '^ *(FAIL|×|✗)|^(Assertion|Type|Reference|Syntax)?Error|^ *Error:|Test Files |Tests ' | awk '!seen[$0]++' | head -25)"
  [ -z "$summary" ] && summary="$(printf '%s\n' "$clean" | grep -v '^\s*$' | tail -5)"
fi
printf 'Unit tests failed (%s):\n%s\n' "$mode" "$summary" | cut -c1-240 | head -27 >&2
exit 2
