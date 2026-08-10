import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = process.env.SPIN_DATA_DIR || path.join(ROOT, "data");
const PORT = Number(process.env.PORT || 8787);
const MAX_PROFILES = Number(process.env.SPIN_MAX_PROFILES || 8);

const COLORS = ["#f0a202", "#6fc4b2", "#e07a6a", "#8bb7e0", "#c4a1e0", "#e0c46f", "#7ec4a1", "#e08a6f"];

const emptyPreferences = () => ({
  liked: {},
  disliked: [],
  listened: {},
  suggested: {},
  genreScores: {},
  moodScores: {},
  decadeScores: {},
  artistScores: {},
  dailyPick: {},
  totalFeedback: 0,
  customAlbums: [],
  activeMode: "any",
});

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function roomDir(code) {
  return path.join(DATA_DIR, "rooms", code);
}

function profilesDir(code) {
  return path.join(roomDir(code), "profiles");
}

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 24);
}

function uid() {
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJson(file, data) {
  ensureDir(path.dirname(file));
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function ensureRoom(code) {
  ensureDir(profilesDir(code));
  const metaFile = path.join(roomDir(code), "meta.json");
  if (!fs.existsSync(metaFile)) {
    writeJson(metaFile, { code, createdAt: new Date().toISOString() });
  }
}

function listProfiles(code) {
  const dir = profilesDir(code);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson(path.join(dir, f), null))
    .filter(Boolean)
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function getProfile(code, id) {
  const file = path.join(profilesDir(code), `${id}.json`);
  if (!fs.existsSync(file)) return null;
  return readJson(file, null);
}

function saveProfile(code, profile) {
  writeJson(path.join(profilesDir(code), `${profile.id}.json`), profile);
}

function deleteProfileFile(code, id) {
  const file = path.join(profilesDir(code), `${id}.json`);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function publicProfile(profile) {
  return {
    id: profile.id,
    name: profile.name,
    color: profile.color,
    createdAt: profile.createdAt,
    preferences: {
      ...emptyPreferences(),
      ...(profile.preferences || {}),
      customAlbums: profile.preferences?.customAlbums || [],
    },
  };
}

ensureDir(DATA_DIR);

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "spin-api", maxProfiles: MAX_PROFILES });
});

app.post("/api/rooms/join", (req, res) => {
  const code = normalizeCode(req.body?.code);
  if (code.length < 3) {
    return res.status(400).json({ error: "Room code must be at least 3 characters." });
  }
  ensureRoom(code);
  const profiles = listProfiles(code).map(publicProfile);
  res.json({ code, profiles, maxProfiles: MAX_PROFILES });
});

app.get("/api/rooms/:code/profiles", (req, res) => {
  const code = normalizeCode(req.params.code);
  if (!fs.existsSync(roomDir(code))) {
    return res.status(404).json({ error: "Room not found. Join it first." });
  }
  res.json({
    code,
    profiles: listProfiles(code).map(publicProfile),
    maxProfiles: MAX_PROFILES,
  });
});

app.post("/api/rooms/:code/profiles", (req, res) => {
  const code = normalizeCode(req.params.code);
  ensureRoom(code);
  const profiles = listProfiles(code);
  if (profiles.length >= MAX_PROFILES) {
    return res.status(400).json({ error: `This room already has ${MAX_PROFILES} profiles.` });
  }
  const name = String(req.body?.name || "")
    .trim()
    .slice(0, 18);
  if (!name) return res.status(400).json({ error: "Name is required." });
  if (profiles.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
    return res.status(409).json({ error: "That name is already taken in this room." });
  }

  const profile = {
    id: uid(),
    name,
    color: COLORS[profiles.length % COLORS.length],
    createdAt: new Date().toISOString(),
    preferences: emptyPreferences(),
  };
  saveProfile(code, profile);
  res.status(201).json(publicProfile(profile));
});

app.patch("/api/rooms/:code/profiles/:id", (req, res) => {
  const code = normalizeCode(req.params.code);
  const profile = getProfile(code, req.params.id);
  if (!profile) return res.status(404).json({ error: "Profile not found." });

  if (typeof req.body?.name === "string") {
    const name = req.body.name.trim().slice(0, 18);
    if (!name) return res.status(400).json({ error: "Name is required." });
    const clash = listProfiles(code).some(
      (p) => p.id !== profile.id && p.name.toLowerCase() === name.toLowerCase(),
    );
    if (clash) return res.status(409).json({ error: "That name is already taken in this room." });
    profile.name = name;
  }
  if (typeof req.body?.color === "string") profile.color = req.body.color;
  saveProfile(code, profile);
  res.json(publicProfile(profile));
});

app.delete("/api/rooms/:code/profiles/:id", (req, res) => {
  const code = normalizeCode(req.params.code);
  const profile = getProfile(code, req.params.id);
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  deleteProfileFile(code, profile.id);
  res.json({ ok: true });
});

app.put("/api/rooms/:code/profiles/:id/preferences", (req, res) => {
  const code = normalizeCode(req.params.code);
  const profile = getProfile(code, req.params.id);
  if (!profile) return res.status(404).json({ error: "Profile not found." });
  const preferences = req.body?.preferences;
  if (!preferences || typeof preferences !== "object") {
    return res.status(400).json({ error: "preferences object is required." });
  }
  profile.preferences = {
    ...emptyPreferences(),
    ...preferences,
    customAlbums: Array.isArray(preferences.customAlbums)
      ? preferences.customAlbums
      : [],
  };
  saveProfile(code, profile);
  res.json(publicProfile(profile));
});

app.get("/api/rooms/:code/inspiration", (req, res) => {
  const code = normalizeCode(req.params.code);
  if (!fs.existsSync(roomDir(code))) {
    return res.status(404).json({ error: "Room not found." });
  }
  const excludeId = req.query.exclude ? String(req.query.exclude) : null;
  const profiles = listProfiles(code)
    .filter((p) => p.id !== excludeId)
    .map((p) => {
      const prefs = { ...emptyPreferences(), ...(p.preferences || {}) };
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        liked: prefs.liked || {},
        disliked: prefs.disliked || [],
        listened: prefs.listened || {},
        customAlbums: prefs.customAlbums || [],
      };
    });
  res.json({ code, profiles });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Server error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SPIN API listening on :${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
});
