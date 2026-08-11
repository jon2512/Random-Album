import {
  emptyPreferences,
  LEGACY_PREFS_KEY,
  type PreferenceState,
} from "@/lib/preferences";

const STORE_KEY = "spin-profiles-v1";
export const MAX_PROFILES = 8;

export const PROFILE_COLORS = [
  "#f0a202",
  "#6fc4b2",
  "#e07a6a",
  "#8bb7e0",
] as const;

export type Profile = {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  preferences: PreferenceState;
};

export type ProfileStore = {
  activeId: string | null;
  profiles: Profile[];
};

export function emptyStore(): ProfileStore {
  return { activeId: null, profiles: [] };
}

function uid(): string {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function loadStore(): ProfileStore {
  if (typeof window === "undefined") return emptyStore();

  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ProfileStore;
      return {
        activeId: parsed.activeId ?? null,
        profiles: Array.isArray(parsed.profiles) ? parsed.profiles.slice(0, MAX_PROFILES) : [],
      };
    }
  } catch {
    /* migrate below */
  }

  // Migrate single-user prefs into a first profile
  try {
    const legacy = localStorage.getItem(LEGACY_PREFS_KEY);
    if (legacy) {
      const preferences = {
        ...emptyPreferences(),
        ...JSON.parse(legacy),
      } as PreferenceState;
      const profile: Profile = {
        id: uid(),
        name: "Me",
        color: PROFILE_COLORS[0],
        createdAt: new Date().toISOString(),
        preferences,
      };
      const store: ProfileStore = { activeId: profile.id, profiles: [profile] };
      saveStore(store);
      localStorage.removeItem(LEGACY_PREFS_KEY);
      return store;
    }
  } catch {
    /* ignore */
  }

  return emptyStore();
}

export function saveStore(store: ProfileStore): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORE_KEY, JSON.stringify(store));
}

export function getActiveProfile(store: ProfileStore): Profile | null {
  if (!store.activeId) return null;
  return store.profiles.find((p) => p.id === store.activeId) ?? null;
}

export function createProfile(
  store: ProfileStore,
  name: string,
): ProfileStore {
  if (store.profiles.length >= MAX_PROFILES) return store;
  const trimmed = name.trim().slice(0, 18) || `Driver ${store.profiles.length + 1}`;
  const color =
    PROFILE_COLORS[store.profiles.length % PROFILE_COLORS.length] ??
    PROFILE_COLORS[0];
  const profile: Profile = {
    id: uid(),
    name: trimmed,
    color,
    createdAt: new Date().toISOString(),
    preferences: emptyPreferences(),
  };
  return {
    activeId: profile.id,
    profiles: [...store.profiles, profile],
  };
}

export function selectProfile(store: ProfileStore, id: string): ProfileStore {
  if (!store.profiles.some((p) => p.id === id)) return store;
  return { ...store, activeId: id };
}

export function renameProfile(
  store: ProfileStore,
  id: string,
  name: string,
): ProfileStore {
  const trimmed = name.trim().slice(0, 18);
  if (!trimmed) return store;
  return {
    ...store,
    profiles: store.profiles.map((p) =>
      p.id === id ? { ...p, name: trimmed } : p,
    ),
  };
}

export function deleteProfile(store: ProfileStore, id: string): ProfileStore {
  const profiles = store.profiles.filter((p) => p.id !== id);
  const activeId =
    store.activeId === id ? (profiles[0]?.id ?? null) : store.activeId;
  return { activeId, profiles };
}

export function updateActivePreferences(
  store: ProfileStore,
  preferences: PreferenceState,
): ProfileStore {
  if (!store.activeId) return store;
  return {
    ...store,
    profiles: store.profiles.map((p) =>
      p.id === store.activeId ? { ...p, preferences } : p,
    ),
  };
}
