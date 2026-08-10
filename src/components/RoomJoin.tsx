"use client";

import { useEffect, useState } from "react";
import {
  healthCheck,
  joinRoom,
  loadDefaultApiUrl,
  type JoinResult,
} from "@/lib/api";

type Props = {
  onJoined: (result: JoinResult, apiUrl: string) => void;
};

export default function RoomJoin({ onJoined }: Props) {
  const [apiUrl, setApiUrl] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      loadDefaultApiUrl().then((url) => {
        setApiUrl(url);
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
      const ok = await healthCheck(apiUrl);
      if (!ok) {
        throw new Error(
          "Can’t reach the SPIN API. Check the URL / Cloudflare Tunnel.",
        );
      }
      const result = await joinRoom(apiUrl, code);
      onJoined(result, apiUrl.trim().replace(/\/+$/, ""));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Join failed.");
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

  return (
    <section className="hero hero--idle profile-picker">
      <h1 className="headline">Join your room</h1>
      <p className="sub">
        Same room code for your friends. Each person picks or creates their own
        name — likes stay private to that profile.
      </p>

      <form className="profile-create room-join" onSubmit={onSubmit}>
        <label className="profile-label" htmlFor="api-url">
          API URL (Cloudflare Tunnel)
        </label>
        <input
          id="api-url"
          className="profile-input"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="https://spin-api.your-tunnel.com"
          autoComplete="off"
          required
        />

        <label className="profile-label" htmlFor="room-code">
          Room code
        </label>
        <input
          id="room-code"
          className="profile-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="e.g. DRIVE-CREW"
          autoComplete="off"
          autoCapitalize="characters"
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
            {busy ? "Joining…" : "Enter room"}
          </span>
        </button>
      </form>
    </section>
  );
}
