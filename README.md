# Raiden Storm

A classic vertical scrolling shooter game built with HTML5 Canvas and vanilla JavaScript.

## Live Demo

Deploy to Vercel with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/YOUR_USERNAME/raiden-storm)

## Local Development

```bash
npx serve . -p 3000
```

Then open http://localhost:3000 in your browser.

## Deploy to Vercel

### Option 1: Vercel CLI

```bash
npm i -g vercel
vercel
```

### Option 2: Git Integration

1. Push this repo to GitHub/GitLab/Bitbucket
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Vercel will auto-detect the static site and deploy

No build step needed — Vercel serves the static files directly.

## Controls

- **WASD / Arrow Keys** - Move ship
- **Mouse (hold click)** - Move ship to cursor
- **Touch** - Move ship (mobile)
- **Space** - Use bomb (clears screen)
- **P** - Pause/Resume

### 2-Player Co-op (desktop, shared keyboard)

Choose **2 PLAYERS** on the menu (or press **2**). Both pilots fight the same
enemies; each keeps their own score, lives, shield, bombs and weapon level.

| | Move | Bomb |
|---|---|---|
| **P1** (blue) | W A S D | Space |
| **P2** (orange) | Arrow Keys | Enter |

- Enemies and bosses alternate targeting the two living pilots.
- Game over only when **both** pilots are out; a fallen pilot rejoins with 1 life at the next sector.
- Co-op runs are not saved to the solo high-score board.
- Mouse / touch movement is disabled in co-op. The menu entry is hidden on touch-only devices.

## Features

- 5 levels with increasing difficulty + endless mode
- Local 2-player co-op (shared keyboard)
- 3 unique boss fights with multi-phase attacks
- Weapon upgrade system (5 levels)
- Power-up items (weapon, bomb, shield, missile, coins, 1UP)
- Combo kill chain system with score multiplier
- Graze system (dodge bullets closely for bonus points)
- Parallax scrolling background
- Particle effects and screen shake
- Procedural audio (Web Audio API)
- High score system (localStorage)
- Mobile touch support
- PWA support (installable)

## Tech Stack

- Pure HTML5 Canvas (no frameworks)
- ES Modules
- Web Audio API (procedural sound)
- localStorage (high scores)
- PWA (manifest.json)
