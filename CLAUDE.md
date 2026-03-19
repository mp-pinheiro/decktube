# YOU MUST OBEY
- DO NOT RUN `npm run dev` or similar. YOU ARE SANDBOXED. ASK TO RUN SERVER.

# DeckTube

A web app for watching YouTube videos on Steam Deck with controller/keyboard-friendly controls.

**See [VISION.md](./VISION.md) for the full project vision and development phases.**

## Technical Decisions

- **API:** YouTube innertube API (youtubei/v1) via proxy -- IOS client for player, TVHTML5/WEB for browse/search
- **Player:** dash.js (DASH adaptive streaming via generated MPD manifests)
- **Routing:** React Router v7
- **State:** React Context (current implementation)

## Tech Stack

- React + Vite + TypeScript
- Tailwind CSS
- dash.js (DASH adaptive streaming player)
- YouTube innertube API (no IFrame, no Invidious)

## Key Features & Core UX Philosophy

**CRITICAL RULE: THIS IS ESSENTIALLY A CONSOLE APPLICATION.**
ALL FEATURES MUST adhere to the Steam Deck controller UX. You are not building a traditional point-and-click web app; you are building an interface navigated primarily via D-Pad (Arrows) and face buttons (Enter/Space/Hotkeys).
- Every interactive element (links, buttons, search results) MUST be reachable and usable via keyboard/controller.
- Focus states must be visually obvious (e.g. `ring-2 ring-red-500`).
- Trapping focus (e.g. getting stuck in search) is unacceptable; always provide an intuitive escape hatch (e.g., `ArrowDown` to exit search).

- Clean, minimal interface optimized for Steam Deck viewport
- Controls (every keyboard shortcut has a gamepad equivalent):
  - Enter / A: Select / Play-Pause
  - Escape / B: Back/blur
  - C / X: Go to channel
  - S / Y: Focus search
  - Space: Play/Pause
  - F / LB: Fullscreen
  - Q / LT: Quality selector
  - [ ] / LB RB: Switch tab
  - Arrows / D-Pad: Navigate UI / Seek & Volume on watch page
  - H / Select: Open help modal

## Development

```bash
npm run dev    # Start dev server (auto-restarts on file changes)
npm run build  # Build for production
```

**IMPORTANT:** Vite dev server auto-restarts on file changes. NEVER ask user to restart - just refresh browser. Always check if server is already running on port 5173 before starting.

## Version Control

This project uses jj (jujutsu), not git. See https://docs.jj-vcs.dev/latest/

Common commands:
- `jj status` - View working copy status
- `jj new` - Create new change
- `jj describe` - Edit change description
- `jj log` - View change history
