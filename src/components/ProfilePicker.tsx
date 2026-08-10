"use client";

import { useState } from "react";
import { MAX_PROFILES, type Profile, type ProfileStore } from "@/lib/profiles";

type Props = {
  store: ProfileStore;
  roomCode?: string | null;
  maxProfiles?: number;
  busy?: boolean;
  error?: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<void> | void;
  onRename: (id: string, name: string) => Promise<void> | void;
  onDelete: (id: string) => Promise<void> | void;
  onLeaveRoom?: () => void;
};

export default function ProfilePicker({
  store,
  roomCode,
  maxProfiles = MAX_PROFILES,
  busy = false,
  error = null,
  onSelect,
  onCreate,
  onRename,
  onDelete,
  onLeaveRoom,
}: Props) {
  const [creating, setCreating] = useState(store.profiles.length === 0);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (store.profiles.length >= maxProfiles) return;
    await onCreate(name);
    setName("");
    setCreating(false);
  }

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setEditName(profile.name);
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    await onRename(editingId, editName);
    setEditingId(null);
  }

  return (
    <section className="hero hero--idle profile-picker">
      <h1 className="headline">Who’s spinning?</h1>
      <p className="sub">
        {roomCode ? (
          <>
            Pick your name — or make one. Your likes only shape{" "}
            <em>your</em> next listens.
          </>
        ) : (
          <>Up to {maxProfiles} people. Each profile learns its own taste.</>
        )}
      </p>

      <div className="profile-grid">
        {store.profiles.map((profile) => (
          <div key={profile.id} className="profile-card">
            {editingId === profile.id ? (
              <form className="profile-edit" onSubmit={submitRename}>
                <input
                  className="profile-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={18}
                  autoFocus
                  aria-label="Rename profile"
                />
                <div className="profile-edit-actions">
                  <button type="submit" className="fb fb--yes" disabled={busy}>
                    Save
                  </button>
                  <button
                    type="button"
                    className="fb fb--skip"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <button
                  type="button"
                  className="profile-select"
                  onClick={() => onSelect(profile.id)}
                  disabled={busy}
                >
                  <span
                    className="profile-avatar"
                    style={{ background: profile.color }}
                    aria-hidden
                  >
                    {profile.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="profile-name">{profile.name}</span>
                  <span className="profile-hint">Tap to drive</span>
                </button>
                <div className="profile-tools">
                  <button
                    type="button"
                    className="profile-tool"
                    onClick={() => startEdit(profile)}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    className="profile-tool profile-tool--danger"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete ${profile.name}? Their taste history goes too.`,
                        )
                      ) {
                        void onDelete(profile.id);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        ))}

        {store.profiles.length < maxProfiles && !creating && (
          <button
            type="button"
            className="profile-add"
            onClick={() => setCreating(true)}
            disabled={busy}
          >
            + Create your profile
          </button>
        )}
      </div>

      {creating && store.profiles.length < maxProfiles && (
        <form className="profile-create" onSubmit={submitCreate}>
          <label className="profile-label" htmlFor="new-profile-name">
            Your name
          </label>
          <input
            id="new-profile-name"
            className="profile-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alex"
            maxLength={18}
            autoFocus
          />
          <div className="profile-edit-actions">
            <button
              type="submit"
              className="spin-btn spin-btn--compact"
              disabled={busy}
            >
              <span className="spin-btn__ring" aria-hidden />
              <span className="spin-btn__label">Create profile</span>
            </button>
            {store.profiles.length > 0 && (
              <button
                type="button"
                className="fb fb--skip"
                onClick={() => {
                  setCreating(false);
                  setName("");
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {error && <p className="form-error">{error}</p>}

      {onLeaveRoom && (
        <button type="button" className="text-link" onClick={onLeaveRoom}>
          Not you? Use a different phrase
        </button>
      )}
    </section>
  );
}
