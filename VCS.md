# Version Control Workflow

This repo is a **colocated [Jujutsu](https://jj-vcs.github.io/jj/) + git** repository
(jj 0.43): `jj` is the primary interface and a real `.git/` directory sits alongside
`.jj/`. Plain `git` commands still work for **reading** (`log`/`status`/`diff`), but a hook
(`.claude/hooks/enforce-jj.sh`) blocks mutating git — every VCS change goes through jj.
The remote `origin` is `mp-pinheiro/decktube` on GitHub and is the source of truth.

**The jj mindset.** `@` (the working copy) is snapshotted continuously; commit early and
often with `jj commit`, because commits are local, cheap, and fully reversible. Every commit
and every operation is a point you can travel back to (`jj op log`, `jj undo`). Never hoard
finished work in an uncommitted `@` — a step you didn't commit is a restore point you don't
have. Committing is free and local; **pushing** (`jj git push`) is the only step that seals
anything to `origin`.

> Git's `HEAD` is left **detached** on purpose — jj drives the working copy, so there is
> no checked-out git branch. Don't `git push`; use `jj git push`.

## Model: trunk-based on `main`

- `main` is a **bookmark** (jj's word for a branch), not a moving `HEAD`. It is configured
  to **auto-advance** on `jj commit` / `jj new` (repo-scoped
  `experimental-advance-branches`, already applied), so it tracks your latest finished
  change with no manual step.
- Work lands directly on `main`. Use a feature bookmark only when you want a PR/review.
- Keep `origin` in sync: push after finishing a change.

User-level config (`~/.config/jj/config.toml`) already carries the shared pieces:
`immutable_heads()` includes `remote_bookmarks()` (pushed history is protected) and
`jj tug` = `jj bookmark advance --to @-` (for feature bookmarks; trunk needs no tug).

## The change cycle

jj has no staging area — edits are snapshotted continuously into the working-copy commit
`@`. A fresh empty `@` with "no description set" is normal; it is where your next edits go.

**Commit each finished step as you go** — not once at the end. Every `jj commit` is a
labelled restore point, and `main` auto-advances onto it. The loop per logical step:

```
# edit files for one logical step — `jj status` / `jj diff` show what's in @
jj commit -m "type: subject"      # finalize this step; main auto-advances to it
```

Commit messages follow the repo's conventional style: `fix:`/`feat:`/`chore:`/`refactor:`
prefix, lowercase imperative subject, one line, ≤50 chars, no body. Version-bump commits
are the bare version (`0.17.1`) and come from `make bump`, not by hand.

Commit one coherent unit at a time; use path-scoped `jj commit <files> -m "…"` to split
unrelated changes sitting together in `@`. When the work is ready to leave your machine:

```
jj git push                       # push main to origin
```

If `jj git push` ever says **"Nothing changed"**, `main` didn't move — advance it by hand
with `jj tug` and re-push. That should only happen for feature bookmarks.

**Commit locally without asking; get sign-off before you push.** Local `jj commit`s are
reversible and never leave your machine. `jj git push` is the seal.

The `/commit` skill is optional ceremony on top of this: reach for it when you want the
message styled against history. Routine trunk work is plain `jj commit -m` in the loop.

## Navigating through time (jj's core power)

| To … | Do |
|------|----|
| See every operation (incl. auto-snapshots), newest first | `jj op log` |
| Undo the last operation (bad edit / commit / rebase / restore) | `jj undo` |
| Rewind the **whole repo** to a past operation | `jj op restore <op-id>` |
| Inspect the commit graph | `jj log` |
| Go amend an earlier commit in place | `jj edit <rev>` |
| Start a new change on top of any commit | `jj new <rev>` |
| Pull specific files from another revision into `@` | `jj restore --from <rev> [paths]` |
| Drop `@`'s uncommitted edits (reset to parent) | `jj restore` |
| Discard a whole commit | `jj abandon <rev>` |
| Diff any two points | `jj diff --from <rev> --to <rev>` |

`jj op log` + `jj op restore` is the safety net — provided the good state was committed.

## Sending a PR instead of committing to main

```
# auto-named bookmark (jj invents e.g. push-xyz):
jj git push -c @-              # -c/--change; pushes the described change's parent
gh pr create --head push-xyz

# or a named bookmark:
jj bookmark set my-feature -r @-
jj git push --bookmark my-feature
```

Address review comments by adding a commit on top, then `jj tug` (or
`jj bookmark set my-feature -r @-`) and `jj git push` again. Feature bookmarks are
deliberately excluded from auto-advance.

## Releases

Releases are driven by the Makefile, which is jj-native:

```
make bump            # patch (default): npm version --no-git-tag-version,
                     #   jj commit of package.json+lock (subject = bare version),
                     #   git tag vX.Y.Z on that commit, electron build
make bump minor      # or major
make release         # bump + jj git push + git push origin --tags
```

`npm version` no longer touches git (`--no-git-tag-version`); the version commit goes
through jj (so `main` auto-advances) and the annotated tag `vX.Y.Z` is created with plain
`git tag` on the exact `@-` commit — the documented git exception, along with
`git push origin --tags`.

## Updating from origin (there is no `git pull`)

```
jj git fetch
jj rebase -d main             # move your in-progress work onto the updated main
```

## One-time / gotchas

- If jj reports a non-tracking `main@origin`, run once: `jj bookmark track main --remote=origin`.
- `jj undo` reverts the last jj operation — the safety net for a botched move or rebase.
- `.jj/` is excluded via its own `.jj/.gitignore` plus `.git/info/exclude`.
- `experimental-advance-branches` is enabled repo-scoped for `main` only (solo, linear
  trunk). Feature bookmarks advance only via explicit `jj tug`.

## Cheat sheet

| Task | Command |
|------|---------|
| Working-copy status | `jj status` |
| History (graph) | `jj log` |
| Finalize a change | `jj commit -m "…"` |
| Advance trunk to your change | automatic on commit (else `jj tug`) |
| Push trunk | `jj git push` |
| Push a PR branch | `jj git push -c @-` |
| Fetch from remote | `jj git fetch` |
| Undo last jj op | `jj undo` |
| Operation log (time-travel) | `jj op log` |
| Rewind repo to a past op | `jj op restore <op-id>` |
| Amend an earlier commit | `jj edit <rev>` |
| Cut a release | `make release` |
