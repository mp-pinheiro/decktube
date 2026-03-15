# DeckTube

YouTube viewer for Steam Deck, optimized for controller and keyboard input.

> Internal application — not for public distribution.

## Features

- Authenticated home feed via Google OAuth (device flow)
- Video search, watch page, and channel browsing
- Full Steam Deck gamepad support
- Keyboard shortcuts for all actions
- PWA support (fullscreen, landscape lock)
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

- React 19, Vite 7, TypeScript
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

## Deployment

### Option A: Docker + Caddy (recommended for local/LAN)

```bash
cp .env.example .env
# Edit .env with your credentials
docker compose up -d
```

The app runs on port 443 with HTTPS via Caddy using a self-signed certificate (suitable for LAN use).

HTTPS is required — PWA features (service worker, fullscreen lock, standalone launch mode) are restricted to secure contexts by the browser. Without it, the app loads as a plain webpage when launched from Steam as a non-Steam game.

To use a custom domain or IP, edit `Caddyfile` and replace `:443` with your hostname:

```
your-hostname.local {
  tls internal
  reverse_proxy yt-deck:3000
}
```

### Option B: Cloudflare Workers

```bash
cp .env.example .env
# Edit .env with your credentials
npm run build
npx wrangler deploy
```

Update the `routes` pattern in `wrangler.toml` to your Cloudflare domain before deploying (currently set to `decktube.fairfruit.tv`).

## Steam Deck Setup

After the server is running, do this once from the Steam Deck to install DeckTube as a game:

1. **Switch to Desktop Mode** — hold Power → Switch to Desktop
2. **Open Chromium** and navigate to `https://<your-server-ip>`
3. **Trust the certificate** — Chromium will warn about the self-signed cert; click Advanced → Proceed
4. **Install the PWA** — click the install icon in the address bar (or menu → Install DeckTube)
5. **Add to Steam** — open Steam in Desktop Mode → Games → Add a Non-Steam Game → select DeckTube
6. **Return to Game Mode** — DeckTube will appear in your library and launch fullscreen

> If you want to skip the certificate warning permanently, export Caddy's root CA (`caddy trust` or copy from `~/.local/share/caddy/pki/authorities/local/root.crt`) and import it into Chromium's certificate store under Settings → Privacy and Security → Manage Certificates.

## Development

```bash
cp .env.example .env
# Fill in credentials
npm install
npm run dev  # http://localhost:5173
```

## Architecture Notes

- **OAuth device flow:** the user enters a short code on a second device (phone/desktop) to authenticate — no redirect URI needed, which makes it suitable for TV/console environments
- **YouTube InnerTube API:** used instead of the official Data API to avoid quota restrictions
- **CORS proxy:** all YouTube API requests are routed through the app server to handle cross-origin restrictions
