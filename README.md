# SPIN

A mobile-first **daily album suggester** for a small group of friends — separate profiles, shared inspiration, optional home-NAS sync.

**Live (frontend):** [https://jon2512.github.io/Random-Album/](https://jon2512.github.io/Random-Album/)

## How it works

1. Join a **room** with a shared code (no sign-in)
2. **Pick your name** or create a profile
3. Spin / search / like — **only your profile’s recommendations are trained**
4. Open **Friends’ likes & dislikes** when you want cross-inspiration

## Run the website locally

```bash
npm install
npm run dev
```

## Run the sync API (Synology / Docker)

```bash
cd server
docker compose up -d --build
curl http://localhost:8787/health
```

Full Synology + **Cloudflare Tunnel** setup: [docs/NAS-CLOUDFLARE.md](docs/NAS-CLOUDFLARE.md)

Set your tunnel URL in `public/config.json`:

```json
{ "apiUrl": "https://spin-api.yourdomain.com" }
```

## Data

| Mode | Where data lives |
| --- | --- |
| With API (recommended) | Your NAS (`server/data`) — survives browser resets & phone changes |
| Room code | Shared “house” for friends |
| Each profile | Isolated likes / dislikes / weights |

## GitHub Pages

Pushes to `main` deploy via `.github/workflows/deploy-pages.yml`, or use the `gh-pages` branch.
