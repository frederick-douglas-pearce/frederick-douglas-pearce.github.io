#!/usr/bin/env bash
#
# The redeploy job's fallback, run by .github/workflows/deploy.yml (#131) after
# its deploy job failed for STUCK_SHA. It gives the same content a new
# deployment identity (an empty commit on top of STUCK_SHA) and dispatches
# deploy.yml with fallback=true. It pushes to main, so it refuses to run
# outside Actions.
#
#   STUCK_SHA=<sha> bin/pages-redeploy.sh   (from the workflow; needs GITHUB_ACTIONS=true)
#
# Why a new commit: actions/deploy-pages names a Pages deployment after
# GITHUB_SHA. Once one hangs and the action cancels it, every retry, rerun or
# dispatch at that commit gets the same deployment back. On 2026-11-05 run
# 42050610219 and its rerun 3.5 h later both hung or read back the cancel, and
# only a new commit (c3c97b8) deployed, in seconds. A new commit also means a
# new build and a new artifact, which matters because which of the two was the
# trigger is unknown.
#
# Steps:
#   1. Commit an empty commit whose parent is STUCK_SHA (the checkout).
#   2. Push it to main without force. Git accepts that only as a fast-forward,
#      so the push succeeds only if main is still STUCK_SHA. That is the race
#      check, and it is atomic. If main has moved (an ESG push, a post sync),
#      its head already has a new identity, so the commit is dropped.
#   3. Dispatch deploy.yml with fallback=true whatever step 2 did. A newer head
#      on main is not guaranteed a deploy of its own (deploy.yml's paths filter
#      skips some commits, and an Actions push triggers nothing), so skipping
#      here could leave the site stale. A redundant deploy is harmless.
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

fail() {
  echo "::error::$(esc "$1")"
  summary "**Failed:** $1"
  exit 1
}

if [[ "${GITHUB_ACTIONS:-}" != "true" ]]; then
  echo "bin/pages-redeploy.sh pushes to main and is meant for the redeploy job in .github/workflows/deploy.yml." >&2
  echo "To recover by hand: git commit --allow-empty on top of origin/main, push it to main, then gh workflow run deploy.yml --ref main." >&2
  exit 2
fi

stuck=${STUCK_SHA:?STUCK_SHA must be the commit whose deploy failed}
short=${stuck:0:7}
manual="To recover by hand: branch off origin/main, git commit --allow-empty, git push origin HEAD:main, then gh workflow run deploy.yml --ref main (an empty commit does not match deploy.yml's paths filter, so the dispatch is needed)."
deploys="${GITHUB_SERVER_URL:-https://github.com}/${GITHUB_REPOSITORY:-frederick-douglas-pearce/frederick-douglas-pearce.github.io}/actions/workflows/deploy.yml"

head=$(git rev-parse HEAD)
if [[ $head != "$stuck" ]]; then
  fail "checkout is at $head, not the failed deploy's commit $stuck, so the empty commit would not be a fast-forward from it. This is a bug in the redeploy job's checkout. $manual"
fi

# 1. Empty commit on top of the stuck one.
git config user.name "github-actions"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit --quiet --allow-empty -m "chore: redeploy $short after stuck Pages deployment [fallback]" \
  -m "The deploy of $stuck failed in a way a same-commit retry cannot fix, so this empty commit gives the same content a new Pages deployment. Pushed by the redeploy job in .github/workflows/deploy.yml (#131)."
sha=$(git rev-parse HEAD)

# 2. Push, never forcing.
push_rc=0
push_head_to_main || push_rc=$?
case $push_rc in
  0)
    echo "pushed $sha (empty, on top of $short) to main."
    what="Pushed empty commit $sha on top of $short"
    ;;
  2)
    echo "main is no longer $short (the push was not a fast-forward), so the empty commit is dropped and main's head is deployed instead."
    what="main had moved past $short, so no commit was pushed"
    ;;
  *)
    echo "::warning::$(esc "push of $sha reported failure and git ls-remote failed too, so whether main has it is unknown. Dispatching anyway: if main is still $short, the dispatched deploy may hang the same way and will fail red.")"
    what="Push of $sha had an unknown result"
    ;;
esac

# 3. Dispatch, always.
if dispatch_deploy -f fallback=true; then
  echo "dispatched deploy.yml (fallback=true); its result is not watched here: $deploys"
  summary "$what, and dispatched deploy.yml with fallback=true to redeploy main. This job does not watch that run; check it at $deploys. If it fails too, the site is still on an older build. $manual"
  exit 0
fi
fail "$what, but dispatching deploy.yml failed 3 times, so nothing will redeploy the site. $manual"
