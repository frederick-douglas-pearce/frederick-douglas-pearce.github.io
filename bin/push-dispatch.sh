# shellcheck shell=bash
#
# Shared "commit to main, then dispatch the deploy" steps for workflows that
# commit from Actions. Source it; do not run it:
#
#   source bin/push-dispatch.sh
#   push_head_to_main      # returns 0, 2 or 3 (below)
#   dispatch_deploy [-f key=value ...]
#
# Callers: bin/repo-stats-refresh.sh (#59) and bin/pages-redeploy.sh (#131).
# These steps were lifted out of the first one when the second needed them,
# as its header asked. Each caller keeps its own failure messages, because
# what a human should do next differs: the two functions report what happened
# through their exit status (plus one log line from push_head_to_main when the
# remote took a push the client reported as failed) and never exit the caller.
#
# Needs git with an `origin` remote, gh authenticated through GH_TOKEN, and
# `actions: write` for the dispatch.

# push_head_to_main: push HEAD to main, never forcing, never rebasing. Sets
# PUSH_REMOTE_HEAD to main's head as observed after a failed push (empty when
# the push succeeded or ls-remote failed), so a caller can tell why main is not
# HEAD without asking the remote again.
#   0  main has HEAD: the push succeeded, or the client reported failure but
#      the remote took the update anyway (checked, because a caller that read
#      that as "not pushed" would skip the dispatch for a commit main has).
#   2  main's head (PUSH_REMOTE_HEAD) is not HEAD. Either main moved and the
#      push was not a fast-forward, or the push was rejected for another reason
#      (permissions, a ruleset, a server error) and main is where it was, or,
#      rarely, it landed and another push landed on top. Compare
#      PUSH_REMOTE_HEAD with the commit you started from to tell them apart.
#   3  the push reported failure and `git ls-remote` failed too, so whether
#      main has HEAD is unknown.
push_head_to_main() {
  local sha remote
  PUSH_REMOTE_HEAD=""
  sha=$(git rev-parse HEAD)
  if git push origin HEAD:main; then
    return 0
  fi
  if ! remote=$(git ls-remote origin refs/heads/main); then
    return 3
  fi
  PUSH_REMOTE_HEAD=${remote%%[[:space:]]*}
  if [[ $PUSH_REMOTE_HEAD != "$sha" ]]; then
    return 2
  fi
  echo "push of $sha reported failure, but main has it; dispatching the deploy."
  return 0
}

# dispatch_deploy [gh workflow run args...]: dispatch deploy.yml on main, up to
# three tries 10s and 30s apart. Returns 0 once one is accepted, 1 if all three
# fail. Extra arguments go to `gh workflow run` unchanged (e.g. -f fallback=true).
#
# Why the dispatch is explicit at all: a push made with the workflow's
# GITHUB_TOKEN creates no workflow runs, so deploy.yml's push trigger never
# fires for a commit an Actions job pushed. workflow_dispatch is one of the two
# events that token may trigger, which keeps this PAT-free. Do not "simplify"
# this into relying on the path filter, and do not replace the token with a PAT
# (#54, #72, CLAUDE.md "Deploy").
dispatch_deploy() {
  local delay
  for delay in 10 30 ""; do
    if gh workflow run deploy.yml --ref main "$@"; then
      return 0
    fi
    if [[ -n $delay ]]; then sleep "$delay"; fi
  done
  return 1
}
