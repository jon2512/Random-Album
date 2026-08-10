import { ALBUMS, decadeOf, type Album } from "@/data/albums";
import type { PreferenceState } from "@/lib/preferences";
import type { SpinMode } from "@/lib/modes";

function daysSince(iso: string | undefined): number {
  if (!iso) return Infinity;
  const ms = Date.now() - new Date(iso).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

function albumPool(prefs: PreferenceState): Album[] {
  const customs = prefs.customAlbums ?? [];
  if (customs.length === 0) return ALBUMS;
  const ids = new Set(ALBUMS.map((a) => a.id));
  return [...ALBUMS, ...customs.filter((a) => !ids.has(a.id))];
}

export function pickKey(dateKey: string, mode: SpinMode): string {
  return mode === "any" ? dateKey : `${dateKey}:${mode}`;
}

function scoreAlbum(
  album: Album,
  prefs: PreferenceState,
  mode: SpinMode,
): number {
  if (prefs.disliked.includes(album.id)) return -Infinity;

  let score = 1;

  for (const g of album.genres) {
    score += (prefs.genreScores[g] ?? 0) * 1.4;
  }
  for (const m of album.moods) {
    score += (prefs.moodScores[m] ?? 0) * 1.1;
  }
  if (album.year > 0) {
    score += (prefs.decadeScores[decadeOf(album.year)] ?? 0) * 1.0;
  }
  score += (prefs.artistScores[album.artist] ?? 0) * 1.6;

  // Mode steering: prefer matching moods strongly
  if (mode !== "any") {
    if (album.moods.includes(mode)) score += 10;
    else score *= 0.12;
  }

  const suggestedDays = daysSince(prefs.suggested[album.id]);
  if (suggestedDays === Infinity) score += 1.2;
  else if (suggestedDays < 14) score -= (14 - suggestedDays) * 0.35;

  const listenedDays = daysSince(prefs.listened[album.id]);
  if (listenedDays < 30) score -= (30 - listenedDays) * 0.25;

  if ((prefs.liked[album.id] ?? 0) > 0 && listenedDays > 60) {
    score += 0.8;
  }

  const sharpness = Math.min(1.5, 0.4 + prefs.totalFeedback * 0.04);
  return Math.max(0.05, Math.pow(Math.max(score, 0.05), sharpness));
}

/** Weighted random pick. Excludes forceExclude ids. */
export function pickAlbum(
  prefs: PreferenceState,
  options?: {
    forceExclude?: string[];
    rng?: () => number;
    mode?: SpinMode;
  },
): Album {
  const rng = options?.rng ?? Math.random;
  const mode = options?.mode ?? "any";
  const exclude = new Set([
    ...(options?.forceExclude ?? []),
    ...prefs.disliked,
  ]);

  const all = albumPool(prefs);
  let candidates = all.filter((a) => !exclude.has(a.id));

  // Prefer a mood-matching pool when possible
  if (mode !== "any") {
    const matched = candidates.filter((a) => a.moods.includes(mode));
    if (matched.length >= 3) candidates = matched;
  }

  const pool = candidates.length > 0 ? candidates : all;

  const weights = pool.map((a) => scoreAlbum(a, prefs, mode));
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
  mode: SpinMode = "any",
): { album: Album; prefs: PreferenceState; isNew: boolean } {
  const key = pickKey(dateKey, mode);

  if (!reshuffle && prefs.dailyPick[key]) {
    const existing = albumPool(prefs).find((a) => a.id === prefs.dailyPick[key]);
    if (existing && !prefs.disliked.includes(existing.id)) {
      // If mode is set, sticky album should still roughly fit
      if (mode === "any" || existing.moods.includes(mode)) {
        return { album: existing, prefs, isNew: false };
      }
    }
  }

  const exclude =
    reshuffle && prefs.dailyPick[key] ? [prefs.dailyPick[key]] : [];
  const album = pickAlbum(prefs, { forceExclude: exclude, mode });
  const nextPrefs = {
    ...prefs,
    activeMode: mode,
    suggested: {
      ...prefs.suggested,
      [album.id]: new Date().toISOString(),
    },
    dailyPick: {
      ...prefs.dailyPick,
      [key]: album.id,
    },
  };
  return { album, prefs: nextPrefs, isNew: true };
}
