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

export async function fetchAlbumMeta(album: Album): Promise<AlbumMeta> {
  const params = new URLSearchParams({
    artist: album.artist,
    album: album.searchHint ?? album.title,
  });
  const res = await fetch(`/api/album-meta?${params.toString()}`);
  if (!res.ok) {
    return { artworkUrl: null, appleMusicUrl: null, previewUrl: null };
  }
  return res.json();
}
