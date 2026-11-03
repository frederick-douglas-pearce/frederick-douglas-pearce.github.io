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
# every step before the commit passed, so a failed run leaves the current data
# on the site and goes red with the action a human has to take:
#
#   1. Fetch. bin/repo-stats.js validates everything before it writes, and
#      leaves the file untouched on failure or when the data is unchanged. Its
#      stderr lines (`error:` / `  action:`, `warning:`, `usage error:`,
#      `unexpected error:`) become Actions annotations, so that format is an
#      interface. Exit 1 with at least one `error:` line and no `unexpected
#      error:` line means a human must do what each error's action says. Exit 1
#      with an `unexpected error:` line, or with no `error:` line at all (a
#      crash before its error handling ran, such as a SyntaxError), means it
#      crashed, which is a bug in it. Exit 75
#      (transient) means re-run; anything else is a usage error or a bug.
#   2. Only the stats file may change.
#   3. Guardrail, on every run, so it also checks the file the site is already
#      serving. The curated lists, read with Ruby's Psych (the parser under
#      Jekyll's SafeYAML, not the script's own line reader), must equal the
#      output's repo and user keys as sets, and every entry must be a non-empty
#      object. A count would pass a remove-one + add-one edit. Field values are
#      trusted to bin/repo-stats.js's own validation.
#   4. No change means no commit and no deploy.
#   5. Commit and push. No rebase on a rejected push: the rebased tree would be
#      one step 3 never checked. The run goes red and a re-run starts from the
#      new main.
#   6. Dispatch deploy.yml. The comment at step 6 below says why it is
#      explicit.
#
# Steps 5 and 6 are kept together at the end, using only $DATA, $sha, fail and
# summary, so #72/#73 can lift them out when a second committing workflow needs
# them.

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

# fail <verdict> [code] [item...]: the verdict annotation goes first, because
# Actions shows only the first few error annotations of a step, then one per
# item. The step summary keeps the verdict and the full list.
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

# Replay the raw stderr with workflow commands stopped, because it carries API
# text (a description or homepage) that could otherwise start a line with `::`.
token=$(od -An -N16 -tx1 /dev/urandom | tr -d ' \n')
echo "::stop-commands::$token"
cat "$stderr_log"
echo "::$token::"

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
      # A permanent failure bin/repo-stats.js reports prints an error: line,
      # and a crash its handlers catch prints unexpected error:. An exit 1 with
      # neither crashed before its handlers ran.
      if ((crashed || reported == 0)); then
        verdict="bin/repo-stats.js crashed (exit 1), which is a bug in it; see the stack trace in this step's log. Nothing was committed and the site keeps its current data."
      else
        verdict="bin/repo-stats.js failed permanently (exit 1), so nothing was committed and the site keeps its current data. Do what each error's action says. Most are curation fixes in _data/repositories.yml (then run node bin/repo-stats.js and commit both files); a fix on GitHub needs only a re-run of this workflow; a token, API-format, linguist or write failure needs a change to the workflow or to bin/repo-stats.js."
      fi
      ;;
    75) verdict="bin/repo-stats.js hit transient errors only (exit 75), so nothing was committed and the site keeps its current data. Re-run this workflow (Actions, Refresh repo stats, Run workflow)." ;;
    *) verdict="bin/repo-stats.js exited $code, which is a usage error or a bug in it or in this script. Nothing was committed." ;;
  esac
  fail "$verdict" "$code" "${errors[@]}"
fi

# 2. Only the stats file may change.
status=$(git status --porcelain --untracked-files=all)
if [[ -n $status && $status != " M $DATA" ]]; then
  fail "unexpected working-tree changes after bin/repo-stats.js (only $DATA may change), so nothing was committed. This is a bug: $status"
fi

# 3. Guardrail: set equality, read independently of bin/repo-stats.js. It must
# print its sentinel line: a Ruby that exits 0 without running proves nothing.
# Ruby prints plain one-line results and no workflow commands; this script
# escapes and annotates them, so nothing from the data reaches the log raw.
rc=0
guard=$(ruby -ryaml -rjson -e '
  one_line = ->(s) { s.to_s.gsub(/[\r\n]/, " ") }
  begin
    input, out = ARGV
    curated = YAML.safe_load(File.read(input))
    data = JSON.parse(File.read(out))
    problems = []
    counts = {}
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
      (want - got.keys).each { |n| problems << "#{out}: curated #{n.inspect} is missing from #{key}" }
      (got.keys - want).each { |n| problems << "#{out}: #{key} has #{n.inspect}, which is not in #{list}" }
      got.each { |n, v| problems << "#{out}: #{key} entry #{n.inspect} is not a non-empty object" unless v.is_a?(Hash) && !v.empty? }
      counts[key] = got.size
    end
    problems.each { |p| puts "problem: " + one_line.(p) }
    exit 3 unless problems.empty?
    puts "guardrail: ok #{counts["repos"]} repos #{counts["users"]} users"
  rescue StandardError => e
    puts "could not run: " + one_line.("#{e.class}: #{e.message}")
    exit 4
  end
' "$INPUT" "$DATA") || rc=$?
problems=()
crash=()
ok=""
while IFS= read -r line; do
  case $line in
    "problem: "*) problems+=("${line#problem: }") ;;
    "could not run: "*) crash+=("guardrail could not run: ${line#could not run: }") ;;
    "guardrail: ok "*) ok=$line ;;
  esac
done <<<"$guard"
if ((rc == 3)); then
  fail "guardrail: $DATA does not hold exactly the curated repos and users as non-empty entries, so nothing was committed. Either bin/repo-stats.js read $INPUT differently from Ruby's Psych, or it dropped, added or blanked an entry; both are bugs in bin/repo-stats.js. The problems are listed in the annotations and the step summary." 1 "${problems[@]}"
fi
if ((rc != 0)) || ! grep -Eq '^guardrail: ok [0-9]+ repos [0-9]+ users$' <<<"$ok"; then
  if ((${#crash[@]})); then
    fail "guardrail could not read $INPUT or $DATA (the error is listed in the annotations and the step summary), so nothing was committed. A YAML error in $INPUT is a curation fix there that bin/repo-stats.js's reader let through; a JSON error in $DATA is a bug in bin/repo-stats.js." 1 "${crash[@]}"
  fi
  fail "guardrail could not run (ruby exit $rc, or no ok line), so nothing was committed. Ruby is missing or crashed on the runner; this is a bug in this script or the runner image, not in the data."
fi
echo "$ok"

# 4. No change, no commit, no deploy.
if [[ -z $status ]]; then
  echo "$DATA unchanged: no commit, no deploy."
  summary "$DATA unchanged: no commit, no deploy."
  exit 0
fi

# 5. Commit and push.
git config user.name "github-actions"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git add -- "$DATA"
git commit --quiet -m "chore(repos): refresh repository stats"
sha=$(git rev-parse HEAD)
if ! git push origin HEAD:main; then
  # The client can report failure after the remote took the update. A re-run
  # would then find nothing to do and never dispatch, so check main first.
  if ! remote=$(git ls-remote origin refs/heads/main); then
    fail "push of $sha reported failure, and git ls-remote failed too, so whether main has it is unknown. If main contains $sha, run: gh workflow run deploy.yml --ref main. If not, re-run this workflow."
  fi
  if [[ ${remote%%[[:space:]]*} != "$sha" ]]; then
    fail "push of $sha to main failed and main's head is not $sha. Most likely the push was rejected because main moved during the run; rarely, it landed and another push landed on top. Re-run this workflow; it checks out the new main. If the re-run reports unchanged, main already has the data: run gh workflow run deploy.yml --ref main if no deploy has run since."
  fi
  echo "push of $sha reported failure, but main has it; dispatching the deploy."
fi
echo "pushed $sha to main."

# 6. Dispatch the deploy. A push made with the workflow's GITHUB_TOKEN creates
# no workflow runs, so deploy.yml's `_data/**` push filter never fires for the
# commit above: without this step the run goes green and the site never
# updates. workflow_dispatch is one of the two events that token is allowed to
# trigger, which keeps this PAT-free. Do not "simplify" this into relying on
# the path filter, and do not replace the token with a PAT (#54, #72,
# CLAUDE.md "Deploy"). This run does not wait for the deploy, and a failed
# deploy dispatched by github-actions may notify nobody; the next push-triggered
# deploy (normally the daily ESG feed) rebuilds main either way.
deploys="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-frederick-douglas-pearce/frederick-douglas-pearce.github.io}/actions/workflows/deploy.yml"
for delay in 10 30 ""; do
  if gh workflow run deploy.yml --ref main; then
    echo "dispatched deploy.yml for $sha; its result is not watched here: $deploys"
    summary "Pushed $sha and dispatched deploy.yml. This run does not watch the deploy; check it at $deploys"
    exit 0
  fi
  if [[ -n $delay ]]; then sleep "$delay"; fi
done
fail "pushed $sha to main, but dispatching deploy.yml failed 3 times. Run: gh workflow run deploy.yml --ref main. Re-running this workflow will NOT deploy it, because main already has the commit. The next push-triggered deploy (normally the daily ESG feed) ships it anyway."
