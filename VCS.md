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

## Releases: auto semver + auto changelog

Releases are **derived from conventional commits** by [git-cliff](https://git-cliff.org)
(`cliff.toml`), driven by the Makefile. git-cliff is read-only over git history — and jj
commits *are* real git commits — so it computes the next semver and regenerates
`CHANGELOG.md` without touching jj; the version commit then goes through jj and the tag
through git (colocated), exactly as the hook allows.

- `make next` prints the next version (feat bumps minor, fix/chore bump patch,
  breaking bumps minor pre-1.0 — rules in `cliff.toml` `[bump]`).
- `make preview` prints the pending release's changelog section.
- `make bump` runs the release mechanics without publishing: web build, version from
  git-cliff written by `npm version --no-git-tag-version` (or force a level with
  `make bump major|minor|patch`), `CHANGELOG.md` regenerated, jj commit of
  package.json + lockfile + changelog (subject = bare version, e.g. `0.17.2`),
  annotated tag `vX.Y.Z` on that exact `@-` commit, electron build.
- `make release` **publishes**: bump, then `jj git push` and `git push origin --tags`
  (the documented git exceptions). The tag push triggers `.github/workflows/build.yml`,
  which builds and publishes the AppImage to GitHub Releases for the autoupdater.

Preview with `make next` / `make preview` first; choosing to run `make release` is itself
the sign-off. `CHANGELOG.md` is generated — never edit it by hand (that includes the
`/commit` skill's changelog phase: skip it here); `make bump` rewrites the whole file
from history. Flip `breaking_always_bump_major` to `true` in `cliff.toml` when you cut 1.0.

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
| Next version (auto semver) | `make next` |
| Preview pending changelog | `make preview` |
| Cut a release | `make release` |
