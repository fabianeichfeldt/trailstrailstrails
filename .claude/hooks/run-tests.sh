#!/usr/bin/env bash
# Quiet test hook. Tests run when an agent says it's done, not after every edit (red is expected mid-TDD).
#   run-tests.sh subagent  (SubagentStop: tests related to the changed .ts/.vue files)
#   run-tests.sh stop      (Stop: full unit suite, then Playwright E2E if app/server/tests/config changed; main agent)
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
emarker="${TMPDIR:-/tmp}/claude-e2e-$key.green"
port=$((3100 + 16#${key:0:6} % 800))   # per-checkout port: a worktree never reuses another checkout's dev server
stamp="$marker.$$"; estamp="$emarker.$$"; touch "$stamp" "$estamp"   # taken before the run: edits during it count next time
kill_port() { lsof -ti "tcp:$port" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null; }
trap 'rmdir "$lock" 2>/dev/null; rm -f "$stamp" "$estamp"; [ -n "${e2e_started:-}" ] && kill_port' EXIT
if [ -f "$marker" ]; then
  changed="$(find app server -type f \( -name '*.ts' -o -name '*.vue' \) -newer "$marker" 2>/dev/null)"
else
  changed="$(git status --porcelain 2>/dev/null | awk '{print $NF}' | grep -E '\.(ts|vue)$')"
  [ -z "$changed" ] && mv "$stamp" "$marker"   # clean tree: start the mtime baseline here
fi
changed="$(printf '%s\n' "$changed" | grep -vE '(^|/)(node_modules|\.nuxt|\.output|tests)/|\.d\.ts$' | grep .)"   # tests/ = playwright e2e
run_unit=1; [ -z "$changed" ] && run_unit=0

# E2E (stop only): any app/server/tests/playwright/nuxt config file newer than the last green E2E run.
run_e2e=0
if [ "$mode" = stop ] && [ -x node_modules/.bin/playwright ] \
   && { compgen -G "${PLAYWRIGHT_BROWSERS_PATH:-$HOME/Library/Caches/ms-playwright}/chromium-*" >/dev/null || compgen -G "$HOME/.cache/ms-playwright/chromium-*" >/dev/null; }; then
  if [ -f "$emarker" ]; then
    e="$(find app server tests playwright.config.ts nuxt.config.ts -type f -newer "$emarker" -not -path '*/node_modules/*' -not -name '*.test.ts' 2>/dev/null | head -1)"
  else
    e="$(git status --porcelain 2>/dev/null | awk '{print $NF}' | grep -E '^(app|server|tests)/|^(playwright|nuxt)\.config\.ts$' | grep -v '\.test\.ts$' | head -1)"
    [ -z "$e" ] && mv "$estamp" "$emarker"   # clean tree: start the E2E baseline here
  fi
  [ -n "$e" ] && run_e2e=1
fi
[ "$mode" = stop ] || run_e2e=0
[ $run_unit = 0 ] && [ $run_e2e = 0 ] && exit 0

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

fail() { # $1 label, $2 raw output, $3 grep pattern
  local clean summary
  clean="$(printf '%s' "$2" | tr -d '\000' | sed -E $'s/\x1b\\[[0-9;?]*[A-Za-z]//g')"
  summary="$(printf '%s\n' "$clean" | grep -E "$3" | awk '!seen[$0]++' | head -25)"
  [ -z "$summary" ] && summary="$(printf '%s\n' "$clean" | grep -v '^\s*$' | tail -5)"
  printf '%s failed (%s):\n%s\n' "$1" "$mode" "$summary" | cut -c1-240 | head -27 >&2
  exit 2
}

if [ $run_unit = 1 ]; then
  out="$(perl -e 'alarm shift; exec @ARGV' "$limit" node_modules/.bin/vitest "${args[@]}" --reporter=default --no-color 2>&1)"
  rc=$?
  if [ $rc -eq 0 ]; then
    [ "$mode" = stop ] && mv "$stamp" "$marker"
  elif [ $rc -eq 142 ]; then echo "Unit tests timed out after ${limit}s." >&2; exit 2
  else
    # failing test names, first error line of each, then the totals
    fail "Unit tests" "$out" '^ *(FAIL|×|✗)|^(Assertion|Type|Reference|Syntax)?Error|^ *Error:|Test Files |Tests '
  fi
fi

# E2E only after the unit suite is green. Budget: cold `nuxt dev` boot (<=120s) + suite + headroom; settings.json Stop timeout = 240 + 420 + 40.
if [ $run_e2e = 1 ]; then
  e2e_limit=420
  kill_port; e2e_started=1   # clear a stale server on our own port; CI=1 stops playwright reusing any server
  out="$(CI=1 E2E_PORT=$port perl -e 'alarm shift; exec @ARGV' "$e2e_limit" node_modules/.bin/playwright test --reporter=line 2>&1)"
  rc=$?
  kill_port
  if [ $rc -eq 0 ]; then mv "$estamp" "$emarker"; exit 0
  elif [ $rc -eq 142 ]; then echo "E2E timed out after ${e2e_limit}s." >&2; exit 2
  else fail "E2E tests" "$out" '^ *[0-9]+\) |^ *Error:|^ *[0-9]+ (failed|passed|flaky|skipped)|Timed out|expect\('
  fi
fi
exit 0
