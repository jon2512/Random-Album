"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Album } from "@/data/albums";
import AlbumSearch from "@/components/AlbumSearch";
import FriendsLikes from "@/components/FriendsLikes";
import ModeSelector from "@/components/ModeSelector";
import ProfilePicker from "@/components/ProfilePicker";
import RoomJoin from "@/components/RoomJoin";
import {
  clearSession,
  createRemoteProfile,
  deleteRemoteProfile,
  fetchInspiration,
  fetchProfiles,
  loadActiveProfileId,
  loadSession,
  renameRemoteProfile,
  saveActiveProfileId,
  syncPreferences,
  type InspirationProfile,
  type JoinResult,
  type RoomSession,
} from "@/lib/api";
import {
  appleMusicSearchUrl,
  fetchAlbumMeta,
  spotifySearchUrl,
  type AlbumMeta,
} from "@/lib/links";
import {
  inspirationToLists,
  type ProfileLikedList,
} from "@/lib/likes";
import { isSpinMode, modeLabel, type SpinMode } from "@/lib/modes";
import {
  applyFeedback,
  rememberAlbum,
  todayKey,
  topTasteSummary,
  type PreferenceState,
} from "@/lib/preferences";
import {
  emptyStore,
  getActiveProfile,
  type Profile,
  type ProfileStore,
} from "@/lib/profiles";
import { getStickyOrPick, pickKey } from "@/lib/recommend";
import type { SearchHit } from "@/lib/search";

type Phase =
  | "boot"
  | "join-room"
  | "pick-profile"
  | "idle"
  | "revealed"
  | "search"
  | "inspire";

function currentMode(prefs: PreferenceState): SpinMode {
  return isSpinMode(prefs.activeMode) ? prefs.activeMode : "any";
}

function albumPhaseForPrefs(prefs: PreferenceState): {
  album: Album | null;
  phase: "idle" | "revealed";
} {
  const date = todayKey();
  const mode = currentMode(prefs);
  const key = pickKey(date, mode);
  if (prefs.dailyPick[key]) {
    const { album } = getStickyOrPick(prefs, date, false, mode);
    return { album, phase: "revealed" };
  }
  return { album: null, phase: "idle" };
}

export default function SpinApp() {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSession] = useState<RoomSession | null>(null);
  const [store, setStore] = useState<ProfileStore>(emptyStore());
  const [maxProfiles, setMaxProfiles] = useState(8);
  const [phase, setPhase] = useState<Phase>("boot");
  const [returnPhase, setReturnPhase] = useState<"idle" | "revealed">("idle");
  const [album, setAlbum] = useState<Album | null>(null);
  const [meta, setMeta] = useState<AlbumMeta | null>(null);
  const [metaForId, setMetaForId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspireLists, setInspireLists] = useState<ProfileLikedList[]>([]);
  const [inspireLoading, setInspireLoading] = useState(false);
  const [, startTransition] = useTransition();
  const syncTimer = useRef<number | null>(null);

  const active: Profile | null = getActiveProfile(store);
  const prefs = active?.preferences ?? null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const existing = loadSession();
      if (!existing) {
        setPhase("join-room");
        setHydrated(true);
        return;
      }
      setSession(existing);
      fetchProfiles(existing)
        .then((profiles) => {
          const activeId = loadActiveProfileId();
          const validActive =
            activeId && profiles.some((p) => p.id === activeId)
              ? activeId
              : null;
          setStore({ activeId: validActive, profiles });
          if (!validActive) {
            setPhase("pick-profile");
          } else {
            const profile = profiles.find((p) => p.id === validActive)!;
            const { album: a, phase: p } = albumPhaseForPrefs(
              profile.preferences,
            );
            setAlbum(a);
            setPhase(p);
            setReturnPhase(p);
          }
        })
        .catch(() => {
          clearSession();
          setSession(null);
          setPhase("join-room");
        })
        .finally(() => setHydrated(true));
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!album) return;
    let cancelled = false;
    fetchAlbumMeta(album).then((m) => {
      if (cancelled) return;
      setMeta(m);
      setMetaForId(album.id);
    });
    return () => {
      cancelled = true;
    };
  }, [album]);

  function showFlash(message: string) {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 2200);
  }

  function queueSync(profileId: string, preferences: PreferenceState) {
    if (!session) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncPreferences(session, profileId, preferences).catch(() => {
        showFlash("Couldn’t sync to NAS — will retry on next change.");
      });
    }, 350);
  }

  function setLocalPrefs(nextPrefs: PreferenceState) {
    if (!store.activeId) return;
    setStore((prev) => ({
      ...prev,
      profiles: prev.profiles.map((p) =>
        p.id === prev.activeId ? { ...p, preferences: nextPrefs } : p,
      ),
    }));
    queueSync(store.activeId, nextPrefs);
  }

  function enterWithProfile(profile: Profile, profiles: Profile[]) {
    saveActiveProfileId(profile.id);
    setStore({ activeId: profile.id, profiles });
    const { album: a, phase: p } = albumPhaseForPrefs(profile.preferences);
    setAlbum(a);
    setMeta(null);
    setMetaForId(null);
    setPhase(p);
    setReturnPhase(p);
    setError(null);
  }

  function onJoined(result: JoinResult, apiUrl: string) {
    const nextSession = { apiUrl, roomCode: result.code };
    setSession(nextSession);
    setMaxProfiles(result.maxProfiles);
    setStore({ activeId: null, profiles: result.profiles });
    saveActiveProfileId(null);
    setPhase("pick-profile");
  }

  async function refreshProfiles(activeId?: string | null) {
    if (!session) return;
    const profiles = await fetchProfiles(session);
    const id = activeId === undefined ? store.activeId : activeId;
    const valid = id && profiles.some((p) => p.id === id) ? id : null;
    setStore({ activeId: valid, profiles });
    return { profiles, activeId: valid };
  }

  async function onSelectProfile(id: string) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const profiles = await fetchProfiles(session);
      const profile = profiles.find((p) => p.id === id);
      if (!profile) throw new Error("Profile not found.");
      enterWithProfile(profile, profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t select profile.");
    } finally {
      setBusy(false);
    }
  }

  async function onCreateProfile(name: string) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createRemoteProfile(session, name);
      const profiles = await fetchProfiles(session);
      enterWithProfile(
        profiles.find((p) => p.id === created.id) ?? created,
        profiles,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t create profile.");
    } finally {
      setBusy(false);
    }
  }

  async function onRenameProfile(id: string, name: string) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await renameRemoteProfile(session, id, name);
      await refreshProfiles(store.activeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t rename.");
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteProfile(id: string) {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await deleteRemoteProfile(session, id);
      if (store.activeId === id) saveActiveProfileId(null);
      const { profiles, activeId } = (await refreshProfiles(
        store.activeId === id ? null : store.activeId,
      ))!;
      if (!activeId) {
        setAlbum(null);
        setPhase("pick-profile");
      } else {
        const profile = profiles.find((p) => p.id === activeId)!;
        enterWithProfile(profile, profiles);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t delete.");
    } finally {
      setBusy(false);
    }
  }

  function leaveRoom() {
    clearSession();
    setSession(null);
    setStore(emptyStore());
    setAlbum(null);
    setPhase("join-room");
  }

  function openSearch() {
    setReturnPhase(phase === "revealed" ? "revealed" : "idle");
    setPhase("search");
  }

  async function openInspire() {
    setReturnPhase(phase === "revealed" ? "revealed" : "idle");
    setPhase("inspire");
    if (!session) return;
    setInspireLoading(true);
    try {
      const remote: InspirationProfile[] = await fetchInspiration(
        session,
        store.activeId,
      );
      setInspireLists(inspirationToLists(remote));
    } catch {
      setInspireLists([]);
      showFlash("Couldn’t load friends’ lists.");
    } finally {
      setInspireLoading(false);
    }
  }

  function closeOverlay() {
    if (returnPhase === "revealed" && album) setPhase("revealed");
    else setPhase("idle");
  }

  function spin(reshuffle = false, modeOverride?: SpinMode) {
    if (!prefs) return;
    const mode = modeOverride ?? currentMode(prefs);
    setSpinning(true);
    startTransition(() => {
      window.setTimeout(() => {
        const date = todayKey();
        const result = getStickyOrPick(prefs, date, reshuffle, mode);
        setLocalPrefs(result.prefs);
        setAlbum(result.album);
        setPhase("revealed");
        setReturnPhase("revealed");
        setSpinning(false);
      }, 650);
    });
  }

  function onModeChange(mode: SpinMode) {
    if (!prefs) return;
    if (currentMode(prefs) === mode) return;
    const next = { ...prefs, activeMode: mode };
    setLocalPrefs(next);
    // Switching mode goes back to idle so they can spin for that mood
    setAlbum(null);
    setMeta(null);
    setMetaForId(null);
    setPhase("idle");
    setReturnPhase("idle");
  }

  function onListened() {
    if (!prefs || !album) return;
    setLocalPrefs(applyFeedback(prefs, album, "listened"));
    showFlash("Logged — taste updated.");
  }

  function onDislike() {
    if (!prefs || !album) return;
    const mode = currentMode(prefs);
    const next = applyFeedback(prefs, album, "dislike");
    const date = todayKey();
    const key = pickKey(date, mode);
    const cleared = { ...next, dailyPick: { ...next.dailyPick } };
    delete cleared.dailyPick[key];
    setLocalPrefs(cleared);
    showFlash("Got it — won't push that again.");
    setAlbum(null);
    setMeta(null);
    setMetaForId(null);
    setPhase("idle");
    setReturnPhase("idle");
  }

  function onSkip() {
    if (!prefs || !album) return;
    setLocalPrefs(applyFeedback(prefs, album, "skip"));
    spin(true);
  }

  function onSearchLike(hit: SearchHit) {
    if (!prefs) return;
    let next = rememberAlbum(prefs, hit.album);
    next = applyFeedback(next, hit.album, "listened");
    setLocalPrefs(next);
    showFlash(`Liked ${hit.album.title}.`);
  }

  function onSearchDislike(hit: SearchHit) {
    if (!prefs) return;
    let next = rememberAlbum(prefs, hit.album);
    next = applyFeedback(next, hit.album, "dislike");
    setLocalPrefs(next);
    showFlash("Noted — steering away.");
  }

  function onFriendLike(albumToLike: Album) {
    if (!prefs) return;
    let next = rememberAlbum(prefs, albumToLike);
    next = applyFeedback(next, albumToLike, "listened");
    setLocalPrefs(next);
    showFlash(`Liked ${albumToLike.title}.`);
  }

  if (!hydrated || phase === "boot") {
    return (
      <main className="shell">
        <div className="boot">Loading…</div>
      </main>
    );
  }

  const taste = prefs ? topTasteSummary(prefs) : "";
  const artwork =
    album && metaForId === album.id ? meta?.artworkUrl ?? null : null;
  const appleUrl =
    album && metaForId === album.id && meta?.appleMusicUrl
      ? meta.appleMusicUrl
      : album
        ? appleMusicSearchUrl(album)
        : "#";
  const spotifyUrl = album ? spotifySearchUrl(album) : "#";
  const metaLoading = !!album && metaForId !== album.id;
  const likedIds = new Set(Object.keys(prefs?.liked ?? {}));
  const dislikedIds = new Set(prefs?.disliked ?? []);
  const mode: SpinMode = prefs ? currentMode(prefs) : "any";

  return (
    <main className={`shell ${phase === "revealed" ? "shell--revealed" : ""}`}>
      <div className="atmosphere" aria-hidden />
      <div className="grain" aria-hidden />

      {artwork && phase === "revealed" && (
        <div
          className="cover-bleed"
          style={{ backgroundImage: `url(${artwork})` }}
          aria-hidden
        />
      )}

      <header className="top">
        <p className="brand">SPIN</p>
        <div className="top-right">
          {active &&
            phase !== "join-room" &&
            phase !== "pick-profile" && (
              <button
                type="button"
                className="profile-chip"
                onClick={() => {
                  setPhase("pick-profile");
                  setAlbum(null);
                  setMeta(null);
                  setMetaForId(null);
                }}
                title="Switch profile"
              >
                <span
                  className="profile-chip__dot"
                  style={{ background: active.color }}
                  aria-hidden
                />
                {active.name}
              </button>
            )}
          {session && phase !== "join-room" && (
            <p className="room-pill">{session.roomCode.toLowerCase()}</p>
          )}
          {phase !== "join-room" &&
            phase !== "pick-profile" &&
            phase !== "search" &&
            phase !== "inspire" && <p className="taste">{taste}</p>}
        </div>
      </header>

      {phase === "join-room" && <RoomJoin onJoined={onJoined} />}

      {phase === "pick-profile" && (
        <ProfilePicker
          store={store}
          roomCode={session?.roomCode}
          maxProfiles={maxProfiles}
          busy={busy}
          error={error}
          onSelect={onSelectProfile}
          onCreate={onCreateProfile}
          onRename={onRenameProfile}
          onDelete={onDeleteProfile}
          onLeaveRoom={leaveRoom}
        />
      )}

      {phase === "search" && (
        <AlbumSearch
          onLike={onSearchLike}
          onDislike={onSearchDislike}
          onBack={closeOverlay}
          likedIds={likedIds}
        />
      )}

      {phase === "inspire" && (
        <FriendsLikes
          lists={inspireLists}
          myLikedIds={likedIds}
          myDislikedIds={dislikedIds}
          onLike={onFriendLike}
          onBack={closeOverlay}
          loading={inspireLoading}
        />
      )}

      {phase === "idle" && (
        <section className="hero hero--idle">
          <h1 className="headline">Your album for the drive.</h1>
          <p className="sub">
            Pick a mode, then spin. It learns what you love in each mood.
          </p>
          <ModeSelector
            value={mode}
            onChange={onModeChange}
            disabled={spinning}
          />
          <button
            type="button"
            className={`spin-btn ${spinning ? "is-spinning" : ""}`}
            onClick={() => spin(false)}
            disabled={spinning}
          >
            <span className="spin-btn__ring" aria-hidden />
            <span className="spin-btn__label">
              {spinning
                ? "Finding…"
                : mode === "any"
                  ? "Spin today’s album"
                  : `Spin ${modeLabel(mode).toLowerCase()}`}
            </span>
          </button>
          <div className="idle-links">
            <button type="button" className="text-link" onClick={openSearch}>
              Search an album you like
            </button>
            <button type="button" className="text-link" onClick={openInspire}>
              See what they’re into
            </button>
          </div>
        </section>
      )}

      {phase === "revealed" && album && (
        <section
          className={`hero hero--album ${spinning ? "is-swapping" : ""}`}
        >
          <div className="cover-wrap">
            {artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={album.id}
                className="cover"
                src={artwork}
                alt={`${album.title} cover`}
                width={600}
                height={600}
              />
            ) : (
              <div
                className={`cover cover--fallback ${metaLoading ? "is-loading" : ""}`}
              >
                <span>{album.artist.slice(0, 1)}</span>
              </div>
            )}
          </div>

          <div className="album-copy">
            <p className="album-artist">{album.artist}</p>
            <h1 className="album-title">{album.title}</h1>
            <p className="album-meta">
              {album.year > 0 ? album.year : "—"}
              <span aria-hidden> · </span>
              {album.genres.slice(0, 2).join(" / ") || "album"}
              {mode !== "any" && (
                <>
                  <span aria-hidden> · </span>
                  {modeLabel(mode)}
                </>
              )}
            </p>
          </div>

          <ModeSelector
            value={mode}
            onChange={onModeChange}
            disabled={spinning}
          />

          <div className="listen-links">
            <a
              className="link-btn link-btn--spotify"
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Spotify
            </a>
            <a
              className="link-btn link-btn--apple"
              href={appleUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Apple Music
            </a>
          </div>

          <div className="feedback">
            <button type="button" className="fb fb--yes" onClick={onListened}>
              I listened
            </button>
            <button type="button" className="fb fb--skip" onClick={onSkip}>
              Another
            </button>
            <button type="button" className="fb fb--no" onClick={onDislike}>
              Not for me
            </button>
          </div>

          <div className="idle-links">
            <button type="button" className="text-link" onClick={openSearch}>
              Search an album
            </button>
            <button type="button" className="text-link" onClick={openInspire}>
              See what they’re into
            </button>
          </div>
        </section>
      )}

      {flash && <div className="toast" role="status">{flash}</div>}
    </main>
  );
}
