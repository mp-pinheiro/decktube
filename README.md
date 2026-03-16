# DeckTube

YouTube viewer for Steam Deck, optimized for controller and keyboard input.

> Internal application — not for public distribution.

## Features

- Authenticated home feed via Google OAuth (device flow)
- Video search, watch page, and channel browsing
- Full Steam Deck gamepad support
- Keyboard shortcuts for all actions
- Electron app (standalone, no browser needed)
- Infinite scroll on home and search results

## Controls

| Action          | Keyboard | Gamepad  |
|-----------------|----------|----------|
| Select          | Enter    | A        |
| Back / Blur     | Escape   | B        |
| Go to channel   | C        | X        |
| Focus search    | S        | Y        |
| Play / Pause    | Space    | RB       |
| Fullscreen      | F        | LB       |
| Navigate UI     | Arrows   | D-Pad    |
| Seek / Volume   | Arrows   | D-Pad    |
| Help            | H        | Select   |

## Tech Stack

- Electron 41, React 19, Vite 7, TypeScript
- Tailwind CSS 4
- React Router v7
- YouTube InnerTube API
- Google OAuth 2.0 Device Flow

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project
3. Enable **YouTube Data API v3**
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**
5. Set **Application type** to **TV and Limited Input devices**
   - This is required — device flow will not work with other application types
6. Copy the **Client ID** and **Client Secret**
7. Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```env
VITE_YOUTUBE_CLIENT_ID=your_client_id.apps.googleusercontent.com
VITE_YOUTUBE_CLIENT_SECRET=your_client_secret
```

> Credentials are embedded into the build at build time, not loaded at runtime.

## Steam Deck Setup

```bash
cp .env.example .env
npm install
npm run build:electron
```

Transfer `release/DeckTube-*.AppImage` to the Steam Deck, add as a non-Steam game in Desktop Mode, and launch from Gaming Mode.

## Web Deployment (alternative)

The app can also be deployed as a web server for access from any browser.

### Docker + Caddy

```bash
cp .env.example .env
docker compose up -d
```

Runs on port 443 with HTTPS via Caddy (self-signed cert, suitable for LAN). To use a custom domain, edit `Caddyfile` and replace `:443` with your hostname.

### Cloudflare Workers

```bash
cp .env.example .env
npm run build
npx wrangler deploy
```

Update the `routes` pattern in `wrangler.toml` to your Cloudflare domain before deploying.

## Development

```bash
cp .env.example .env
npm install
npm run dev:electron  # Electron + Vite hot reload
npm run dev           # browser only at http://localhost:5173
```

## Architecture Notes

- **OAuth device flow:** the user enters a short code on a second device (phone/desktop) to authenticate — no redirect URI needed, suitable for TV/console environments
- **YouTube InnerTube API:** used instead of the official Data API to avoid quota restrictions
- **CORS proxy:** all YouTube API requests are routed through the Electron main process (prod) or Vite dev server (dev) to handle cross-origin restrictions
