import { ALBUMS, type Album, type Genre, type Mood } from "@/data/albums";
import { jsonp } from "@/lib/links";

export type SearchHit = {
  album: Album;
  artworkUrl: string | null;
  source: "catalog" | "deezer";
};

type DeezerSearchAlbum = {
  id?: number;
  title?: string;
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  record_type?: string;
  artist?: { name?: string };
};

type DeezerAlbumDetail = {
  id?: number;
  title?: string;
  release_date?: string;
  cover_xl?: string;
  cover_big?: string;
  genres?: { data?: { id?: number; name?: string }[] };
  artist?: { name?: string };
};

const DEEZER_GENRE_MAP: Record<number, Genre> = {
  132: "pop",
  152: "rock",
  85: "indie",
  113: "electronic",
  106: "electronic",
  116: "hip-hop",
  165: "r&b",
  129: "jazz",
  98: "world",
  466: "folk",
  464: "metal",
  84: "country",
  169: "soul",
  75: "world",
  173: "ambient",
};

function slugId(artist: string, title: string, deezerId?: number): string {
  if (deezerId) return `dz-${deezerId}`;
  const base = `${artist}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `ext-${base}`;
}

function mapGenres(ids: number[], names: string[]): Genre[] {
  const out = new Set<Genre>();
  for (const id of ids) {
    const g = DEEZER_GENRE_MAP[id];
    if (g) out.add(g);
  }
  for (const name of names) {
    const n = name.toLowerCase();
    if (n.includes("hip") || n.includes("rap")) out.add("hip-hop");
    else if (n.includes("r&b") || n.includes("rnb") || n.includes("soul"))
      out.add(n.includes("soul") ? "soul" : "r&b");
    else if (n.includes("indie") || n.includes("alternative")) out.add("indie");
    else if (n.includes("metal")) out.add("metal");
    else if (n.includes("punk")) out.add("punk");
    else if (n.includes("jazz")) out.add("jazz");
    else if (n.includes("folk") || n.includes("singer")) out.add("folk");
    else if (n.includes("country")) out.add("country");
    else if (n.includes("electro") || n.includes("dance") || n.includes("house"))
      out.add("electronic");
    else if (n.includes("rock")) out.add("rock");
    else if (n.includes("pop")) out.add("pop");
    else if (n.includes("ambient")) out.add("ambient");
  }
  return [...out].slice(0, 3);
}

function defaultMoods(genres: Genre[]): Mood[] {
  if (genres.includes("jazz") || genres.includes("ambient")) return ["chill", "dreamy"];
  if (genres.includes("metal") || genres.includes("punk")) return ["energetic", "dark"];
  if (genres.includes("electronic")) return ["groovy", "upbeat"];
  if (genres.includes("folk")) return ["emotional", "melancholy"];
  if (genres.includes("hip-hop")) return ["groovy", "energetic"];
  return ["emotional", "upbeat"];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function catalogMatches(query: string): SearchHit[] {
  const q = normalize(query);
  if (!q) return [];
  const tokens = q.split(" ").filter(Boolean);

  return ALBUMS.map((album) => {
    const hay = normalize(`${album.title} ${album.artist}`);
    let score = 0;
    if (hay.includes(q)) score += 10;
    for (const t of tokens) {
      if (hay.includes(t)) score += 2;
    }
    if (normalize(album.title).startsWith(q)) score += 5;
    return { album, score };
  })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ album }) => ({
      album,
      artworkUrl: null,
      source: "catalog" as const,
    }));
}

async function deezerMatches(query: string): Promise<SearchHit[]> {
  const url = `https://api.deezer.com/search/album?q=${encodeURIComponent(query)}&limit=12&output=jsonp`;
  try {
    const data = await jsonp<{ data?: DeezerSearchAlbum[] }>(url);
    return (data.data ?? [])
      .filter((r) => r.title && r.artist?.name && r.record_type !== "compile")
      .map((r) => {
        const artist = r.artist!.name!;
        const title = r.title!;
        const album: Album = {
          id: slugId(artist, title, r.id),
          title,
          artist,
          year: 0,
          genres: [],
          moods: ["emotional"],
        };
        return {
          album,
          artworkUrl: r.cover_big ?? r.cover_medium ?? null,
          source: "deezer" as const,
        };
      })
      .slice(0, 10);
  } catch {
    return [];
  }
}

function dedupeHits(hits: SearchHit[]): SearchHit[] {
  const seen = new Set<string>();
  const out: SearchHit[] = [];
  for (const hit of hits) {
    const key = normalize(`${hit.album.artist}|${hit.album.title}`);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hit);
  }
  return out;
}

/** Prefer catalog match when titles collide with Deezer. */
export async function searchAlbums(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const local = catalogMatches(q);
  const remote = await deezerMatches(q);

  // If a Deezer hit matches a catalog album, keep catalog version but borrow art
  const catalogKeys = new Map(
    local.map((h) => [normalize(`${h.album.artist}|${h.album.title}`), h]),
  );
  const mergedRemote: SearchHit[] = [];
  for (const hit of remote) {
    const key = normalize(`${hit.album.artist}|${hit.album.title}`);
    const existing = catalogKeys.get(key);
    if (existing) {
      if (!existing.artworkUrl && hit.artworkUrl) {
        existing.artworkUrl = hit.artworkUrl;
      }
      continue;
    }
    // Also match catalog by title+partial artist
    const catalogTwin = ALBUMS.find(
      (a) =>
        normalize(a.title) === normalize(hit.album.title) &&
        (normalize(a.artist).includes(normalize(hit.album.artist)) ||
          normalize(hit.album.artist).includes(normalize(a.artist))),
    );
    if (catalogTwin) {
      mergedRemote.push({
        album: catalogTwin,
        artworkUrl: hit.artworkUrl,
        source: "catalog",
      });
      continue;
    }
    mergedRemote.push(hit);
  }

  return dedupeHits([...local, ...mergedRemote]).slice(0, 16);
}

/** Enrich a Deezer hit with year + genres before liking. */
export async function enrichSearchHit(hit: SearchHit): Promise<SearchHit> {
  if (hit.source !== "deezer") return hit;
  const id = hit.album.id.startsWith("dz-")
    ? hit.album.id.slice(3)
    : null;
  if (!id) return hit;

  try {
    const detail = await jsonp<DeezerAlbumDetail>(
      `https://api.deezer.com/album/${id}?output=jsonp`,
    );
    const genreIds = (detail.genres?.data ?? [])
      .map((g) => g.id)
      .filter((n): n is number => typeof n === "number");
    const genreNames = (detail.genres?.data ?? [])
      .map((g) => g.name ?? "")
      .filter(Boolean);
    const genres = mapGenres(genreIds, genreNames);
    const year = detail.release_date
      ? Number(detail.release_date.slice(0, 4)) || 0
      : 0;
    return {
      ...hit,
      artworkUrl:
        hit.artworkUrl ?? detail.cover_xl ?? detail.cover_big ?? null,
      album: {
        ...hit.album,
        title: detail.title ?? hit.album.title,
        artist: detail.artist?.name ?? hit.album.artist,
        year,
        genres,
        moods: defaultMoods(genres),
      },
    };
  } catch {
    return hit;
  }
}
