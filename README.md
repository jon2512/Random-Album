# SPIN

A mobile-first **daily album suggester** for the commute.

Open the page, hit **Spin today’s album**, listen on Spotify or Apple Music, then tap **I listened** or **Not for me**. Preferences stay on your phone (localStorage) and the next picks lean into what you actually like.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it learns

- **I listened** boosts that album’s genres, moods, decade, and artist.
- **Not for me** avoids that album and gently steers away from similar traits.
- **Another** skips today’s pick and draws a new weighted suggestion.
- One sticky pick per calendar day (until you skip or dislike it).

Album artwork comes from Deezer search via `/api/album-meta`. Apple Music opens a collection link when iTunes finds a confident match, otherwise an Apple Music search. Spotify opens a search for the artist + album.
