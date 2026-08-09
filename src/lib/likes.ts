import { ALBUMS, getAlbumById, type Album } from "@/data/albums";
import type { PreferenceState } from "@/lib/preferences";
import type { Profile, ProfileStore } from "@/lib/profiles";

export type LikedAlbumEntry = {
  album: Album;
  likedAt: string | null;
  score: number;
};

export type ProfileLikedList = {
  profile: Profile;
  entries: LikedAlbumEntry[];
};

function resolveAlbum(
  id: string,
  prefs: PreferenceState,
  extras: Album[] = [],
): Album | undefined {
  const fromCatalog = getAlbumById(id);
  if (fromCatalog) return fromCatalog;
  const fromOwn = (prefs.customAlbums ?? []).find((a) => a.id === id);
  if (fromOwn) return fromOwn;
  return extras.find((a) => a.id === id);
}

/** Liked albums for one profile, newest / strongest first. */
export function likedAlbumsForProfile(
  profile: Profile,
  extras: Album[] = [],
): LikedAlbumEntry[] {
  const prefs = profile.preferences;
  const entries: LikedAlbumEntry[] = [];

  for (const [id, score] of Object.entries(prefs.liked ?? {})) {
    if (score <= 0) continue;
    const album = resolveAlbum(id, prefs, extras);
    if (!album) continue;
    entries.push({
      album,
      likedAt: prefs.listened[id] ?? null,
      score,
    });
  }

  return entries.sort((a, b) => {
    const ta = a.likedAt ? Date.parse(a.likedAt) : 0;
    const tb = b.likedAt ? Date.parse(b.likedAt) : 0;
    if (tb !== ta) return tb - ta;
    return b.score - a.score;
  });
}

/** Other drivers' likes for cross-inspiration. */
export function otherProfilesLikedLists(
  store: ProfileStore,
  activeId: string | null,
): ProfileLikedList[] {
  const poolExtras = [
    ...ALBUMS,
    ...store.profiles.flatMap((p) => p.preferences.customAlbums ?? []),
  ];

  return store.profiles
    .filter((p) => p.id !== activeId)
    .map((profile) => ({
      profile,
      entries: likedAlbumsForProfile(profile, poolExtras),
    }))
    .filter((list) => list.entries.length > 0);
}
