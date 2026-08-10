"use client";

import { useEffect, useState } from "react";
import type { Album } from "@/data/albums";
import {
  appleMusicSearchUrl,
  fetchAlbumMeta,
  spotifySearchUrl,
} from "@/lib/links";
import type { LikedAlbumEntry, ProfileLikedList } from "@/lib/likes";

type Props = {
  lists: ProfileLikedList[];
  myLikedIds: Set<string>;
  myDislikedIds: Set<string>;
  onLike: (album: Album) => void;
  onBack: () => void;
  loading?: boolean;
};

function AlbumRow({
  album,
  alreadyLiked,
  alreadyDisliked,
  onLike,
}: {
  album: Album;
  alreadyLiked: boolean;
  alreadyDisliked: boolean;
  onLike: () => void;
}) {
  const [art, setArt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAlbumMeta(album).then((m) => {
      if (!cancelled) setArt(m.artworkUrl);
    });
    return () => {
      cancelled = true;
    };
  }, [album]);

  return (
    <li className="search-row inspire-row">
      <div className="search-row__art" aria-hidden>
        {art ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={art} alt="" width={56} height={56} />
        ) : (
          <span>{album.artist.slice(0, 1)}</span>
        )}
      </div>
      <div className="search-row__copy">
        <p className="search-row__title">{album.title}</p>
        <p className="search-row__artist">{album.artist}</p>
        <div className="search-row__links">
          <a
            href={spotifySearchUrl(album)}
            target="_blank"
            rel="noopener noreferrer"
          >
            Spotify
          </a>
          <a
            href={appleMusicSearchUrl(album)}
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
          disabled={alreadyLiked || alreadyDisliked}
          onClick={onLike}
        >
          {alreadyLiked
            ? "Already liked"
            : alreadyDisliked
              ? "You passed"
              : "I like this too"}
        </button>
      </div>
    </li>
  );
}

function LikedRows({
  entries,
  myLikedIds,
  myDislikedIds,
  onLike,
}: {
  entries: LikedAlbumEntry[];
  myLikedIds: Set<string>;
  myDislikedIds: Set<string>;
  onLike: (album: Album) => void;
}) {
  return (
    <ul className="search-results">
      {entries.map((entry) => (
        <AlbumRow
          key={entry.album.id}
          album={entry.album}
          alreadyLiked={myLikedIds.has(entry.album.id)}
          alreadyDisliked={myDislikedIds.has(entry.album.id)}
          onLike={() => onLike(entry.album)}
        />
      ))}
    </ul>
  );
}

export default function FriendsLikes({
  lists,
  myLikedIds,
  myDislikedIds,
  onLike,
  onBack,
  loading = false,
}: Props) {
  const [tab, setTab] = useState<"likes" | "dislikes">("likes");

  return (
    <section className="hero hero--search">
      <div className="search-head">
        <button type="button" className="search-back" onClick={onBack}>
          ← Back
        </button>
        <h1 className="headline headline--search">Friends’ lists</h1>
        <p className="sub">
          Browse what others liked or passed on. Liking something only trains{" "}
          <em>your</em> recommendations.
        </p>
      </div>

      <div className="inspire-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          className={`inspire-tab ${tab === "likes" ? "is-active" : ""}`}
          aria-selected={tab === "likes"}
          onClick={() => setTab("likes")}
        >
          Likes
        </button>
        <button
          type="button"
          role="tab"
          className={`inspire-tab ${tab === "dislikes" ? "is-active" : ""}`}
          aria-selected={tab === "dislikes"}
          onClick={() => setTab("dislikes")}
        >
          Dislikes
        </button>
      </div>

      {loading ? (
        <p className="inspire-empty">Loading friends’ lists…</p>
      ) : lists.length === 0 ? (
        <p className="inspire-empty">
          No shared likes or dislikes yet. Have friends join the room, create a
          profile, and spin a few albums.
        </p>
      ) : (
        lists.map(({ profile, likes, dislikes }) => {
          const entries = tab === "likes" ? likes : null;
          const passList = tab === "dislikes" ? dislikes : null;
          const empty =
            tab === "likes" ? likes.length === 0 : dislikes.length === 0;
          return (
            <div key={profile.id} className="inspire-group">
              <h2 className="inspire-group__title">
                <span
                  className="inspire-group__dot"
                  style={{ background: profile.color }}
                  aria-hidden
                />
                {profile.name}
                <span className="inspire-group__count">
                  {tab === "likes"
                    ? `${likes.length} liked`
                    : `${dislikes.length} passed`}
                </span>
              </h2>
              {empty ? (
                <p className="inspire-empty inspire-empty--nested">
                  Nothing here yet.
                </p>
              ) : tab === "likes" && entries ? (
                <LikedRows
                  entries={entries}
                  myLikedIds={myLikedIds}
                  myDislikedIds={myDislikedIds}
                  onLike={onLike}
                />
              ) : (
                <ul className="search-results">
                  {(passList || []).map((album) => (
                    <AlbumRow
                      key={album.id}
                      album={album}
                      alreadyLiked={myLikedIds.has(album.id)}
                      alreadyDisliked={myDislikedIds.has(album.id)}
                      onLike={() => onLike(album)}
                    />
                  ))}
                </ul>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
