# DeckTube

YouTube viewer for Steam Deck, optimized for controller and keyboard input.

> Internal application — not for public distribution.

## Features

- Authenticated home feed via Google OAuth (TV/limited-input device flow)
- Video search, watch page, channel browsing, infinite scroll
- DASH adaptive streaming via dash.js with quality selector
- SponsorBlock-driven segment skipping
- Optional Firebase cloud sync of watch history, watched state, playback positions, and preferences
- In-app auto-update from GitHub releases
- Input lock (hold `-` or `LB+RB`) to ignore stray input while a video plays
- Headphone / Bluetooth media-key support (play/pause/next) — works even while locked
- On-screen virtual keyboard for controller text entry
- Settings modal with sync, SponsorBlock, and exit-app controls

## Controls

| Action            | Keyboard            | Gamepad             |
|-------------------|---------------------|---------------------|
| Select / Play     | Enter / Space       | A                   |
| Back / Blur       | Escape              | B                   |
| Go to channel     | C                   | X                   |
| Focus search      | S                   | Y                   |
| Fullscreen        | F                   | LB                  |
| Quality selector  | Q                   | LT                  |
| Next video        | N                   | —                   |
| Previous tab      | `[`                 | —                   |
| Next tab          | `]`                 | RB                  |
| Mode toggle       | M                   | START               |
| Help              | H                   | SELECT              |
| Toggle input lock | hold `-` (1s)       | hold `LB+RB` (1s)   |
| Navigate UI       | Arrows              | D-Pad               |
| Seek / Volume     | Arrows (watch page) | D-Pad (watch page)  |
| Headphone play    | MediaPlayPause      | (Bluetooth headset) |
| Headphone next    | MediaTrackNext      | (Bluetooth headset) |

Media keys bypass the input lock so headphone playback control always works.

## Tech Stack

- Electron 41, React 19, Vite 7, TypeScript
- Tailwind CSS 4
- React Router v7
- dash.js (DASH adaptive streaming)
- electron-updater (GitHub release auto-update)
- Firebase (Auth + Firestore) for optional cloud sync
- YouTube InnerTube API (no official Data API quota)
- Google OAuth 2.0 device flow

## Configuration

Copy `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env
```

### Google OAuth (required)

1. Open the [Google Cloud Console](https://console.cloud.google.com/) and create a project.
2. Enable **YouTube Data API v3**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Application type: **TV and Limited Input devices** (required — device flow does not work with other types).
5. Copy the Client ID and Client Secret into `.env`:

```env
VITE_YOUTUBE_CLIENT_ID=your_client_id.apps.googleusercontent.com
VITE_YOUTUBE_CLIENT_SECRET=your_client_secret
```

### Firebase (optional, enables cloud sync)

1. Create a project at the [Firebase Console](https://console.firebase.google.com/).
2. Enable **Firestore Database** and add a Web App to retrieve the config.
3. Fill in `.env`:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
```

Without these vars the app runs in local-only mode (no cross-device sync).

> All credentials are embedded into the build at build time, not loaded at runtime.

## Build & Deploy to Steam Deck

```bash
make deploy        # build, then scp the AppImage to deck@steamdeck.lan:/home/deck/DeckTube.AppImage
make logs          # tail the Deck-side log
make release       # bump patch version, build, push tags (triggers GitHub release CI)
make assets        # regenerate Steam library art via ImageMagick
make deploy-art    # push library art to a configured Steam game
```

Override the host with `DECK_HOST=user@host make deploy`. The `release` target accepts `major`, `minor`, or `patch` (default `patch`): `make release minor`.

For first-time setup on the Deck, add the resulting `/home/deck/DeckTube.AppImage` as a non-Steam game in Desktop Mode and launch it from Gaming Mode. Subsequent updates ship through the in-app update banner.

## Development

```bash
cp .env.example .env
npm install
npm run dev:electron   # Electron + Vite hot reload
npm run dev            # browser only at http://localhost:5173
npm run lint           # ESLint
npm run build          # type-check + Vite build (no Electron packaging)
```

## Architecture Notes

- **OAuth device flow:** the user enters a short code on a second device — no redirect URI needed, suitable for TV/console environments.
- **YouTube InnerTube API:** all browse/search/watch traffic goes through `youtubei/v1` (IOS client for player, TVHTML5/WEB for browse) instead of the official Data API to avoid quota.
- **CORS proxy:** YouTube API requests are routed through the Electron main process (prod) or the Vite dev server (dev) to bypass cross-origin restrictions.
- **DASH player:** dash.js drives a generated MPD against the IOS-client streams, with retry intervals tuned for flaky Wi-Fi.
- **Input system:** `src/contexts/InputProvider.tsx` translates keyboard and gamepad events into intents (`src/lib/inputMap.ts`); modals push handlers onto a layered stack (`src/lib/inputLayer.ts`) so focus/back behavior composes cleanly.
- **Sync model:** Firestore is opt-in per data type; local IndexedDB is the source of truth and Firestore mirrors it. Without `VITE_FIREBASE_*` vars the sync layer is a no-op.
- **Auto-update:** `electron-updater` polls GitHub releases. The renderer's `UpdateBanner` drives Download / Restart through IPC; main pre-flights the cached AppImage before invoking `quitAndInstall` so a missing or zero-byte cache cannot delete the running binary.
