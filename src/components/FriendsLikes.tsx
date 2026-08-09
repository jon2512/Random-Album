"use client";

import { useEffect, useState } from "react";
import {
  appleMusicSearchUrl,
  fetchAlbumMeta,
  spotifySearchUrl,
} from "@/lib/links";
import type { LikedAlbumEntry, ProfileLikedList } from "@/lib/likes";
import type { Album } from "@/data/albums";

type Props = {
  lists: ProfileLikedList[];
  myLikedIds: Set<string>;
  onLike: (album: Album) => void;
  onBack: () => void;
};

function LikedRow({
  entry,
  alreadyLiked,
  onLike,
}: {
  entry: LikedAlbumEntry;
  alreadyLiked: boolean;
  onLike: () => void;
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
        <button
          type="button"
          className="fb fb--yes"
          disabled={alreadyLiked}
          onClick={onLike}
        >
          {alreadyLiked ? "Already liked" : "I like this too"}
        </button>
      </div>
    </li>
  );
}

export default function FriendsLikes({
  lists,
  myLikedIds,
  onLike,
  onBack,
}: Props) {
  return (
    <section className="hero hero--search">
      <div className="search-head">
        <button type="button" className="search-back" onClick={onBack}>
          ← Back
        </button>
        <h1 className="headline headline--search">Other drivers’ likes</h1>
        <p className="sub">
          Steal good ideas from the people who share this phone — tap to add one
          to your taste.
        </p>
      </div>

      {lists.length === 0 ? (
        <p className="inspire-empty">
          No shared likes yet. Create another profile (or have them spin and
          like a few albums), then come back.
        </p>
      ) : (
        lists.map(({ profile, entries }) => (
          <div key={profile.id} className="inspire-group">
            <h2 className="inspire-group__title">
              <span
                className="inspire-group__dot"
                style={{ background: profile.color }}
                aria-hidden
              />
              {profile.name}
              <span className="inspire-group__count">
                {entries.length} liked
              </span>
            </h2>
            <ul className="search-results">
              {entries.map((entry) => (
                <LikedRow
                  key={`${profile.id}-${entry.album.id}`}
                  entry={entry}
                  alreadyLiked={myLikedIds.has(entry.album.id)}
                  onLike={() => onLike(entry.album)}
                />
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}
