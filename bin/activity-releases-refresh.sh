#!/usr/bin/env bash
#
# Daily refresh of _data/activity.json, run by
# .github/workflows/activity-releases.yml (#73). It regenerates the file with
# bin/activity-releases.js, checks it, commits it to main as github-actions,
# and dispatches the deploy. To refresh by hand, run
# `node bin/activity-releases.js` and commit the result instead: this script
# pushes to main, so it refuses to run outside Actions.
#
#   bin/activity-releases-refresh.sh   (from the workflow; needs GITHUB_ACTIONS=true)
#
# Stale-but-present beats fresh-but-blank (#54). Nothing is committed unless
# every step before the commit passed, so a failed run leaves the current data
# on the site and goes red with the action a human has to take:
#
#   1. Fetch. bin/activity-releases.js fails closed: if any repo fails, it
#      writes nothing. Its stderr lines (`error:` / `  action:`, `usage
#      error:`, `unexpected error:`) become Actions annotations. (It prints no
#      `warning:` lines; the parse loop below keeps that branch only because
#      it is a copy of its twin, #165.) Exit 1
#      with at least one `error:` line and no `unexpected error:` line means a
#      human must do what each error's action says; exit 1 otherwise means it
#      crashed. Exit 75 (transient) means re-run; anything else is a usage
#      error or a bug.
#   2. Only the data file may change.
#   3. Guardrail, read with Ruby's JSON (not the script's own code), on every
#      run, so it also checks the file the site is already serving: every
#      release is a well-formed entry (minor+ tag, a release URL on
#      github.com under that entry's repo, a summary that is null or one line
#      of text with no angle brackets, line separators or bidi controls), no
#      `repo@tag` appears twice, and no `repo@tag` the committed file has is
#      missing. That last check is the independent "never shorten" backstop
#      for the script's own fail-closed rules. It also reports whether the
#      file equals the committed one apart from `generated_at`. When a release
#      really was deleted or demoted upstream, or a repo was removed from
#      RELEASE_REPOS, confirm it, then run node bin/activity-releases.js
#      locally and commit the result (a human push does not go through this
#      guardrail). When EVERY release of a repo is gone, the local run refuses
#      too: remove the repo from RELEASE_REPOS first. Never edit the file by
#      hand.
#   4. No change means no commit and no deploy. "No change" is decided here,
#      independently of the script's own unchanged check: the file equals the
#      committed one apart from `generated_at` (step 3). A rewrite that changes
#      only the timestamp is discarded, so a regression in the script cannot
#      turn into a daily commit and deploy.
#   5. Commit and push, through push_head_to_main in bin/push-dispatch.sh. No
#      rebase on a rejected push: the rebased tree would be one step 3 never
#      checked. The run goes red and a re-run starts from the new main.
#   6. Dispatch deploy.yml, through dispatch_deploy in bin/push-dispatch.sh.
#
# esc, summary, fail and the stderr parse loop are copies of their twins in
# bin/repo-stats-refresh.sh; extracting them is #165.

set -euo pipefail

# shellcheck source=bin/push-dispatch.sh
source "$(dirname "$0")/push-dispatch.sh"

DATA=_data/activity.json

# Twin of esc in bin/repo-stats-refresh.sh (#165). Workflow-command text must
# escape %, CR and LF; the messages carry API text.
esc() {
  local s=$1
  s=${s//'%'/'%25'}
  s=${s//$'\r'/'%0D'}
  s=${s//$'\n'/'%0A'}
  printf '%s' "$s"
}

# Twin of summary in bin/repo-stats-refresh.sh (#165).
summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then printf '%s\n\n' "$1" >>"$GITHUB_STEP_SUMMARY"; fi
}

# Twin of fail in bin/repo-stats-refresh.sh (#165). fail <verdict> [code]
# [item...]: the verdict annotation first, then one per item.
fail() {
  local verdict=$1 code=${2:-1} item
  if (($# >= 2)); then shift 2; else shift; fi
  echo "::error::$(esc "$verdict")"
  for item in "$@"; do echo "::error::$(esc "$item")"; done
  summary "**Failed:** $verdict"
  if (($#)); then summary "$(printf -- '- %s\n' "$@")"; fi
  exit "$code"
}

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "bin/activity-releases-refresh.sh commits and pushes to main and is meant for .github/workflows/activity-releases.yml." >&2
  echo "To refresh by hand, run node bin/activity-releases.js and commit _data/activity.json." >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"

# 1. Fetch.
stderr_log=$(mktemp)
committed=$(mktemp)
trap 'rm -f "$stderr_log" "$committed"' EXIT
code=0
node bin/activity-releases.js 2>"$stderr_log" || code=$?

# Replay the raw stderr with workflow commands stopped, because it carries API
# text (release tags) that could otherwise start a line with `::`.
token=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
echo "::stop-commands::$token"
cat "$stderr_log"
echo "::$token::"

# Twin of the parse loop in bin/repo-stats-refresh.sh (#165).
errors=()
warnings=()
crashed=0
reported=0
pending=""
while IFS= read -r line || [[ -n $line ]]; do
  case $line in
    "warning: "*) warnings+=("${line#warning: }") ;;
    "error: "*)
      reported=$((reported + 1))
      if [[ -n $pending ]]; then errors+=("$pending"); fi
      pending=${line#error: }
      ;;
    "  action: "*)
      if [[ -n $pending ]]; then
        errors+=("$pending. Action: ${line#  action: }")
        pending=""
      fi
      ;;
    "unexpected error: "*)
      crashed=1
      errors+=("$line")
      ;;
    "usage error: "*) errors+=("$line") ;;
  esac
done <"$stderr_log"
if [[ -n $pending ]]; then errors+=("$pending"); fi

for w in "${warnings[@]}"; do echo "::warning::$(esc "$w")"; done
if ((${#warnings[@]})); then
  summary "**Warnings:**"$'\n'"$(printf -- '- %s\n' "${warnings[@]}")"
fi

if ((code != 0)); then
  case $code in
    1)
      if ((crashed || reported == 0)); then
        verdict="bin/activity-releases.js crashed (exit 1), which is a bug in it; see the stack trace in this step's log. Nothing was committed and the site keeps its current data."
      else
        verdict="bin/activity-releases.js failed permanently (exit 1), so nothing was committed and the site keeps its current data. Do what each error's action says."
      fi
      ;;
    75) verdict="bin/activity-releases.js hit transient errors only (exit 75), so nothing was committed and the site keeps its current data. Re-run this workflow (Actions, Refresh activity releases, Run workflow)." ;;
    *) verdict="bin/activity-releases.js exited $code, which is a usage error or a bug in it or in this script. Nothing was committed." ;;
  esac
  fail "$verdict" "$code" "${errors[@]}"
fi

# 2. Only the data file may change. A first run creates it.
status=$(git status --porcelain --untracked-files=all)
if [[ -n $status && $status != " M $DATA" && $status != "?? $DATA" ]]; then
  fail "unexpected working-tree changes after bin/activity-releases.js (only $DATA may change), so nothing was committed. This is a bug: $status"
fi

# 3. Guardrail, read independently of bin/activity-releases.js. The committed
# copy is what the site serves. It is empty only when HEAD has no such file (a
# first run), which skips the never-shorten check; any other git failure stops
# the run under set -e rather than skipping the check. It must print its
# sentinel line: a Ruby that exits 0 without running proves nothing. Ruby
# prints plain one-line results; this script escapes and annotates them, so
# nothing from the data reaches the log raw.
if git cat-file -e "HEAD:$DATA" 2>/dev/null; then
  git show "HEAD:$DATA" >"$committed"
else
  : >"$committed"
fi
rc=0
guard=$(ruby -rjson -e '
  one_line = ->(s) { s.to_s.gsub(/[\r\n]/, " ")[0, 200] }
  unsafe = /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u2028\u2029\u202a-\u202e\u2066-\u2069<>]/
  begin
    out, committed = ARGV
    data = JSON.parse(File.read(out))
    problems = []
    releases = data.is_a?(Hash) ? data["releases"] : nil
    unless releases.is_a?(Array)
      puts "problem: #{out}: releases is not an array"
      exit 3
    end
    keys = {}
    releases.each_with_index do |r, i|
      unless r.is_a?(Hash)
        problems << "#{out}: release #{i} is not an object"
        next
      end
      where = "#{out}: release #{i}"
      %w[repo tag date url].each do |f|
        problems << "#{where}: #{f} is not a non-empty string" unless r[f].is_a?(String) && !r[f].strip.empty?
      end
      next unless %w[repo tag date url].all? { |f| r[f].is_a?(String) }
      key = "#{r["repo"]}@#{r["tag"]}"
      problems << "#{out}: #{key.inspect} appears twice" if keys[key]
      keys[key] = true
      problems << "#{where}: tag #{r["tag"].inspect} is not minor-or-greater (vX.Y.0)" unless r["tag"].match?(/\Av?\d+\.\d+\.0\z/)
      problems << "#{where}: date #{r["date"].inspect} is not ISO 8601 UTC" unless r["date"].match?(/\A\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ\z/)
      repo_url = %r{\Ahttps://github\.com/[\w.-]+/#{Regexp.escape(r["repo"])}/releases/[^\s"\x27<>]+\z}i
      problems << "#{where}: url is not a release page of #{r["repo"]} on github.com" unless r["url"].match?(repo_url)
      s = r["summary"]
      unless s.nil? || (s.is_a?(String) && !s.strip.empty? && !s.match?(unsafe))
        problems << "#{where}: summary is not null or one line of plain text (no angle brackets, line separators or bidi controls)"
      end
    end
    before = File.size?(committed) ? JSON.parse(File.read(committed)) : nil
    strip = ->(d) { d.is_a?(Hash) ? d.reject { |k, _| k == "generated_at" } : d }
    same = !before.nil? && strip.(before) == strip.(data)
    if before.is_a?(Hash) && before["releases"].is_a?(Array)
      old = before["releases"].select { |r| r.is_a?(Hash) }.map { |r| "#{r["repo"]}@#{r["tag"]}" }
      missing = old - keys.keys
      problems << "#{out}: drops #{missing.size} release(s) the committed file has: #{missing.join(", ")}" unless missing.empty?
    elsif before
      problems << "the committed #{out} is not a releases file"
    end
    problems.each { |p| puts "problem: " + one_line.(p) }
    exit 3 unless problems.empty?
    puts "guardrail: ok #{releases.size} releases #{same ? "same-as-HEAD" : "changed"}"
  rescue StandardError => e
    puts "could not run: " + one_line.("#{e.class}: #{e.message}")
    exit 4
  end
' "$DATA" "$committed") || rc=$?
problems=()
crash=()
ok=""
while IFS= read -r line; do
  case $line in
    "problem: "*) problems+=("${line#problem: }") ;;
    "could not run: "*) crash+=("guardrail raised: ${line#could not run: }") ;;
    "guardrail: ok "*) ok=$line ;;
  esac
done <<<"$guard"
if ((rc == 3)); then
  fail "guardrail: $DATA failed its checks, so nothing was committed. A malformed entry is a bug in bin/activity-releases.js. A dropped release means a release was deleted or demoted upstream, a repo was removed from RELEASE_REPOS, or the script's filter regressed: confirm which on GitHub; if the drop is real, run node bin/activity-releases.js locally and commit the result (never edit the file by hand). If every release of a repo is gone, remove it from RELEASE_REPOS first, or the local run refuses too." 1 "${problems[@]}"
fi
if ((rc != 0)) || ! grep -Eq '^guardrail: ok [0-9]+ releases (same-as-HEAD|changed)$' <<<"$ok"; then
  if ((${#crash[@]})); then
    fail "guardrail raised an exception reading $DATA or its committed copy, so nothing was committed. A JSON::ParserError on $DATA is a bug in bin/activity-releases.js; any other is a bug in this script's guardrail." 1 "${crash[@]}"
  fi
  fail "guardrail could not run (ruby exit $rc, or no ok line), so nothing was committed. Ruby is missing or crashed on the runner; this is a bug in this script or the runner image, not in the data."
fi
echo "$ok"

# 4. No change, no commit, no deploy. Decided by the guardrail's comparison
# with the committed file, not by git status alone, so a rewrite that only
# moved `generated_at` is discarded here.
if [[ -z $status || $ok == *" same-as-HEAD" ]]; then
  if [[ -n $status ]]; then
    git checkout --quiet -- "$DATA"
    echo "$DATA differs from HEAD only in generated_at; discarded. bin/activity-releases.js should have left it untouched, so its unchanged check may have regressed."
    echo "::warning::$(esc "$DATA was rewritten with only generated_at changed; discarded. Check bin/activity-releases.js's unchanged-data check (sameData).")"
  fi
  echo "$DATA unchanged: no commit, no deploy."
  summary "$DATA unchanged: no commit, no deploy."
  exit 0
fi

# 5. Commit and push.
git config user.name "github-actions"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -- "$DATA"
git commit --quiet -m "chore(activity): refresh release data"
sha=$(git rev-parse HEAD)
push_rc=0
push_head_to_main || push_rc=$?
case $push_rc in
  0) ;;
  3) fail "push of $sha reported failure, and git ls-remote failed too, so whether main has it is unknown. If main contains $sha, run: gh workflow run deploy.yml --ref main. If not, re-run this workflow." ;;
  *) fail "push of $sha to main failed and main's head is not $sha. Most likely the push was rejected because main moved during the run; rarely, it landed and another push landed on top. Re-run this workflow; it checks out the new main. If the re-run reports unchanged, main already has the data: run gh workflow run deploy.yml --ref main if no deploy has run since." ;;
esac
echo "pushed $sha to main."

# 6. Dispatch the deploy. A push made with the workflow's GITHUB_TOKEN creates
# no workflow runs, so deploy.yml's `_data/**` push filter never fires for the
# commit above: without this step the run goes green and the site never
# updates. Why the dispatch must stay explicit is in bin/push-dispatch.sh.
deploys="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-frederick-douglas-pearce/frederick-douglas-pearce.github.io}/actions/workflows/deploy.yml"
# shellcheck disable=SC2119 # a plain dispatch, no -f inputs
if dispatch_deploy; then
  echo "dispatched deploy.yml for $sha; its result is not watched here: $deploys"
  summary "Pushed $sha and dispatched deploy.yml. This run does not watch the deploy; check it at $deploys"
  exit 0
fi
fail "pushed $sha to main, but dispatching deploy.yml failed 3 times. Run: gh workflow run deploy.yml --ref main. Re-running this workflow will NOT deploy it, because main already has the commit. The next push-triggered deploy (normally the daily ESG feed) ships it anyway."
