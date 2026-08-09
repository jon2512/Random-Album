# SPIN

A mobile-first **daily album suggester** for the commute — with up to **4 profiles**.

**Live:** [https://jon2512.github.io/Random-Album/](https://jon2512.github.io/Random-Album/)

Open the page, pick (or create) a profile, hit **Spin today’s album**, listen on Spotify or Apple Music, then tap **I listened** or **Not for me**. Each profile keeps its own taste on the device (`localStorage`).

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production-static preview (same as GitHub Pages):

```bash
NEXT_PUBLIC_BASE_PATH=/Random-Album npm run build
npx serve out
```

## Profiles

- Up to 4 named drivers
- Separate listen / dislike history and recommendation weights per profile
- Tap the name chip in the header to switch

## How it learns

- **I listened** boosts that album’s genres, moods, decade, and artist
- **Not for me** avoids that album and gently steers away from similar traits
- **Another** skips today’s pick and draws a new weighted suggestion
- One sticky pick per calendar day (until you skip or dislike it)

Cover art comes from Deezer (browser JSONP). Apple Music uses an iTunes match when confident, otherwise a search link. Spotify opens a search for the artist + album.

## GitHub Pages

Pushes to `main` deploy via `.github/workflows/deploy-pages.yml`.

In the repo: **Settings → Pages → Source → GitHub Actions**.
