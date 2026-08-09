import type { Album } from "@/data/albums";

export function spotifySearchUrl(album: Album): string {
  const q = encodeURIComponent(`${album.artist} ${album.title}`);
  return `https://open.spotify.com/search/${q}`;
}

export function appleMusicSearchUrl(album: Album): string {
  const q = encodeURIComponent(`${album.artist} ${album.title}`);
  return `https://music.apple.com/search?term=${q}`;
}

export type AlbumMeta = {
  artworkUrl: string | null;
  appleMusicUrl: string | null;
  previewUrl: string | null;
};

type DeezerAlbum = {
  title?: string;
  cover_xl?: string;
  cover_big?: string;
  artist?: { name?: string };
};

type ITunesAlbum = {
  collectionName?: string;
  artistName?: string;
  collectionViewUrl?: string;
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isNoisyTitle(title: string): boolean {
  return /\b(live|originally by|tribute|karaoke|cover of|8 bit|8-bit|soundtrack)\b/.test(
    title,
  );
}

function score(
  artistName: string,
  albumTitle: string,
  needleArtist: string,
  needleAlbum: string,
): number {
  const artist = normalize(artistName);
  const title = normalize(albumTitle);
  let s = 0;

  if (artist === needleArtist) s += 50;
  else if (artist.includes(needleArtist) || needleArtist.includes(artist)) s += 20;
  else return -1;

  if (title === needleAlbum) s += 45;
  else if (title.startsWith(needleAlbum) || needleAlbum.startsWith(title)) s += 35;
  else if (title.includes(needleAlbum) || needleAlbum.includes(title)) s += 18;
  else return -1;

  if (isNoisyTitle(title)) s -= 40;
  return s;
}

export function jsonp<T>(url: string, callbackParam = "callback"): Promise<T> {
  return new Promise((resolve, reject) => {
    const cbName = `spinJsonp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const script = document.createElement("script");
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("JSONP timeout"));
    }, 8000);

    function cleanup() {
      window.clearTimeout(timer);
      script.remove();
      delete (window as unknown as Record<string, unknown>)[cbName];
    }

    (window as unknown as Record<string, unknown>)[cbName] = (data: T) => {
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error("JSONP failed"));
    };

    const joiner = url.includes("?") ? "&" : "?";
    script.src = `${url}${joiner}${callbackParam}=${cbName}`;
    document.body.appendChild(script);
  });
}

async function fetchDeezerMeta(
  artist: string,
  album: string,
): Promise<AlbumMeta | null> {
  const q = `artist:"${artist}" album:"${album}"`;
  const url = `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=8&output=jsonp`;

  try {
    const data = await jsonp<{ data?: DeezerAlbum[] }>(url);
    const results = data.data ?? [];
    const needleArtist = normalize(artist);
    const needleAlbum = normalize(album);

    let best: DeezerAlbum | null = null;
    let bestScore = -Infinity;
    for (const r of results) {
      const value = score(
        r.artist?.name ?? "",
        r.title ?? "",
        needleArtist,
        needleAlbum,
      );
      if (value > bestScore) {
        bestScore = value;
        best = r;
      }
    }
    if (!best || bestScore < 50) return null;
    return {
      artworkUrl: best.cover_xl ?? best.cover_big ?? null,
      appleMusicUrl: null,
      previewUrl: null,
    };
  } catch {
    return null;
  }
}

async function fetchAppleMusicUrl(
  artist: string,
  album: string,
): Promise<string | null> {
  const term = encodeURIComponent(`${artist} ${album}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=album&country=us&limit=12`;
  try {
    const data = await jsonp<{ results?: ITunesAlbum[] }>(url);
    const needleArtist = normalize(artist);
    const needleAlbum = normalize(album);
    let best: ITunesAlbum | null = null;
    let bestScore = -Infinity;
    for (const r of data.results ?? []) {
      const value = score(
        r.artistName ?? "",
        r.collectionName ?? "",
        needleArtist,
        needleAlbum,
      );
      if (value > bestScore) {
        bestScore = value;
        best = r;
      }
    }
    if (best && bestScore >= 70) return best.collectionViewUrl ?? null;
  } catch {
    /* ignore */
  }
  return null;
}

/** Client-side metadata lookup (works on static GitHub Pages). */
export async function fetchAlbumMeta(album: Album): Promise<AlbumMeta> {
  const artist = album.artist;
  const title = album.searchHint ?? album.title;

  const [deezer, appleMusicUrl] = await Promise.all([
    fetchDeezerMeta(artist, title),
    fetchAppleMusicUrl(artist, title),
  ]);

  return {
    artworkUrl: deezer?.artworkUrl ?? null,
    appleMusicUrl,
    previewUrl: null,
  };
}
