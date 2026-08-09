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
- **Search an album** — find something you thought of and tap **I like this**
- **Other drivers’ likes** — browse another profile’s liked list and tap **I like this too**

## How it learns

- **I listened** / **I like this** boosts genres, moods, decade, and artist
- **Not for me** avoids that album and gently steers away from similar traits
- **Another** skips today’s pick and draws a new weighted suggestion
- One sticky pick per calendar day (until you skip or dislike it)

Cover art comes from Deezer (browser JSONP). Apple Music uses an iTunes match when confident, otherwise a search link. Spotify opens a search for the artist + album.

## Where data lives today

Everything is stored in the browser’s **`localStorage`** under `spin-profiles-v1`. That means:

- Fast, private, works on GitHub Pages with no server
- Lost if you clear site data / reset the browser
- Not shared across phones or browsers

### Options to sync elsewhere

| Option | Cross-device | Fits static GH Pages? | Notes |
| --- | --- | --- | --- |
| **1. Firebase / Supabase** (recommended) | Yes | Yes | Free tier auth + database. Sign in per person; profiles sync to the cloud. Best fit for “change phone / clear browser”. |
| **2. Tiny custom API** (e.g. Cloudflare Worker + D1/KV) | Yes | Yes | More control, you own the schema. Slightly more setup. |
| **3. Shareable export codes** | Manual | Yes | Export a JSON/code from one device, paste on another. No account. Good stopgap. |
| **4. Apple iCloud / Google Drive file** | Yes | Awkward | Possible via file picker sync, but clunky UX for a commute app. |
| **5. Hosted backend (Vercel/Fly + Postgres)** | Yes | Leaves pure Pages | Full app hosting; drop static-only constraint. |

**Recommendation:** keep GitHub Pages for the UI, add **Supabase or Firebase** for accounts + synced profile JSON. The “other drivers’ likes” screen already works for profiles on the **same browser**; cloud sync would make that work across devices too.

## GitHub Pages

Pushes to `main` deploy via `.github/workflows/deploy-pages.yml`.

In the repo: **Settings → Pages → Source → GitHub Actions** (or deploy from the `gh-pages` branch).
