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
  const ai = prefs.aiAlbums ?? [];
  const byId = new Map<string, Album>();
  for (const a of ALBUMS) byId.set(a.id, a);
  for (const a of customs) if (!byId.has(a.id)) byId.set(a.id, a);
  for (const a of ai) if (!byId.has(a.id)) byId.set(a.id, a);
  return [...byId.values()];
}

function recentSuggestedIds(prefs: PreferenceState, withinDays: number): string[] {
  return Object.entries(prefs.suggested ?? {})
    .filter(([, iso]) => daysSince(iso) < withinDays)
    .map(([id]) => id);
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
  const fromAi = (prefs.aiAlbums ?? []).some((a) => a.id === album.id);

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
  if (suggestedDays === Infinity) score += fromAi ? 6 : 1.8;
  else if (suggestedDays < 45) score -= (45 - suggestedDays) * 0.55;
  if (suggestedDays < 7) score *= 0.08;

  const listenedDays = daysSince(prefs.listened[album.id]);
  if (listenedDays < 45) score -= (45 - listenedDays) * 0.35;
  if (listenedDays < 14) score *= 0.15;

  if ((prefs.liked[album.id] ?? 0) > 0 && listenedDays > 60) {
    score += 0.8;
  }

  // Prefer fresh AI suggestions so spins don't stay stuck in the curated set
  if (fromAi && suggestedDays === Infinity) score += 8;

  const sharpness = Math.min(1.5, 0.4 + prefs.totalFeedback * 0.04);
  return Math.max(0.02, Math.pow(Math.max(score, 0.02), sharpness));
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

  // Prefer never-suggested AI albums when we have a fresh set
  const freshAi = candidates.filter(
    (a) =>
      (prefs.aiAlbums ?? []).some((x) => x.id === a.id) &&
      !prefs.suggested[a.id],
  );
  if (freshAi.length >= 3) candidates = freshAi;

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

  const exclude = [
    ...(reshuffle && prefs.dailyPick[key] ? [prefs.dailyPick[key]] : []),
    // When asking for another, also skip recently shown albums
    ...(reshuffle ? recentSuggestedIds(prefs, 21) : []),
  ];
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
