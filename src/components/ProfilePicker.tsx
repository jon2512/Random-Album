"use client";

import { useState } from "react";
import {
  MAX_PROFILES,
  createProfile,
  deleteProfile,
  renameProfile,
  selectProfile,
  type Profile,
  type ProfileStore,
} from "@/lib/profiles";

type Props = {
  store: ProfileStore;
  onChange: (store: ProfileStore) => void;
};

export default function ProfilePicker({ store, onChange }: Props) {
  const [creating, setCreating] = useState(store.profiles.length === 0);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    if (store.profiles.length >= MAX_PROFILES) return;
    const next = createProfile(store, name);
    onChange(next);
    setName("");
    setCreating(false);
  }

  function startEdit(profile: Profile) {
    setEditingId(profile.id);
    setEditName(profile.name);
  }

  function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    onChange(renameProfile(store, editingId, editName));
    setEditingId(null);
  }

  return (
    <section className="hero hero--idle profile-picker">
      <h1 className="headline">Who’s spinning?</h1>
      <p className="sub">
        Up to {MAX_PROFILES} drivers. Each profile learns its own taste.
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
                  <button type="submit" className="fb fb--yes">
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
                  onClick={() => onChange(selectProfile(store, profile.id))}
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
                        onChange(deleteProfile(store, profile.id));
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

        {store.profiles.length < MAX_PROFILES && !creating && (
          <button
            type="button"
            className="profile-add"
            onClick={() => setCreating(true)}
          >
            + Add profile
          </button>
        )}
      </div>

      {creating && store.profiles.length < MAX_PROFILES && (
        <form className="profile-create" onSubmit={submitCreate}>
          <label className="profile-label" htmlFor="new-profile-name">
            Name
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
            <button type="submit" className="spin-btn spin-btn--compact">
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
    </section>
  );
}
