#!/bin/bash
# SessionStart hook (Claude Code cloud sessions only): get the vendored showtime
# plugin (.claude/plugins/showtime) ready to render, so `showtime doctor` says ready.
#
#  1. Chromium. showtime downloads its own Chrome Headless Shell from
#     cdn.playwright.dev, which the cloud network blocks. The cloud image already
#     ships Playwright's Chromium in $PLAYWRIGHT_BROWSERS_PATH (/opt/pw-browsers),
#     but in an older folder layout. Expose it where showtime looks:
#     <dir>/chromium_headless_shell-N/chrome-headless-shell-linux64/chrome-headless-shell
#     in both that folder and showtime's own ~/.showtime/browsers.
#  2. `showtime setup` (core tier, ~800 MB the first time). It resumes, so once the
#     container is cached it only checks what is already there.
#
# Idempotent and non-interactive. A failure is reported, not fatal: the session
# still starts, and `showtime doctor` names what is missing.
set -uo pipefail

[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] || exit 0

PROJECT="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
ST="$PROJECT/.claude/plugins/showtime/skills/showtime/bin/showtime"
[ -x "$ST" ] || exit 0

ST_HOME="${SHOWTIME_HOME:-$HOME/.showtime}"
PWB="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}"
LOG="$ST_HOME/logs/session-start.log"
mkdir -p "$ST_HOME/browsers" "$ST_HOME/logs"

newest() {  # newest "<prefix>-<rev>" directory in $PWB
  ls -d "$PWB"/"$1"-[0-9]* 2>/dev/null | sort -V | tail -1
}

chrome=""
full="$(newest chromium)"
if [ -n "$full" ] && [ -x "$full/chrome-linux/chrome" ]; then
  chrome="$full/chrome-linux/chrome"
  ln -sfn "$full" "$ST_HOME/browsers/$(basename "$full")"
fi

shell_dir="$(newest chromium_headless_shell)"
if [ -n "$shell_dir" ] && [ -x "$shell_dir/chrome-linux/headless_shell" ]; then
  name="$(basename "$shell_dir")"
  # in the image's folder (what showtime uses when PLAYWRIGHT_BROWSERS_PATH is set)
  if mkdir -p "$shell_dir/chrome-headless-shell-linux64" 2>/dev/null; then
    ln -sfn ../chrome-linux/headless_shell "$shell_dir/chrome-headless-shell-linux64/chrome-headless-shell"
  fi
  # and in showtime's own folder (what it uses when it is not)
  mkdir -p "$ST_HOME/browsers/$name/chrome-headless-shell-linux64"
  ln -sfn "$shell_dir/chrome-linux/headless_shell" "$ST_HOME/browsers/$name/chrome-headless-shell-linux64/chrome-headless-shell"
fi

# SHOWTIME_CHROME tells setup a browser exists, so it skips the blocked download.
if SHOWTIME_CHROME="$chrome" "$ST" setup >"$LOG" 2>&1; then
  echo "showtime: ready (setup log: $LOG)"
else
  echo "showtime: setup did not finish; see $LOG, or run: $ST doctor"
fi
exit 0
