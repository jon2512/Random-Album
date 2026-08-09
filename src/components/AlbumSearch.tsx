"use client";

import { useDeferredValue, useEffect, useState, useTransition } from "react";
import {
  appleMusicSearchUrl,
  spotifySearchUrl,
} from "@/lib/links";
import {
  enrichSearchHit,
  searchAlbums,
  type SearchHit,
} from "@/lib/search";

type Props = {
  onLike: (hit: SearchHit) => void;
  onDislike: (hit: SearchHit) => void;
  onBack: () => void;
  likedIds: Set<string>;
};

export default function AlbumSearch({
  onLike,
  onDislike,
  onBack,
  likedIds,
}: Props) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [resultQuery, setResultQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const trimmed = deferredQuery.trim();
  const loading = trimmed.length >= 2 && resultQuery !== trimmed;

  useEffect(() => {
    let cancelled = false;
    if (trimmed.length < 2) {
      const frame = requestAnimationFrame(() => {
        startTransition(() => {
          setHits([]);
          setResultQuery(trimmed);
        });
      });
      return () => {
        cancelled = true;
        cancelAnimationFrame(frame);
      };
    }

    const timer = window.setTimeout(() => {
      searchAlbums(trimmed).then((results) => {
        if (cancelled) return;
        startTransition(() => {
          setHits(results);
          setResultQuery(trimmed);
        });
      });
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed]);

  async function handleLike(hit: SearchHit) {
    setBusyId(hit.album.id);
    try {
      const enriched = await enrichSearchHit(hit);
      onLike(enriched);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDislike(hit: SearchHit) {
    setBusyId(hit.album.id);
    try {
      const enriched = await enrichSearchHit(hit);
      onDislike(enriched);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="hero hero--search">
      <div className="search-head">
        <button type="button" className="search-back" onClick={onBack}>
          ← Back
        </button>
        <h1 className="headline headline--search">Find an album</h1>
        <p className="sub">
          Search anything you’ve been meaning to log — mark it liked to teach
          SPIN.
        </p>
      </div>

      <label className="search-label" htmlFor="album-search">
        Search
      </label>
      <input
        id="album-search"
        className="search-input"
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Artist or album"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus
      />

      <div className="search-status" aria-live="polite">
        {loading || isPending
          ? "Searching…"
          : trimmed.length >= 2 && hits.length === 0
            ? "No matches — try another spelling."
            : null}
      </div>

      <ul className="search-results">
        {hits.map((hit) => {
          const liked = likedIds.has(hit.album.id);
          const busy = busyId === hit.album.id;
          return (
            <li key={`${hit.source}-${hit.album.id}`} className="search-row">
              <div className="search-row__art" aria-hidden>
                {hit.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hit.artworkUrl} alt="" width={56} height={56} />
                ) : (
                  <span>{hit.album.artist.slice(0, 1)}</span>
                )}
              </div>
              <div className="search-row__copy">
                <p className="search-row__title">{hit.album.title}</p>
                <p className="search-row__artist">{hit.album.artist}</p>
                <div className="search-row__links">
                  <a
                    href={spotifySearchUrl(hit.album)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Spotify
                  </a>
                  <a
                    href={appleMusicSearchUrl(hit.album)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Apple
                  </a>
                  {hit.source === "catalog" && (
                    <span className="search-row__badge">In spin library</span>
                  )}
                </div>
              </div>
              <div className="search-row__actions">
                <button
                  type="button"
                  className="fb fb--yes"
                  disabled={busy || liked}
                  onClick={() => handleLike(hit)}
                >
                  {liked ? "Liked" : busy ? "…" : "I like this"}
                </button>
                <button
                  type="button"
                  className="fb fb--no"
                  disabled={busy}
                  onClick={() => handleDislike(hit)}
                >
                  Not for me
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
