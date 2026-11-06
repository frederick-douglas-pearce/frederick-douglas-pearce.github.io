#!/usr/bin/env bash
#
# The redeploy job's fallback, run by .github/workflows/deploy.yml (#131) after
# its deploy job failed for STUCK_SHA on main, for any reason: usually three
# failed attempts at that commit and a not-landed stamp check, but also a
# setup, OIDC or runner failure (see the redeploy job's comment in
# deploy.yml). It gives the same content a new deployment
# identity (an empty commit on top of STUCK_SHA), dispatches deploy.yml with
# fallback=true, and opens a deploy-fallback issue that @-mentions the owner.
# It pushes to main, so it refuses to run outside Actions or off main.
#
#   STUCK_SHA=<sha> bin/pages-redeploy.sh   (from the workflow; needs GITHUB_ACTIONS=true, GITHUB_REF=refs/heads/main)
#
# Why a new commit: actions/deploy-pages names a Pages deployment after
# GITHUB_SHA, and a same-commit retry can keep getting a canceled deployment
# back. On 2026-11-05, run 42050610219's three attempts and its rerun 3.5 h
# later all hung or read back the cancel, and only a new commit (c3c97b8)
# deployed, in seconds. A new commit also means a new build and a new artifact,
# which matters because which of the two was the trigger is unknown.
#
# Steps:
#   1. Commit an empty commit whose parent is STUCK_SHA (the checkout).
#   2. Push it to main without force. Git accepts that only as a fast-forward,
#      so it lands only if main is still STUCK_SHA: the race check, and it is
#      atomic. If main has moved (an ESG push, a post sync), main's head is
#      already a new identity, so the commit is dropped. If the push was
#      rejected while main is still STUCK_SHA (permissions, a ruleset), a
#      dispatch would only redeploy the stuck commit, so this fails instead.
#   3. Dispatch deploy.yml with fallback=true. When main moved, dispatch anyway:
#      a newer head is not guaranteed a deploy of its own (deploy.yml's paths
#      filter skips some commits, and an Actions push triggers nothing), and a
#      redundant deploy is harmless.
#   4. Open a deploy-fallback issue on every path this script itself handles
#      past the two entry guards (outside Actions, off main): success, or a
#      fail() verdict. An unexpected failure (a failed checkout step, an
#      unexpected git error, an unbound variable, the job's 5-min timeout)
#      opens none, and the red run is the only signal. Otherwise the owner is
#      emailed and the history shows how often this happens. The
#      dispatched run's report job comments its result there and closes it on
#      success.
#
# The dispatched run's redeploy job is skipped (fallback=true), so a hang that
# survives the new identity fails red once and does not loop.

set -euo pipefail

# shellcheck source=bin/push-dispatch.sh
source "$(dirname "$0")/push-dispatch.sh"

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

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "bin/pages-redeploy.sh pushes to main and is meant for the redeploy job in .github/workflows/deploy.yml." >&2
  echo "To recover by hand: git commit --allow-empty on top of origin/main, push it to main, then gh workflow run deploy.yml --ref main." >&2
  exit 2
fi

stuck=${STUCK_SHA:?STUCK_SHA must be the commit whose deploy failed}
short=${stuck:0:7}
server=${GITHUB_SERVER_URL:-https://github.com}
repo=${GITHUB_REPOSITORY:-frederick-douglas-pearce/frederick-douglas-pearce.github.io}
owner=${GITHUB_REPOSITORY_OWNER:-${repo%%/*}}
failed_run="$server/$repo/actions/runs/${GITHUB_RUN_ID:-unknown}"
deploys="$server/$repo/actions/workflows/deploy.yml"
manual="To recover by hand: branch off origin/main, git commit --allow-empty, git push origin HEAD:main, then gh workflow run deploy.yml --ref main (an empty commit does not match deploy.yml's paths filter, so the dispatch is needed). Rerunning the failed run does not help."

# notify <outcome line>: open the deploy-fallback issue. A failure here is a
# warning, not a failed job: the redeploy itself already happened or failed,
# and the deploy run is red either way.
notify() {
  local body
  body="@$owner the deploy job for \`$stuck\` failed (every attempt at that commit and the landed check, or a setup, OIDC or runner failure; the failed run shows which step), so the redeploy fallback ran (#131).

- Failed run: $failed_run
- What redeploy did: $1
- Deploy runs: $deploys

The fallback deploy's report job comments its result here and closes this issue if it succeeds. If nothing follows within ~30 min, check the deploy runs above. $manual"
  if ! gh issue create --label deploy-fallback --title "Pages deploy fallback ran for $short" --body "$body"; then
    echo "::warning::$(esc "could not open the deploy-fallback issue; the owner was not notified. $1")"
  fi
}

# fail <verdict>: annotate, summarize, notify, exit 1.
fail() {
  echo "::error::$(esc "$1")"
  summary "**Failed:** $1"
  notify "**failed:** $1"
  exit 1
}

if [[ "${GITHUB_REF:-}" != "refs/heads/main" ]]; then
  echo "::error::$(esc "bin/pages-redeploy.sh runs only for a deploy of main (GITHUB_REF is '${GITHUB_REF:-}'); pushing a branch's commit to main would publish unreviewed work. Nothing was pushed.")"
  exit 1
fi

head=$(git rev-parse HEAD)
if [[ $head != "$stuck" ]]; then
  fail "checkout is at $head, not the failed deploy's commit $stuck, so the empty commit would not be a fast-forward from it. This is a bug in the redeploy job's checkout. $manual"
fi

# 1. Empty commit on top of the stuck one.
git config user.name "github-actions"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit --quiet --allow-empty -m "chore: redeploy $short after stuck Pages deployment [fallback]" \
  -m "The deploy job for $stuck failed, so this empty commit gives the same content a new Pages deployment. Pushed by the redeploy job in .github/workflows/deploy.yml (#131)."
sha=$(git rev-parse HEAD)

# 2. Push, never forcing.
push_rc=0
push_head_to_main || push_rc=$?
case $push_rc in
  0)
    echo "pushed $sha (empty, on top of $short) to main."
    what="pushed empty commit \`$sha\` on top of \`$short\`"
    ;;
  2)
    if [[ $PUSH_REMOTE_HEAD == "$stuck" ]]; then
      fail "push of $sha to main was rejected, but main is still $short, so main did not move: the push failed for another reason (permissions, a ruleset, a server error). Dispatching now would only redeploy the stuck commit, so nothing was dispatched. $manual"
    fi
    echo "main is at ${PUSH_REMOTE_HEAD:0:7}, no longer $short, so the empty commit was not a fast-forward and is dropped; main's head is deployed instead."
    what="main had moved to \`${PUSH_REMOTE_HEAD:0:7}\`, so no commit was pushed and main's head was dispatched"
    ;;
  *)
    echo "::warning::$(esc "push of $sha reported failure and git ls-remote failed too, so whether main has it is unknown. Dispatching anyway: if main is still $short, the dispatched deploy may hang the same way and will fail red.")"
    what="push of \`$sha\` had an unknown result (git ls-remote failed too); dispatched anyway"
    ;;
esac

# 3. Dispatch.
if ! dispatch_deploy -f fallback=true; then
  fail "$what, but dispatching deploy.yml failed 3 times, so nothing will redeploy the site. $manual"
fi
echo "dispatched deploy.yml (fallback=true); its result is not watched here: $deploys"
summary "Redeploy: $what, and dispatched deploy.yml with fallback=true. This job does not watch that run; its report job comments on the deploy-fallback issue. $deploys"

# 4. Notify.
notify "$what, and dispatched deploy.yml with fallback=true."
