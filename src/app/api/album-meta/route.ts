import { NextRequest, NextResponse } from "next/server";

export type AlbumMetaResponse = {
  artworkUrl: string | null;
  appleMusicUrl: string | null;
  previewUrl: string | null;
  matchedTitle: string | null;
  matchedArtist: string | null;
};

type ITunesAlbum = {
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  collectionViewUrl?: string;
  previewUrl?: string;
};

function upgradeArtwork(url: string | undefined): string | null {
  if (!url) return null;
  // iTunes serves 100x100 by default; bump to high-res
  return url.replace("100x100bb", "600x600bb").replace("100x100", "600x600");
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

  const term = encodeURIComponent(`${artist} ${album}`);
  const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=5`;

  try {
    const res = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 * 7 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          artworkUrl: null,
          appleMusicUrl: null,
          previewUrl: null,
          matchedTitle: null,
          matchedArtist: null,
        } satisfies AlbumMetaResponse,
      );
    }

    const data = (await res.json()) as { results?: ITunesAlbum[] };
    const results = data.results ?? [];

    const needleAlbum = album.toLowerCase();
    const needleArtist = artist.toLowerCase();
    const best =
      results.find(
        (r) =>
          (r.collectionName ?? "").toLowerCase().includes(needleAlbum) ||
          needleAlbum.includes((r.collectionName ?? "").toLowerCase()),
      ) ??
      results.find((r) =>
        (r.artistName ?? "").toLowerCase().includes(needleArtist),
      ) ??
      results[0];

    const payload: AlbumMetaResponse = {
      artworkUrl: upgradeArtwork(best?.artworkUrl100),
      appleMusicUrl: best?.collectionViewUrl ?? null,
      previewUrl: best?.previewUrl ?? null,
      matchedTitle: best?.collectionName ?? null,
      matchedArtist: best?.artistName ?? null,
    };

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json(
      {
        artworkUrl: null,
        appleMusicUrl: null,
        previewUrl: null,
        matchedTitle: null,
        matchedArtist: null,
      } satisfies AlbumMetaResponse,
    );
  }
}
