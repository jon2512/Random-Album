"use client";

import { useEffect, useState, useTransition } from "react";
import type { Album } from "@/data/albums";
import ProfilePicker from "@/components/ProfilePicker";
import {
  appleMusicSearchUrl,
  fetchAlbumMeta,
  spotifySearchUrl,
  type AlbumMeta,
} from "@/lib/links";
import {
  applyFeedback,
  todayKey,
  topTasteSummary,
  type PreferenceState,
} from "@/lib/preferences";
import {
  getActiveProfile,
  loadStore,
  saveStore,
  updateActivePreferences,
  type Profile,
  type ProfileStore,
} from "@/lib/profiles";
import { getStickyOrPick } from "@/lib/recommend";

type Phase = "boot" | "pick-profile" | "idle" | "revealed";

function albumPhaseForPrefs(prefs: PreferenceState): {
  album: Album | null;
  phase: "idle" | "revealed";
} {
  const date = todayKey();
  if (prefs.dailyPick[date]) {
    const { album } = getStickyOrPick(prefs, date, false);
    return { album, phase: "revealed" };
  }
  return { album: null, phase: "idle" };
}

export default function SpinApp() {
  const [hydrated, setHydrated] = useState(false);
  const [store, setStore] = useState<ProfileStore | null>(null);
  const [phase, setPhase] = useState<Phase>("boot");
  const [album, setAlbum] = useState<Album | null>(null);
  const [meta, setMeta] = useState<AlbumMeta | null>(null);
  const [metaForId, setMetaForId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [, startTransition] = useTransition();

  const active: Profile | null = store ? getActiveProfile(store) : null;
  const prefs = active?.preferences ?? null;

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const loaded = loadStore();
      setStore(loaded);
      const profile = getActiveProfile(loaded);
      if (!profile) {
        setPhase("pick-profile");
      } else {
        const { album: a, phase: p } = albumPhaseForPrefs(profile.preferences);
        setAlbum(a);
        setPhase(p);
      }
      setHydrated(true);
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

  function persistStore(next: ProfileStore) {
    setStore(next);
    saveStore(next);
  }

  function persistPrefs(nextPrefs: PreferenceState) {
    if (!store) return;
    persistStore(updateActivePreferences(store, nextPrefs));
  }

  function onStoreChange(next: ProfileStore) {
    persistStore(next);
    const profile = getActiveProfile(next);
    if (!profile) {
      setAlbum(null);
      setMeta(null);
      setMetaForId(null);
      setPhase("pick-profile");
      return;
    }
    const { album: a, phase: p } = albumPhaseForPrefs(profile.preferences);
    setAlbum(a);
    setMeta(null);
    setMetaForId(null);
    setPhase(p);
  }

  function showFlash(message: string) {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 2200);
  }

  function spin(reshuffle = false) {
    if (!prefs || !store) return;
    setSpinning(true);
    startTransition(() => {
      window.setTimeout(() => {
        const date = todayKey();
        const result = getStickyOrPick(prefs, date, reshuffle);
        persistPrefs(result.prefs);
        setAlbum(result.album);
        setPhase("revealed");
        setSpinning(false);
      }, 650);
    });
  }

  function onListened() {
    if (!prefs || !album) return;
    persistPrefs(applyFeedback(prefs, album, "listened"));
    showFlash("Logged — taste updated.");
  }

  function onDislike() {
    if (!prefs || !album) return;
    const next = applyFeedback(prefs, album, "dislike");
    const date = todayKey();
    const cleared = {
      ...next,
      dailyPick: { ...next.dailyPick },
    };
    delete cleared.dailyPick[date];
    persistPrefs(cleared);
    showFlash("Got it — won't push that again.");
    setAlbum(null);
    setMeta(null);
    setMetaForId(null);
    setPhase("idle");
  }

  function onSkip() {
    if (!prefs || !album) return;
    persistPrefs(applyFeedback(prefs, album, "skip"));
    spin(true);
  }

  if (!hydrated || phase === "boot" || !store) {
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

  return (
    <main
      className={`shell ${phase === "revealed" ? "shell--revealed" : ""}`}
    >
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
          {active && phase !== "pick-profile" && (
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
          {phase !== "pick-profile" && <p className="taste">{taste}</p>}
        </div>
      </header>

      {phase === "pick-profile" && (
        <ProfilePicker store={store} onChange={onStoreChange} />
      )}

      {phase === "idle" && (
        <section className="hero hero--idle">
          <h1 className="headline">Your album for the drive.</h1>
          <p className="sub">
            One suggestion. Tell it what you liked — it learns for tomorrow.
          </p>
          <button
            type="button"
            className={`spin-btn ${spinning ? "is-spinning" : ""}`}
            onClick={() => spin(false)}
            disabled={spinning}
          >
            <span className="spin-btn__ring" aria-hidden />
            <span className="spin-btn__label">
              {spinning ? "Finding…" : "Spin today’s album"}
            </span>
          </button>
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
              {album.year}
              <span aria-hidden> · </span>
              {album.genres.slice(0, 2).join(" / ")}
            </p>
          </div>

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
        </section>
      )}

      {flash && <div className="toast" role="status">{flash}</div>}
    </main>
  );
}
