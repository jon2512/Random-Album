"use client";

import { useEffect, useState, useTransition } from "react";
import type { Album } from "@/data/albums";
import {
  appleMusicSearchUrl,
  fetchAlbumMeta,
  spotifySearchUrl,
  type AlbumMeta,
} from "@/lib/links";
import {
  applyFeedback,
  loadPreferences,
  savePreferences,
  todayKey,
  topTasteSummary,
  type PreferenceState,
} from "@/lib/preferences";
import { getStickyOrPick } from "@/lib/recommend";

type Phase = "boot" | "idle" | "revealed";

type AppState = {
  prefs: PreferenceState;
  album: Album | null;
  phase: Phase;
};

function readClientState(): AppState {
  const loaded = loadPreferences();
  const date = todayKey();
  if (loaded.dailyPick[date]) {
    const { album } = getStickyOrPick(loaded, date, false);
    return { prefs: loaded, album, phase: "revealed" };
  }
  return { prefs: loaded, album: null, phase: "idle" };
}

export default function SpinApp() {
  const [hydrated, setHydrated] = useState(false);
  const [prefs, setPrefs] = useState<PreferenceState | null>(null);
  const [album, setAlbum] = useState<Album | null>(null);
  const [phase, setPhase] = useState<Phase>("boot");
  const [meta, setMeta] = useState<AlbumMeta | null>(null);
  const [metaForId, setMetaForId] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const initial = readClientState();
      setPrefs(initial.prefs);
      setAlbum(initial.album);
      setPhase(initial.phase);
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

  function persist(next: PreferenceState) {
    setPrefs(next);
    savePreferences(next);
  }

  function showFlash(message: string) {
    setFlash(message);
    window.setTimeout(() => setFlash(null), 2200);
  }

  function spin(reshuffle = false) {
    if (!prefs) return;
    setSpinning(true);
    startTransition(() => {
      window.setTimeout(() => {
        const date = todayKey();
        const result = getStickyOrPick(prefs, date, reshuffle);
        persist(result.prefs);
        setAlbum(result.album);
        setPhase("revealed");
        setSpinning(false);
      }, 650);
    });
  }

  function onListened() {
    if (!prefs || !album) return;
    const next = applyFeedback(prefs, album, "listened");
    persist(next);
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
    persist(cleared);
    showFlash("Got it — won't push that again.");
    setAlbum(null);
    setMeta(null);
    setMetaForId(null);
    setPhase("idle");
  }

  function onSkip() {
    if (!prefs || !album) return;
    const next = applyFeedback(prefs, album, "skip");
    persist(next);
    spin(true);
  }

  if (!hydrated || phase === "boot" || !prefs) {
    return (
      <main className="shell">
        <div className="boot">Loading…</div>
      </main>
    );
  }

  const taste = topTasteSummary(prefs);
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
        <p className="taste">{taste}</p>
      </header>

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
        <section className={`hero hero--album ${spinning ? "is-swapping" : ""}`}>
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
