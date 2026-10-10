#!/usr/bin/env bash
# Quiet test hook. Usage: run-tests.sh edit   (PostToolUse Write|Edit: related tests only)
#                        run-tests.sh stop    (Stop: full unit suite, main agent only; SubagentStop is not wired)
# Success => no output, exit 0. Failure => <=25 line summary on stderr, exit 2 (fed back to Claude).
set -u
mode="${1:-edit}"
input="$(cat)"
jqr() { printf '%s' "$input" | jq -r "$1" 2>/dev/null; }

cd "$(jqr '.cwd // empty' | grep . || echo "${CLAUDE_PROJECT_DIR:-.}")" 2>/dev/null || exit 0
[ -x node_modules/.bin/vitest ] || exit 0

# One run at a time per checkout; parallel agents skip instead of piling up. Stale after 10 min.
lock="${TMPDIR:-/tmp}/claude-tests-$(pwd | shasum | cut -c1-12).lock"
if [ -d "$lock" ] && [ -n "$(find "$lock" -maxdepth 0 -mmin +10 2>/dev/null)" ]; then rmdir "$lock" 2>/dev/null; fi
mkdir "$lock" 2>/dev/null || exit 0
trap 'rmdir "$lock" 2>/dev/null' EXIT

if [ "$mode" = stop ]; then
  [ "$(jqr '.stop_hook_active // false')" = true ] && exit 0   # already retried once: never loop
  git status --porcelain 2>/dev/null | awk '{print $NF}' | grep -qE '\.(ts|vue)$' || exit 0
  args=(run); limit=240
else
  file="$(jqr '.tool_input.file_path // empty')"
  case "$file" in
    */node_modules/*|*/.nuxt/*|*/.output/*|*/tests/*|*.d.ts) exit 0 ;;   # tests/ = playwright e2e
    *.ts|*.vue) ;;
    *) exit 0 ;;
  esac
  args=(related --run "$file"); limit=90
fi

out="$(perl -e 'alarm shift; exec @ARGV' "$limit" node_modules/.bin/vitest "${args[@]}" --reporter=default --no-color 2>&1)"
rc=$?
[ $rc -eq 0 ] && exit 0

clean="$(printf '%s' "$out" | tr -d '\000' | sed -E $'s/\x1b\\[[0-9;?]*[A-Za-z]//g')"
if [ $rc -eq 142 ]; then summary="Tests timed out after ${limit}s."
else
  # failing test names, first error line of each, then the totals
  summary="$(printf '%s\n' "$clean" | grep -E '^ *(FAIL|×|✗)|^(Assertion|Type|Reference|Syntax)?Error|^ *Error:|Test Files |Tests ' | awk '!seen[$0]++' | head -25)"
  [ -z "$summary" ] && summary="$(printf '%s\n' "$clean" | grep -v '^\s*$' | tail -5)"
fi
printf 'Unit tests failed (%s):\n%s\n' "$mode" "$summary" | cut -c1-240 | head -27 >&2
exit 2
