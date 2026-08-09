import { ALBUMS, decadeOf, type Album } from "@/data/albums";
import type { PreferenceState } from "@/lib/preferences";

function daysSince(iso: string | undefined): number {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function scoreAlbum(album: Album, prefs: PreferenceState): number {
  if (prefs.disliked.includes(album.id)) return -Infinity;

  let score = 1; // base so everything remains pickable early on

  for (const g of album.genres) {
    score += (prefs.genreScores[g] ?? 0) * 1.4;
  }
  for (const m of album.moods) {
    score += (prefs.moodScores[m] ?? 0) * 1.1;
  }
  score += (prefs.decadeScores[decadeOf(album.year)] ?? 0) * 1.0;
  score += (prefs.artistScores[album.artist] ?? 0) * 1.6;

  // Soft exploration: boost never-suggested albums slightly
  const suggestedDays = daysSince(prefs.suggested[album.id]);
  if (suggestedDays === Infinity) score += 1.2;
  else if (suggestedDays < 14) score -= (14 - suggestedDays) * 0.35;

  const listenedDays = daysSince(prefs.listened[album.id]);
  if (listenedDays < 30) score -= (30 - listenedDays) * 0.25;

  // Liked albums can resurface after a while, but not immediately
  if ((prefs.liked[album.id] ?? 0) > 0 && listenedDays > 60) {
    score += 0.8;
  }

  // Exploration vs exploitation: as feedback grows, sharpen preferences
  const sharpness = Math.min(1.5, 0.4 + prefs.totalFeedback * 0.04);
  // Convert raw score; keep a floor so low scores still have a chance
  return Math.max(0.05, Math.pow(Math.max(score, 0.05), sharpness));
}

/** Weighted random pick. Excludes forceExclude ids. */
export function pickAlbum(
  prefs: PreferenceState,
  options?: { forceExclude?: string[]; rng?: () => number },
): Album {
  const rng = options?.rng ?? Math.random;
  const exclude = new Set([
    ...(options?.forceExclude ?? []),
    ...prefs.disliked,
  ]);

  const candidates = ALBUMS.filter((a) => !exclude.has(a.id));
  const pool = candidates.length > 0 ? candidates : ALBUMS;

  const weights = pool.map((a) => scoreAlbum(a, prefs));
  const total = weights.reduce((s, w) => s + Math.max(w, 0), 0);

  if (total <= 0) {
    return pool[Math.floor(rng() * pool.length)]!;
  }

  let r = rng() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= Math.max(weights[i]!, 0);
    if (r <= 0) return pool[i]!;
  }
  return pool[pool.length - 1]!;
}

export function getStickyOrPick(
  prefs: PreferenceState,
  dateKey: string,
  reshuffle = false,
): { album: Album; prefs: PreferenceState; isNew: boolean } {
  if (!reshuffle && prefs.dailyPick[dateKey]) {
    const existing = ALBUMS.find((a) => a.id === prefs.dailyPick[dateKey]);
    if (existing && !prefs.disliked.includes(existing.id)) {
      return { album: existing, prefs, isNew: false };
    }
  }

  const exclude = reshuffle && prefs.dailyPick[dateKey]
    ? [prefs.dailyPick[dateKey]]
    : [];
  const album = pickAlbum(prefs, { forceExclude: exclude });
  const nextPrefs = {
    ...prefs,
    suggested: {
      ...prefs.suggested,
      [album.id]: new Date().toISOString(),
    },
    dailyPick: {
      ...prefs.dailyPick,
      [dateKey]: album.id,
    },
  };
  return { album, prefs: nextPrefs, isNew: true };
}
