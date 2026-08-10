import { emptyPreferences, type PreferenceState } from "@/lib/preferences";
import type { Profile } from "@/lib/profiles";

const API_URL_KEY = "spin-api-url";
const ROOM_CODE_KEY = "spin-room-code";
const ACTIVE_ID_KEY = "spin-active-profile-id";

export type RoomSession = {
  apiUrl: string;
  roomCode: string;
};

export type JoinResult = {
  code: string;
  profiles: Profile[];
  maxProfiles: number;
};

function normalizeApiUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

function normalizeCode(code: string): string {
  return code
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

export async function loadDefaultApiUrl(): Promise<string> {
  if (typeof window === "undefined") return "";
  const saved = localStorage.getItem(API_URL_KEY);
  if (saved) return saved;
  try {
    const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const res = await fetch(`${base}/config.json`, { cache: "no-store" });
    if (!res.ok) return "";
    const json = (await res.json()) as { apiUrl?: string };
    return json.apiUrl ? normalizeApiUrl(json.apiUrl) : "";
  } catch {
    return "";
  }
}

export function loadSession(): RoomSession | null {
  if (typeof window === "undefined") return null;
  const apiUrl = localStorage.getItem(API_URL_KEY);
  const roomCode = localStorage.getItem(ROOM_CODE_KEY);
  if (!apiUrl || !roomCode) return null;
  return { apiUrl: normalizeApiUrl(apiUrl), roomCode: normalizeCode(roomCode) };
}

export function saveSession(session: RoomSession): void {
  localStorage.setItem(API_URL_KEY, normalizeApiUrl(session.apiUrl));
  localStorage.setItem(ROOM_CODE_KEY, normalizeCode(session.roomCode));
}

export function clearSession(): void {
  localStorage.removeItem(ROOM_CODE_KEY);
  localStorage.removeItem(ACTIVE_ID_KEY);
}

export function loadActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_ID_KEY);
}

export function saveActiveProfileId(id: string | null): void {
  if (id) localStorage.setItem(ACTIVE_ID_KEY, id);
  else localStorage.removeItem(ACTIVE_ID_KEY);
}

async function api<T>(
  session: RoomSession,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${session.apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`,
    );
  }
  return data as T;
}

function hydrateProfile(raw: Profile): Profile {
  return {
    ...raw,
    preferences: {
      ...emptyPreferences(),
      ...(raw.preferences || {}),
      customAlbums: raw.preferences?.customAlbums ?? [],
      aiAlbums: raw.preferences?.aiAlbums ?? [],
      aiAlbumsUpdatedAt: raw.preferences?.aiAlbumsUpdatedAt ?? null,
    },
  };
}

export async function healthCheck(apiUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${normalizeApiUrl(apiUrl)}/health`, {
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function joinRoom(
  apiUrl: string,
  roomCode: string,
): Promise<JoinResult> {
  const session = {
    apiUrl: normalizeApiUrl(apiUrl),
    roomCode: normalizeCode(roomCode),
  };
  const result = await api<JoinResult>(session, "/api/rooms/join", {
    method: "POST",
    body: JSON.stringify({ code: session.roomCode }),
  });
  saveSession(session);
  return {
    ...result,
    profiles: result.profiles.map(hydrateProfile),
  };
}

export async function fetchProfiles(session: RoomSession): Promise<Profile[]> {
  const result = await api<{ profiles: Profile[] }>(
    session,
    `/api/rooms/${encodeURIComponent(session.roomCode)}/profiles`,
  );
  return result.profiles.map(hydrateProfile);
}

export async function createRemoteProfile(
  session: RoomSession,
  name: string,
): Promise<Profile> {
  const profile = await api<Profile>(
    session,
    `/api/rooms/${encodeURIComponent(session.roomCode)}/profiles`,
    {
      method: "POST",
      body: JSON.stringify({ name }),
    },
  );
  return hydrateProfile(profile);
}

export async function renameRemoteProfile(
  session: RoomSession,
  id: string,
  name: string,
): Promise<Profile> {
  const profile = await api<Profile>(
    session,
    `/api/rooms/${encodeURIComponent(session.roomCode)}/profiles/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ name }),
    },
  );
  return hydrateProfile(profile);
}

export async function deleteRemoteProfile(
  session: RoomSession,
  id: string,
): Promise<void> {
  await api(
    session,
    `/api/rooms/${encodeURIComponent(session.roomCode)}/profiles/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

export async function syncPreferences(
  session: RoomSession,
  profileId: string,
  preferences: PreferenceState,
): Promise<Profile> {
  const profile = await api<Profile>(
    session,
    `/api/rooms/${encodeURIComponent(session.roomCode)}/profiles/${encodeURIComponent(profileId)}/preferences`,
    {
      method: "PUT",
      body: JSON.stringify({ preferences }),
    },
  );
  return hydrateProfile(profile);
}

export type InspirationProfile = {
  id: string;
  name: string;
  color: string;
  liked: Record<string, number>;
  disliked: string[];
  listened: Record<string, string>;
  customAlbums: import("@/data/albums").Album[];
};

export async function fetchInspiration(
  session: RoomSession,
  excludeProfileId: string | null,
): Promise<InspirationProfile[]> {
  const q = excludeProfileId
    ? `?exclude=${encodeURIComponent(excludeProfileId)}`
    : "";
  const result = await api<{ profiles: InspirationProfile[] }>(
    session,
    `/api/rooms/${encodeURIComponent(session.roomCode)}/inspiration${q}`,
  );
  return result.profiles;
}

export type AlbumRef = { title: string; artist: string };

export type AiSuggestResult = {
  albums: import("@/data/albums").Album[];
  generatedAt: string;
  model: string;
  profile: Profile;
};

/** Ask the NAS API to refresh Gemini suggestions for this profile. */
export async function refreshAiSuggestions(
  session: RoomSession,
  profileId: string,
  payload: {
    likes: AlbumRef[];
    dislikes: AlbumRef[];
    avoid: AlbumRef[];
  },
): Promise<AiSuggestResult> {
  const result = await api<AiSuggestResult>(
    session,
    `/api/rooms/${encodeURIComponent(session.roomCode)}/profiles/${encodeURIComponent(profileId)}/ai-suggest`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return {
    ...result,
    profile: hydrateProfile(result.profile),
  };
}
