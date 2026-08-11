"use client";

import { useEffect, useState } from "react";
import {
  healthCheck,
  joinRoom,
  loadDefaultApiUrl,
  type JoinResult,
} from "@/lib/api";

/** Shared invite phrase — music-related, for close friends only. */
export const CREW_PHRASE = "dusty-needle";

type Props = {
  onJoined: (result: JoinResult, apiUrl: string) => void;
};

export default function RoomJoin({ onJoined }: Props) {
  const [apiUrl, setApiUrl] = useState("");
  const [code, setCode] = useState(CREW_PHRASE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [apiFromConfig, setApiFromConfig] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadDefaultApiUrl().then((url) => {
        setApiUrl(url);
        setApiFromConfig(Boolean(url));
        setReady(true);
      });
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (!apiUrl.trim()) {
        throw new Error("Missing server address.");
      }
      const ok = await healthCheck(apiUrl);
      if (!ok) {
        throw new Error("Can’t reach SPIN right now. Try again in a moment.");
      }
      const result = await joinRoom(apiUrl, code);
      onJoined(result, apiUrl.trim().replace(/\/+$/, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t get in.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <section className="hero hero--idle">
        <div className="boot">Loading…</div>
      </section>
    );
  }

  const hideApi = apiFromConfig && !showServer;

  return (
    <section className="hero hero--idle profile-picker">
      <h1 className="headline">Come on in</h1>
      <p className="sub">
        Made for a tiny circle. Use the phrase, then pick your name — your taste
        stays yours.
      </p>

      <form className="profile-create room-join" onSubmit={onSubmit}>
        {!hideApi && (
          <>
            <label className="profile-label" htmlFor="api-url">
              Server
            </label>
            <input
              id="api-url"
              className="profile-input"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://album-spin.win"
              autoComplete="off"
              required
            />
          </>
        )}

        <label className="profile-label" htmlFor="crew-phrase">
          Phrase
        </label>
        <input
          id="crew-phrase"
          className="profile-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={CREW_PHRASE}
          autoComplete="off"
          spellCheck={false}
          required
          minLength={3}
          maxLength={24}
        />

        {error && <p className="form-error">{error}</p>}

        <button
          type="submit"
          className="spin-btn spin-btn--compact"
          disabled={busy}
        >
          <span className="spin-btn__ring" aria-hidden />
          <span className="spin-btn__label">
            {busy ? "Getting in…" : "Let’s go"}
          </span>
        </button>

        {apiFromConfig && (
          <button
            type="button"
            className="text-link text-link--quiet"
            onClick={() => setShowServer((v) => !v)}
          >
            {showServer ? "Hide server" : "Server settings"}
          </button>
        )}
      </form>
    </section>
  );
}
