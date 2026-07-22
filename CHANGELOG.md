# Changelog

All notable changes to DeckTube. Generated from conventional commits by
[git-cliff](https://git-cliff.org) — do not edit by hand; `make bump` regenerates it.
DeckTube follows [Semantic Versioning](https://semver.org).


## [0.17.2] - 2026-07-22

### Chores

- Adopt colocated jj workflow
- Auto semver and changelog via git-cliff

## [0.17.1] - 2026-07-22

### Bug Fixes

- Hide started videos from home feeds

## [0.17.0] - 2026-07-22

### Bug Fixes

- Demote trending clips in home recs

## [0.16.3] - 2026-07-22

### Bug Fixes

- Home recs sync, diversity, first-click stall

## [0.16.2] - 2026-07-01

### Bug Fixes

- Reload player on stream error (#48)

### Features

- Like/dislike feedback + smarter recs (#50)
- Show cursor on mouse move, hide when idle

### Refactoring

- Centralize video-card actions (#49)

## [0.16.1] - 2026-06-24

### Bug Fixes

- Anchor home recs to topical related videos

## [0.16.0] - 2026-06-24

### Bug Fixes

- Don't skip filler segments

## [0.15.7] - 2026-06-24

### Bug Fixes

- Sort channel videos newest first
- Read 8bitdo triggers as buttons too

### Features

- Add home tab with history recommendations

## [0.15.6] - 2026-06-05

### Bug Fixes

- Select original audio track instead of locale-default dub
- Parse new YouTube search result format

### Chores

- Trim verbose audio-track comment

### Documentation

- Drop jj from CLAUDE.md

### Features

- Raw controller support with overlay gating
- Improve virtual keyboard navigation

## [0.15.5] - 2026-04-28

### Features

- Sort subscriptions feed by publish time

## [0.15.4] - 2026-04-28

### Bug Fixes

- Filter Shorts shelves and add signal-based gates
- Retry dash.js init on transient segment failures

### Documentation

- Refresh README with current features and controls

### Features

- Route media keys globally via globalShortcut

## [0.15.3] - 2026-04-28

### Bug Fixes

- Preflight check before quitAndInstall to protect AppImage

## [0.15.2] - 2026-04-27

### Bug Fixes

- Let media keys bypass input lock

### Chores

- Tighten media-key bypass comment

## [0.15.1] - 2026-04-19

### Bug Fixes

- Input lock overlay in fullscreen and LB+RB race

## [0.15.0] - 2026-04-18

### Chores

- Fix all ESLint errors across codebase
- Clean up unnecessary comments and unify lock hold duration

### Features

- Settings modal, input lock, and exit app
- Keyboard input lock and lock/unlock animations

## [0.14.6] - 2026-04-16

### Bug Fixes

- Revert OAuth scope to auth/youtube to restore sign-in

## [0.14.5] - 2026-04-16

### Bug Fixes

- Request youtube-paid-content scope and force re-auth on insufficient scopes
- Match official TVHTML5 scope set and guard against re-auth loop

### Chores

- Update packages

## [0.14.3] - 2026-04-04

### Bug Fixes

- Gamepad recovery stability, re-arm delay, raw hardware fallback
- Video stall recovery, MediaSession safety, proxy timeout

## [0.14.2] - 2026-03-28

### Bug Fixes

- Deduplicate gamepad button events across multiple devices
- Xbox BT recovery, Steam-only filter, gamepad cleanup

### Features

- Xbox cold-launch support and Steam overlay suppression

## [0.14.1] - 2026-03-26

### Features

- Add MediaSession API for BT headset controls

## [0.14.0] - 2026-03-26

### Bug Fixes

- Seek tap acceleration and backward sponsor skip
- Extract seek tiers into configurable array
- Align action ref types with isRepeat signature

### Features

- Add SponsorBlock integration

## [0.13.6] - 2026-03-26

### Bug Fixes

- Filter Shorts, prefetch pagination, gamepad startup, logo refresh

### Chores

- Trim verbose comments in gamepad and youtube

## [0.13.4] - 2026-03-25

### Bug Fixes

- Restore VID filter, remove preferSteam flag that broke overlay suppression

## [0.13.3] - 2026-03-24

### Bug Fixes

- Gamepad D-Pad hold repeat and Xbox launch detection

## [0.13.2] - 2026-03-24

### Bug Fixes

- Use plain UID as Firestore doc ID, remove hashing

## [0.13.1] - 2026-03-24

### Bug Fixes

- Pass Firebase env vars to CI build

## [0.13.0] - 2026-03-24

### Features

- Add mark as watched with feed filtering and Firestore sync
- Progressive seek speed on key hold

## [0.12.8] - 2026-03-24

### Features

- Cache home feed across navigation, skip re-fetch on back

## [0.12.7] - 2026-03-24

### Bug Fixes

- Hash uid, add listener retry, offline queue, one-shot initSync

### Features

- Persist volume and quality preferences across sessions
- Preserve home navigation state on back navigation

## [0.12.6] - 2026-03-24

### Bug Fixes

- Filter gamepads by Steam vendor ID to prevent overlay input leak
- Filter gamepads by Steam vendor ID to prevent overlay input leak

### Features

- Add file logging and make logs command for Steam Deck debugging
- Suppress gamepad input on Electron window blur via IPC
- Add gamepad recovery via app restart and controller toast notifications

## [0.12.5] - 2026-03-23

### Bug Fixes

- Fix sync merge to respect deletions and switch to full Firestore SDK

### Features

- Add real-time Firestore sync via onSnapshot listener

## [0.12.4] - 2026-03-23

### Bug Fixes

- Fix Firestore cross-device sync auth expiry and blind overwrites

## [0.12.3] - 2026-03-23

### Bug Fixes

- Use setDoc with merge to fix silent Firestore write failures

## [0.12.2] - 2026-03-23

### Bug Fixes

- Add sync cooldown and stabilize visibilitychange listener

## [0.12.1] - 2026-03-23

### Bug Fixes

- Re-sync Firestore on visibility change and refresh UI after merge

## [0.12.0] - 2026-03-23

### Features

- Sync watch history and playback positions via Firestore

## [0.11.1] - 2026-03-23

### Bug Fixes

- Remove appFocused gating that breaks all input on Steam Deck

## [0.11.0] - 2026-03-23

### Features

- Auto-play next video on playback end with countdown

## [0.10.7] - 2026-03-23

### Bug Fixes

- Increase video card font sizes for Steam Deck readability
- Use aspect-ratio thumbnails with flexible text layout
- Block keyboard input when app loses focus

### Chores

- Remove gemini artifact and duplicate type declaration

### Features

- Show git commit hash as version in dev mode
- Track watch history on youtube backend

## [0.10.6] - 2026-03-20

### Bug Fixes

- History duplicates and missing duration badges

### Chores

- Switch releases from prerelease to release

## [0.10.5] - 2026-03-20

### Bug Fixes

- Filter live streams, mixes, and upcoming from all feeds

## [0.10.4] - 2026-03-20

### Features

- Use PagedVideoGrid on search page with continuation support

## [0.10.3] - 2026-03-20

### Bug Fixes

- Enforce consistent video card height with min-h on title
- Optimize UI for Steam Deck 1280x800 and fix gamepad capture when unfocused
- Dynamic video card sizing for all resolutions
- Remove browser focus listeners that override Electron IPC gamepad gate
- Surface updater errors with manual download fallback

## [0.10.2] - 2026-03-19

### Features

- Extract publishedTimeText from browse renderers

## [0.10.1] - 2026-03-19

### Bug Fixes

- Prevent crashes during auto-update install flow

### Chores

- Use prerelease channel and clean up type declarations

### Features

- Add in-app auto-updater with controller-friendly banner

### Refactoring

- Redesign update banner as modal with input layer

## [0.10.0] - 2026-03-19

### Chores

- Add jpg covers and fix art deploy pipeline

### Features

- Add mode menu for history management

### Refactoring

- Unify input handling with intent-based layer system

## [0.9.0] - 2026-03-19

### Bug Fixes

- Use fixed aspect-ratio thumbnails in video grid

### Features

- Show video duration on browse pages
- Show watch progress bar on video cards

## [0.8.0] - 2026-03-19

### Bug Fixes

- Guard Space repeat and tie play overlay to promise resolve
- Make home link focusable with keyboard/spatial nav
- Exclude tabindex=-1 buttons from focus bootstrap
- Record history on card click and use link.click() for select action

### Chores

- Add app icon to build and update favicon
- Add jpg hero art for steam compatibility
- Regenerate steam assets

### Features

- Modularize browse pages and add home tabs
- Wire subscriptions and history tabs on home page
- Make Enter/A toggle play/pause on watch page

## [0.7.0] - 2026-03-19

### Bug Fixes

- Replace infinite scroll with 3x2 page grid on home
- Prevent virtual keyboard reopen when leaving search on Steam Deck

### Chores

- Update lockfile

### Features

- Replace native search input with in-app virtual keyboard

## [0.6.5] - 2026-03-18

### Bug Fixes

- Fall back to progressive stream for long videos without DASH byte ranges

### Chores

- Update lockfile

## [0.6.4] - 2026-03-18

### Bug Fixes

- Clear button states on refocus to prevent phantom presses

## [0.6.3] - 2026-03-18

### Bug Fixes

- Extract channelId from lockupViewModel subtitle runs
- Remove redundant back button from watch page
- Skip gamepad input when app loses focus

### Features

- Persist playback position and resume on return

## [0.6.2] - 2026-03-17

### Bug Fixes

- Resolve TS errors in overlay components for strict React types
- Inline back and help buttons in watch page metadata row
- Align channel and search page card styles with home

### Chores

- Gate bump on build success, wire release through bump
- Split bump into web build, version, then electron build

## [0.6.1] - 2026-03-17

### Features

- Show quality indicator while paused and on change

## [0.6.0] - 2026-03-17

### Bug Fixes

- Call bootstrapNavFocus after blur to prevent Steam keyboard re-open
- Replace IFrame API with dash.js player using IOS client
- Add mediaPresentationDuration to generated MPD
- Filter dubbed audio tracks from IOS player response
- Restructure watch page layout for Steam Deck viewport
- Use rep ID and forceReplace for quality switches

### Chores

- Add make release target for patch + push + tags
- Remove dead code and unnecessary comments
- Support bump type arg in bump and release targets

### Documentation

- Update CLAUDE.md for dash.js player and IOS client

### Features

- Add player overlay UI with auto-fading indicators
- Show seek bar and volume indicator while paused

## [0.5.17] - 2026-03-17

### Bug Fixes

- Ignore key repeats on Enter/Escape to prevent double navigation
- Deploy target picks latest AppImage when multiple exist
- Add 300ms cooldown to gamepad A/B to prevent double-fire on navigation

### Chores

- Add make deploy target for AppImage SCP to Deck

## [0.5.16] - 2026-03-17

### Bug Fixes

- PreventDefault before dedup guard to stop Enter/Escape page reloads

## [0.5.15] - 2026-03-17

### Bug Fixes

- Register select action for gamepad A button navigation

## [0.5.14] - 2026-03-17

### Bug Fixes

- Gamepad A/B buttons causing page reload on home page

## [0.5.13] - 2026-03-17

### Bug Fixes

- Login persistence and video navigation bugs
- Watch page double focus indicator and escape navigation

## [0.5.12] - 2026-03-16

### Chores

- Remove non-electron deployment artifacts
- Rename to decktube and add Makefile
- Update steam assets

## [0.5.11] - 2026-03-16

### Bug Fixes

- Unset Steam LD_PRELOAD/LD_LIBRARY_PATH to fix launch from Gaming Mode

## [0.5.10] - 2026-03-16

### Bug Fixes

- Use executableName for correct Linux binary casing

## [0.5.9] - 2026-03-16

### Bug Fixes

- Wrap binary in launch script to bake in --no-sandbox

## [0.5.8] - 2026-03-16

### Bug Fixes

- Disable hardware acceleration to avoid GPU crash in gamescope
- Use native Wayland instead of XWayland for gamescope

## [0.5.7] - 2026-03-16

### Bug Fixes

- Append no-sandbox for Steam launch compatibility

## [0.5.6] - 2026-03-16

### Bug Fixes

- Disable asar to fix ESM url scheme crash on launch

## [0.5.5] - 2026-03-16

### Bug Fixes

- Lazy-load electron-updater to avoid ESM crash

## [0.5.4] - 2026-03-16

### Features

- Auto-update via electron-updater

## [0.5.3] - 2026-03-16

### Bug Fixes

- Publish releases as non-draft

## [0.5.2] - 2026-03-16

### Bug Fixes

- Unignore src/hooks directory
- Override serialize-javascript to patch audit vulns
- Fullscreen targets video container not pwa
- Poll all gamepad slots to support steam deck controller index
- Add visible focus rings for controller navigation
- Bootstrap focus for gamepad navigation
- Use data attribute for gamepad focus indicator
- Proactive focus bootstrap via MutationObserver
- Force immediate SW activation on update
- Navigate from data-nav-focus when body is active
- Use standalone display mode and exit fullscreen on unmount
- Cache and stupid comments
- Pass GH_TOKEN for electron-builder release

### Chores

- Add steam deck non-steam game assets
- Update lock
- Bump version to v0.3
- Bump version to v0.4
- Bump version to v0.5

### Documentation

- Add README
- Update readme and remove sw cache logic

### Features

- First commit
- Docker support
- Pwa support
- Cloudflare pages deploy
- Caddy tls termination
- Migrate cloudflare pages to workers
- Replace button bar with help modal
- Add version label next to sign out button
- Version from package.json, add release workflow

[0.17.2]: https://github.com/mp-pinheiro/decktube/compare/v0.17.1..v0.17.2
[0.17.1]: https://github.com/mp-pinheiro/decktube/compare/v0.17.0..v0.17.1
[0.17.0]: https://github.com/mp-pinheiro/decktube/compare/v0.16.3..v0.17.0
[0.16.3]: https://github.com/mp-pinheiro/decktube/compare/v0.16.2..v0.16.3
[0.16.2]: https://github.com/mp-pinheiro/decktube/compare/v0.16.1..v0.16.2
[0.16.1]: https://github.com/mp-pinheiro/decktube/compare/v0.16.0..v0.16.1
[0.16.0]: https://github.com/mp-pinheiro/decktube/compare/v0.15.7..v0.16.0
[0.15.7]: https://github.com/mp-pinheiro/decktube/compare/v0.15.6..v0.15.7
[0.15.6]: https://github.com/mp-pinheiro/decktube/compare/v0.15.5..v0.15.6
[0.15.5]: https://github.com/mp-pinheiro/decktube/compare/v0.15.4..v0.15.5
[0.15.4]: https://github.com/mp-pinheiro/decktube/compare/v0.15.3..v0.15.4
[0.15.3]: https://github.com/mp-pinheiro/decktube/compare/v0.15.2..v0.15.3
[0.15.2]: https://github.com/mp-pinheiro/decktube/compare/v0.15.1..v0.15.2
[0.15.1]: https://github.com/mp-pinheiro/decktube/compare/v0.15.0..v0.15.1
[0.15.0]: https://github.com/mp-pinheiro/decktube/compare/v0.14.6..v0.15.0
[0.14.6]: https://github.com/mp-pinheiro/decktube/compare/v0.14.5..v0.14.6
[0.14.5]: https://github.com/mp-pinheiro/decktube/compare/v0.14.3..v0.14.5
[0.14.3]: https://github.com/mp-pinheiro/decktube/compare/v0.14.2..v0.14.3
[0.14.2]: https://github.com/mp-pinheiro/decktube/compare/v0.14.1..v0.14.2
[0.14.1]: https://github.com/mp-pinheiro/decktube/compare/v0.14.0..v0.14.1
[0.14.0]: https://github.com/mp-pinheiro/decktube/compare/v0.13.6..v0.14.0
[0.13.6]: https://github.com/mp-pinheiro/decktube/compare/v0.13.5..v0.13.6
[0.13.4]: https://github.com/mp-pinheiro/decktube/compare/v0.13.3..v0.13.4
[0.13.3]: https://github.com/mp-pinheiro/decktube/compare/v0.13.2..v0.13.3
[0.13.2]: https://github.com/mp-pinheiro/decktube/compare/v0.13.1..v0.13.2
[0.13.1]: https://github.com/mp-pinheiro/decktube/compare/v0.13.0..v0.13.1
[0.13.0]: https://github.com/mp-pinheiro/decktube/compare/v0.12.8..v0.13.0
[0.12.8]: https://github.com/mp-pinheiro/decktube/compare/v0.12.7..v0.12.8
[0.12.7]: https://github.com/mp-pinheiro/decktube/compare/v0.12.6..v0.12.7
[0.12.6]: https://github.com/mp-pinheiro/decktube/compare/v0.12.5..v0.12.6
[0.12.5]: https://github.com/mp-pinheiro/decktube/compare/v0.12.4..v0.12.5
[0.12.4]: https://github.com/mp-pinheiro/decktube/compare/v0.12.3..v0.12.4
[0.12.3]: https://github.com/mp-pinheiro/decktube/compare/v0.12.2..v0.12.3
[0.12.2]: https://github.com/mp-pinheiro/decktube/compare/v0.12.1..v0.12.2
[0.12.1]: https://github.com/mp-pinheiro/decktube/compare/v0.12.0..v0.12.1
[0.12.0]: https://github.com/mp-pinheiro/decktube/compare/v0.11.1..v0.12.0
[0.11.1]: https://github.com/mp-pinheiro/decktube/compare/v0.11.0..v0.11.1
[0.11.0]: https://github.com/mp-pinheiro/decktube/compare/v0.10.7..v0.11.0
[0.10.7]: https://github.com/mp-pinheiro/decktube/compare/v0.10.6..v0.10.7
[0.10.6]: https://github.com/mp-pinheiro/decktube/compare/v0.10.5..v0.10.6
[0.10.5]: https://github.com/mp-pinheiro/decktube/compare/v0.10.4..v0.10.5
[0.10.4]: https://github.com/mp-pinheiro/decktube/compare/v0.10.3..v0.10.4
[0.10.3]: https://github.com/mp-pinheiro/decktube/compare/v0.10.2..v0.10.3
[0.10.2]: https://github.com/mp-pinheiro/decktube/compare/v0.10.1..v0.10.2
[0.10.1]: https://github.com/mp-pinheiro/decktube/compare/v0.10.0..v0.10.1
[0.10.0]: https://github.com/mp-pinheiro/decktube/compare/v0.9.0..v0.10.0
[0.9.0]: https://github.com/mp-pinheiro/decktube/compare/v0.8.0..v0.9.0
[0.8.0]: https://github.com/mp-pinheiro/decktube/compare/v0.7.0..v0.8.0
[0.7.0]: https://github.com/mp-pinheiro/decktube/compare/v0.6.5..v0.7.0
[0.6.5]: https://github.com/mp-pinheiro/decktube/compare/v0.6.4..v0.6.5
[0.6.4]: https://github.com/mp-pinheiro/decktube/compare/v0.6.3..v0.6.4
[0.6.3]: https://github.com/mp-pinheiro/decktube/compare/v0.6.2..v0.6.3
[0.6.2]: https://github.com/mp-pinheiro/decktube/compare/v0.6.1..v0.6.2
[0.6.1]: https://github.com/mp-pinheiro/decktube/compare/v0.6.0..v0.6.1
[0.6.0]: https://github.com/mp-pinheiro/decktube/compare/v0.5.17..v0.6.0
[0.5.17]: https://github.com/mp-pinheiro/decktube/compare/v0.5.16..v0.5.17
[0.5.16]: https://github.com/mp-pinheiro/decktube/compare/v0.5.15..v0.5.16
[0.5.15]: https://github.com/mp-pinheiro/decktube/compare/v0.5.14..v0.5.15
[0.5.14]: https://github.com/mp-pinheiro/decktube/compare/v0.5.13..v0.5.14
[0.5.13]: https://github.com/mp-pinheiro/decktube/compare/v0.5.12..v0.5.13
[0.5.12]: https://github.com/mp-pinheiro/decktube/compare/v0.5.11..v0.5.12
[0.5.11]: https://github.com/mp-pinheiro/decktube/compare/v0.5.10..v0.5.11
[0.5.10]: https://github.com/mp-pinheiro/decktube/compare/v0.5.9..v0.5.10
[0.5.9]: https://github.com/mp-pinheiro/decktube/compare/v0.5.8..v0.5.9
[0.5.8]: https://github.com/mp-pinheiro/decktube/compare/v0.5.7..v0.5.8
[0.5.7]: https://github.com/mp-pinheiro/decktube/compare/v0.5.6..v0.5.7
[0.5.6]: https://github.com/mp-pinheiro/decktube/compare/v0.5.5..v0.5.6
[0.5.5]: https://github.com/mp-pinheiro/decktube/compare/v0.5.4..v0.5.5
[0.5.4]: https://github.com/mp-pinheiro/decktube/compare/v0.5.3..v0.5.4
[0.5.3]: https://github.com/mp-pinheiro/decktube/compare/v0.5.2..v0.5.3

<!-- generated by git-cliff -->
