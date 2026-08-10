"use client";

import { useEffect, useState } from "react";
import type { Album } from "@/data/albums";
import {
  appleMusicSearchUrl,
  fetchAlbumMeta,
  spotifySearchUrl,
} from "@/lib/links";
import type { LikedAlbumEntry } from "@/lib/likes";

type Props = {
  entries: LikedAlbumEntry[];
  onRemove: (album: Album) => void;
  onBack: () => void;
};

function LikeRow({
  entry,
  onRemove,
}: {
  entry: LikedAlbumEntry;
  onRemove: () => void;
}) {
  const [art, setArt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAlbumMeta(entry.album).then((m) => {
      if (!cancelled) setArt(m.artworkUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [entry.album]);

  return (
    <li className="search-row inspire-row">
      <div className="search-row__art" aria-hidden>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" width={56} height={56} />
        ) : (
          <span>{entry.album.artist.slice(0, 1)}</span>
        )}
      </div>
      <div className="search-row__copy">
        <p className="search-row__title">{entry.album.title}</p>
        <p className="search-row__artist">{entry.album.artist}</p>
        <div className="search-row__links">
          <a
            href={spotifySearchUrl(entry.album)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Spotify
          </a>
          <a
            href={appleMusicSearchUrl(entry.album)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Apple
          </a>
        </div>
      </div>
      <div className="search-row__actions">
        <button type="button" className="fb fb--no" onClick={onRemove}>
          Remove
        </button>
      </div>
    </li>
  );
}

export default function MyLikes({ entries, onRemove, onBack }: Props) {
  return (
    <section className="hero hero--search">
      <div className="search-head">
        <button type="button" className="search-back" onClick={onBack}>
          ← Back
        </button>
        <h1 className="headline headline--search">Your likes</h1>
        <p className="sub">
          Albums you’ve kept. Remove anything that no longer fits.
        </p>
      </div>

      {entries.length === 0 ? (
        <p className="inspire-empty">
          Nothing liked yet. Spin a few, or search for something you already
          love.
        </p>
      ) : (
        <ul className="search-results">
          {entries.map((entry) => (
            <LikeRow
              key={entry.album.id}
              entry={entry}
              onRemove={() => onRemove(entry.album)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
