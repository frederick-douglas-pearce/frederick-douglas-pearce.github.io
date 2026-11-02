#!/usr/bin/env bash
#
# Weekly refresh of _data/repository_stats.json, run by
# .github/workflows/repo-stats.yml (#59). It regenerates the file with
# bin/repo-stats.js, checks it, commits it to main as github-actions, and
# dispatches the deploy. To refresh by hand, run `node bin/repo-stats.js` and
# commit the result instead: this script pushes to main, so it refuses to run
# outside Actions.
#
#   bin/repo-stats-refresh.sh      (from the workflow; needs GITHUB_ACTIONS=true)
#
# Stale-but-present beats fresh-but-blank (#54). Nothing is committed unless
# every step before the commit passed, so a failed run leaves last week's data
# on the site and goes red with the action a human has to take:
#
#   1. Fetch. bin/repo-stats.js validates everything before it writes, and
#      leaves the file untouched on failure or when the data is unchanged. Its
#      `error: <subject>: <message>` / `  action: <action>` and `warning: ...`
#      stderr lines become Actions annotations, so that format is an interface.
#      Exit 1 (permanent) means edit _data/repositories.yml, exit 75
#      (transient) means re-run, anything else is a bug.
#   2. Only the stats file may change. No change means no commit and no deploy.
#   3. Guardrail. The curated lists, read with Ruby's YAML (the reader Jekyll
#      uses, not the script's own line reader), must equal the output's repo
#      and user keys as sets. A count would pass a remove-one + add-one edit.
#   4. Commit and push. No rebase on a rejected push: the rebased tree would be
#      one step 3 never checked. The run goes red and a re-run starts from the
#      new main.
#   5. Dispatch deploy.yml (see the comment there for why it is explicit).
#
# Steps 4 and 5 are self-contained so another committing workflow (#72, #73)
# can reuse them.

set -euo pipefail

DATA=_data/repository_stats.json
INPUT=_data/repositories.yml

# Workflow-command text must escape %, CR and LF; the messages carry API text.
esc() {
  local s=$1
  s=${s//'%'/'%25'}
  s=${s//$'\r'/'%0D'}
  s=${s//$'\n'/'%0A'}
  printf '%s' "$s"
}

summary() {
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then printf '%s\n\n' "$1" >>"$GITHUB_STEP_SUMMARY"; fi
}

fail() {
  echo "::error::$(esc "$1")"
  summary "**Failed:** $1"
  exit "${2:-1}"
}

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "bin/repo-stats-refresh.sh commits and pushes to main and is meant for .github/workflows/repo-stats.yml." >&2
  echo "To refresh by hand, run node bin/repo-stats.js and commit _data/repository_stats.json." >&2
  exit 2
fi

cd "$(git rev-parse --show-toplevel)"

# 1. Fetch.
stderr_log=$(mktemp)
trap 'rm -f "$stderr_log"' EXIT
code=0
node bin/repo-stats.js 2>"$stderr_log" || code=$?
cat "$stderr_log" >&2

pending=""
while IFS= read -r line || [[ -n $line ]]; do
  case $line in
    "warning: "*) echo "::warning::$(esc "${line#warning: }")" ;;
    "error: "*)
      if [[ -n $pending ]]; then echo "::error::$(esc "$pending")"; fi
      pending=${line#error: }
      ;;
    "  action: "*)
      if [[ -n $pending ]]; then
        echo "::error::$(esc "$pending. Action: ${line#  action: }")"
        pending=""
      fi
      ;;
  esac
done <"$stderr_log"
if [[ -n $pending ]]; then echo "::error::$(esc "$pending")"; fi

case $code in
  0) ;;
  1) fail "bin/repo-stats.js failed permanently (exit 1), so nothing was committed and the site keeps its current data. Fix _data/repositories.yml as each error's action says, run node bin/repo-stats.js, and commit both files." 1 ;;
  75) fail "bin/repo-stats.js hit transient errors only (exit 75), so nothing was committed and the site keeps its current data. Re-run this workflow (Actions, Refresh repo stats, Run workflow)." 75 ;;
  *) fail "bin/repo-stats.js exited $code, which is a usage error or a bug in it or in this script. Nothing was committed." "$code" ;;
esac

# 2. Only the stats file may change.
status=$(git status --porcelain --untracked-files=all)
if [[ -z $status ]]; then
  echo "$DATA unchanged: no commit, no deploy."
  summary "$DATA unchanged: no commit, no deploy."
  exit 0
fi
if [[ $status != " M $DATA" ]]; then
  fail "unexpected working-tree changes after bin/repo-stats.js (only $DATA may change), so nothing was committed. This is a bug: $status"
fi

# 3. Guardrail: set equality, read independently of bin/repo-stats.js.
ruby -ryaml -rjson -e '
  input, out = ARGV
  curated = YAML.safe_load(File.read(input))
  data = JSON.parse(File.read(out))
  problems = []
  { "github_repos" => "repos", "github_users" => "users" }.each do |list, key|
    want = curated.is_a?(Hash) ? curated[list] : nil
    got = data.is_a?(Hash) ? data[key] : nil
    unless want.is_a?(Array) && !want.empty? && want.all? { |x| x.is_a?(String) }
      problems << "#{input}: #{list} is not a non-empty list of strings"
      next
    end
    unless got.is_a?(Hash)
      problems << "#{out}: #{key} is not an object"
      next
    end
    (want - got.keys).each { |n| problems << "#{out}: curated #{n} is missing from #{key}" }
    (got.keys - want).each { |n| problems << "#{out}: #{key} has #{n}, which is not in #{list}" }
  end
  problems.each { |p| puts "::error::" + p.gsub("%", "%25").gsub("\r", "%0D").gsub("\n", "%0A") }
  exit(problems.empty? ? 0 : 1)
' "$INPUT" "$DATA" || fail "guardrail: $DATA does not hold exactly the curated repos and users, so nothing was committed. bin/repo-stats.js and Jekyll's YAML reader disagree about $INPUT; see the errors above."

# 4. Commit and push.
git config user.name "github-actions"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -- "$DATA"
git commit --quiet -m "chore(repos): refresh repository stats"
sha=$(git rev-parse HEAD)
if ! git push origin HEAD:main; then
  fail "push of $sha to main was rejected, most likely because main moved during the run. Nothing was pushed. Re-run this workflow; it checks out the new main."
fi
echo "pushed $sha to main."

# 5. Dispatch the deploy. A push made with the workflow's GITHUB_TOKEN creates
# no workflow runs, so deploy.yml's `_data/**` push filter never fires for the
# commit above: without this step the run goes green and the site never
# updates. workflow_dispatch is one of the two events that token is allowed to
# trigger, which keeps this PAT-free. Do not "simplify" this into relying on
# the path filter, and do not replace the token with a PAT (#54, #72,
# CLAUDE.md "Deploy").
for delay in 10 30 ""; do
  if gh workflow run deploy.yml --ref main; then
    echo "dispatched deploy.yml for $sha."
    summary "Pushed $sha and dispatched deploy.yml."
    exit 0
  fi
  if [[ -n $delay ]]; then sleep "$delay"; fi
done
fail "pushed $sha to main, but dispatching deploy.yml failed 3 times. Run: gh workflow run deploy.yml --ref main. Re-running this workflow will NOT deploy it, because main already has the commit. The next push-triggered deploy (normally the daily ESG feed) ships it anyway."
