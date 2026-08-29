---
name: resolving-merge-conflicts
description: Resolve conflicts in an in-progress Git merge or rebase. Use when the worktree contains unmerged paths or the user asks to complete a conflicted merge or rebase. Do not use for ordinary branch synchronization.
---

# Resolve merge conflicts

Resolve conflicts from the intent of both changes. Preserve unrelated work and
avoid inventing behavior that neither side requested.

## Establish the operation

Inspect the Git status, the current branch, the merge or rebase state, the
conflicting files, and the relevant commits. For each conflict, trace both
sides to their source commit, pull request, issue, test, or documentation.

## Resolve by intent

For each conflicted hunk:

1. State the behavior each side intended.
2. Preserve both behaviors when they are compatible.
3. When they conflict, choose the behavior required by the operation's stated
   goal and record the trade-off.
4. Remove every conflict marker and inspect the surrounding code for duplicate
   or missing behavior.
5. Stage only files whose conflicts are resolved.

Do not abort the operation, rewrite unrelated history, or discard either side
without the user's authorization.

## Verify and finish

Run the focused checks for the resolved behavior, then use `verify-change` for
the complete diff. If the request includes completing the operation, continue
the merge or rebase until Git reports no remaining conflict. Otherwise, leave
the resolved state ready for the contributor and report the exact next command.
