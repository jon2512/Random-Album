import { ALBUMS, getAlbumById, type Album } from "@/data/albums";
import type { PreferenceState } from "@/lib/preferences";
import type { Profile, ProfileStore } from "@/lib/profiles";
import type { InspirationProfile } from "@/lib/api";

export type LikedAlbumEntry = {
  album: Album;
  likedAt: string | null;
  score: number;
};

export type ProfileLikedList = {
  profile: Pick<Profile, "id" | "name" | "color">;
  likes: LikedAlbumEntry[];
  dislikes: Album[];
};

function resolveAlbum(
  id: string,
  prefs: Pick<PreferenceState, "customAlbums" | "aiAlbums">,
  extras: Album[] = [],
): Album | undefined {
  const fromCatalog = getAlbumById(id);
  if (fromCatalog) return fromCatalog;
  const fromOwn = (prefs.customAlbums ?? []).find((a) => a.id === id);
  if (fromOwn) return fromOwn;
  const fromAi = (prefs.aiAlbums ?? []).find((a) => a.id === id);
  if (fromAi) return fromAi;
  return extras.find((a) => a.id === id);
}

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

export function dislikedAlbumsForProfile(
  profile: Profile,
  extras: Album[] = [],
): Album[] {
  const prefs = profile.preferences;
  return (prefs.disliked ?? [])
    .map((id) => resolveAlbum(id, prefs, extras))
    .filter((a): a is Album => !!a);
}

export function otherProfilesLikedLists(
  store: ProfileStore,
  activeId: string | null,
): ProfileLikedList[] {
  const poolExtras = [
    ...ALBUMS,
    ...store.profiles.flatMap((p) => [
      ...(p.preferences.customAlbums ?? []),
      ...(p.preferences.aiAlbums ?? []),
    ]),
  ];

  return store.profiles
    .filter((p) => p.id !== activeId)
    .map((profile) => ({
      profile,
      likes: likedAlbumsForProfile(profile, poolExtras),
      dislikes: dislikedAlbumsForProfile(profile, poolExtras),
    }))
    .filter((list) => list.likes.length > 0 || list.dislikes.length > 0);
}

/** Build inspiration lists from remote API payload. */
export function inspirationToLists(
  profiles: InspirationProfile[],
): ProfileLikedList[] {
  return profiles
    .map((p) => {
      const fakePrefs = {
        customAlbums: p.customAlbums ?? [],
        aiAlbums: [],
      };
      const extras = [...ALBUMS, ...(p.customAlbums ?? [])];
      const likes: LikedAlbumEntry[] = Object.entries(p.liked || {})
        .filter(([, score]) => score > 0)
        .flatMap(([id, score]) => {
          const album = resolveAlbum(id, fakePrefs, extras);
          if (!album) return [];
          const entry: LikedAlbumEntry = {
            album,
            likedAt: p.listened?.[id] ?? null,
            score,
          };
          return [entry];
        })
        .sort((a, b) => {
          const ta = a.likedAt ? Date.parse(a.likedAt) : 0;
          const tb = b.likedAt ? Date.parse(b.likedAt) : 0;
          if (tb !== ta) return tb - ta;
          return b.score - a.score;
        });

      const dislikes = (p.disliked || [])
        .map((id) => resolveAlbum(id, fakePrefs, extras))
        .filter((a): a is Album => !!a);

      return {
        profile: { id: p.id, name: p.name, color: p.color },
        likes,
        dislikes,
      };
    })
    .filter((list) => list.likes.length > 0 || list.dislikes.length > 0);
}
