import type { Album, Genre, Mood } from "@/data/albums";
import { decadeOf } from "@/data/albums";

/** Legacy key — migrated into profiles on first load */
export const LEGACY_PREFS_KEY = "spin-preferences-v1";

export type FeedbackKind = "listened" | "dislike" | "skip";

export type PreferenceState = {
  liked: Record<string, number>;
  disliked: string[];
  listened: Record<string, string>;
  suggested: Record<string, string>;
  genreScores: Partial<Record<Genre, number>>;
  moodScores: Partial<Record<Mood, number>>;
  decadeScores: Record<string, number>;
  artistScores: Record<string, number>;
  dailyPick: Record<string, string>;
  totalFeedback: number;
};

export function emptyPreferences(): PreferenceState {
  return {
    liked: {},
    disliked: [],
    listened: {},
    suggested: {},
    genreScores: {},
    moodScores: {},
    decadeScores: {},
    artistScores: {},
    dailyPick: {},
    totalFeedback: 0,
  };
}

function bump(
  map: Record<string, number>,
  key: string,
  delta: number,
): Record<string, number> {
  return { ...map, [key]: (map[key] ?? 0) + delta };
}

export function applyFeedback(
  state: PreferenceState,
  album: Album,
  kind: FeedbackKind,
): PreferenceState {
  const next: PreferenceState = {
    ...state,
    liked: { ...state.liked },
    disliked: [...state.disliked],
    listened: { ...state.listened },
    suggested: { ...state.suggested },
    genreScores: { ...state.genreScores },
    moodScores: { ...state.moodScores },
    decadeScores: { ...state.decadeScores },
    artistScores: { ...state.artistScores },
    dailyPick: { ...state.dailyPick },
    totalFeedback: state.totalFeedback + 1,
  };

  const today = new Date().toISOString();
  const decade = decadeOf(album.year);

  if (kind === "listened") {
    next.listened[album.id] = today;
    next.liked[album.id] = (next.liked[album.id] ?? 0) + 2;
    for (const g of album.genres) {
      next.genreScores[g] = (next.genreScores[g] ?? 0) + 2;
    }
    for (const m of album.moods) {
      next.moodScores[m] = (next.moodScores[m] ?? 0) + 1.5;
    }
    next.decadeScores = bump(next.decadeScores, decade, 1.5);
    next.artistScores = bump(next.artistScores, album.artist, 2.5);
  } else if (kind === "dislike") {
    if (!next.disliked.includes(album.id)) next.disliked.push(album.id);
    delete next.liked[album.id];
    for (const g of album.genres) {
      next.genreScores[g] = (next.genreScores[g] ?? 0) - 2.5;
    }
    for (const m of album.moods) {
      next.moodScores[m] = (next.moodScores[m] ?? 0) - 1.5;
    }
    next.decadeScores = bump(next.decadeScores, decade, -1.5);
    next.artistScores = bump(next.artistScores, album.artist, -3);
  } else {
    next.suggested[album.id] = today;
    for (const g of album.genres) {
      next.genreScores[g] = (next.genreScores[g] ?? 0) - 0.25;
    }
  }

  return next;
}

export function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function topTasteSummary(state: PreferenceState): string {
  const genres = Object.entries(state.genreScores)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([g]) => g);

  if (genres.length === 0) {
    return "Still learning your taste — keep spinning.";
  }
  if (genres.length === 1) {
    return `Leaning into ${genres[0]}.`;
  }
  return `Leaning into ${genres[0]} & ${genres[1]}.`;
}
