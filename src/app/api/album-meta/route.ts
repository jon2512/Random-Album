import { NextRequest, NextResponse } from "next/server";

export type AlbumMetaResponse = {
  artworkUrl: string | null;
  appleMusicUrl: string | null;
  previewUrl: string | null;
  matchedTitle: string | null;
  matchedArtist: string | null;
};

type DeezerAlbum = {
  title?: string;
  link?: string;
  cover_xl?: string;
  cover_big?: string;
  artist?: { name?: string };
};

type ITunesAlbum = {
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  collectionViewUrl?: string;
};

function emptyMeta(): AlbumMetaResponse {
  return {
    artworkUrl: null,
    appleMusicUrl: null,
    previewUrl: null,
    matchedTitle: null,
    matchedArtist: null,
  };
}

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

async function fetchDeezer(
  artist: string,
  album: string,
): Promise<DeezerAlbum | null> {
  const q = `artist:"${artist}" album:"${album}"`;
  const url = `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=8`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return null;
  const data = (await res.json()) as { data?: DeezerAlbum[] };
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
  return bestScore >= 50 ? best : null;
}

async function fetchAppleMusicUrl(
  artist: string,
  album: string,
): Promise<string | null> {
  const term = encodeURIComponent(`${artist} ${album}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=album&country=us&limit=12`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: ITunesAlbum[] };
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
    /* fall through */
  }
  return null;
}

export async function GET(request: NextRequest) {
  const artist = request.nextUrl.searchParams.get("artist")?.trim() ?? "";
  const album = request.nextUrl.searchParams.get("album")?.trim() ?? "";

  if (!artist || !album) {
    return NextResponse.json(
      { error: "artist and album are required" },
      { status: 400 },
    );
  }

  try {
    const [deezer, appleMusicUrl] = await Promise.all([
      fetchDeezer(artist, album),
      fetchAppleMusicUrl(artist, album),
    ]);

    if (!deezer) {
      return NextResponse.json({
        ...emptyMeta(),
        appleMusicUrl,
      } satisfies AlbumMetaResponse);
    }

    const payload: AlbumMetaResponse = {
      artworkUrl: deezer.cover_xl ?? deezer.cover_big ?? null,
      appleMusicUrl,
      previewUrl: null,
      matchedTitle: deezer.title ?? null,
      matchedArtist: deezer.artist?.name ?? null,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json(emptyMeta());
  }
}
