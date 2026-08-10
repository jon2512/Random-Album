const GENRES = [
  "rock",
  "indie",
  "hip-hop",
  "r&b",
  "electronic",
  "jazz",
  "folk",
  "pop",
  "metal",
  "soul",
  "punk",
  "ambient",
  "country",
  "world",
];

const MOODS = [
  "upbeat",
  "chill",
  "dark",
  "emotional",
  "groovy",
  "energetic",
  "melancholy",
  "dreamy",
];

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const SUGGEST_COUNT = Number(process.env.SPIN_AI_SUGGEST_COUNT || 24);

export function geminiConfigured() {
  return Boolean(GEMINI_API_KEY);
}

function slugId(artist, title) {
  const base = `${artist}-${title}`
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return `ai-${base || "album"}`;
}

function pickAllowed(values, allowed, fallback) {
  const list = Array.isArray(values) ? values : [];
  const cleaned = [
    ...new Set(
      list
        .map((v) => String(v || "").toLowerCase().trim())
        .filter((v) => allowed.includes(v)),
    ),
  ];
  return cleaned.length > 0 ? cleaned.slice(0, 3) : fallback;
}

function normalizeAlbum(raw, seen) {
  if (!raw || typeof raw !== "object") return null;
  const title = String(raw.title || "").trim().slice(0, 120);
  const artist = String(raw.artist || "").trim().slice(0, 120);
  if (!title || !artist) return null;

  const yearNum = Number(raw.year);
  const year =
    Number.isFinite(yearNum) && yearNum >= 1950 && yearNum <= 2030
      ? Math.round(yearNum)
      : 0;

  const id = slugId(artist, title);
  if (seen.has(id)) return null;
  seen.add(id);

  return {
    id,
    title,
    artist,
    year,
    genres: pickAllowed(raw.genres, GENRES, ["indie"]),
    moods: pickAllowed(raw.moods, MOODS, ["chill"]),
  };
}

function extractJson(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) throw new Error("Empty Gemini response");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    const aStart = trimmed.indexOf("[");
    const aEnd = trimmed.lastIndexOf("]");
    if (aStart >= 0 && aEnd > aStart) {
      return { albums: JSON.parse(trimmed.slice(aStart, aEnd + 1)) };
    }
    throw new Error("Could not parse Gemini JSON");
  }
}

function buildPrompt({ likes, dislikes, avoid, count }) {
  const likeLines =
    likes.length > 0
      ? likes.map((a) => `- ${a.artist} — ${a.title}`).join("\n")
      : "- (none yet — pick a varied starter set of great albums)";
  const dislikeLines =
    dislikes.length > 0
      ? dislikes.map((a) => `- ${a.artist} — ${a.title}`).join("\n")
      : "- (none)";
  const avoidLines =
    avoid.length > 0
      ? avoid.map((a) => `- ${a.artist} — ${a.title}`).join("\n")
      : "- (none)";

  return `You are a music recommendation engine for a tiny personal album app.

Given albums the listener liked, suggest ${count} REAL studio albums they would enjoy next.
Prioritize discovery: different artists from the likes when possible, still in a similar taste neighborhood.
Mix eras. Avoid greatest-hits / live / deluxe edition reissues when a studio album exists.

Liked albums:
${likeLines}

Disliked albums (never suggest these or near-duplicates):
${dislikeLines}

Already suggested recently (do not repeat):
${avoidLines}

Return ONLY JSON with this shape:
{
  "albums": [
    {
      "title": "Album Title",
      "artist": "Artist Name",
      "year": 2016,
      "genres": ["indie"],
      "moods": ["chill", "dreamy"]
    }
  ]
}

Rules:
- genres must be chosen from: ${GENRES.join(", ")}
- moods must be chosen from: ${MOODS.join(", ")}
- 1-3 genres and 1-3 moods per album
- Exactly ${count} albums
- No commentary outside JSON`;
}

export async function suggestAlbumsFromLikes(input) {
  if (!GEMINI_API_KEY) {
    const err = new Error("GEMINI_API_KEY is not set on the SPIN API server.");
    err.status = 503;
    throw err;
  }

  const likes = Array.isArray(input.likes) ? input.likes.slice(0, 40) : [];
  const dislikes = Array.isArray(input.dislikes) ? input.dislikes.slice(0, 40) : [];
  const avoid = Array.isArray(input.avoid) ? input.avoid.slice(0, 80) : [];
  const count = Math.min(40, Math.max(8, Number(input.count) || SUGGEST_COUNT));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    GEMINI_MODEL,
  )}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt({ likes, dislikes, avoid, count }) }],
        },
      ],
      generationConfig: {
        temperature: 0.95,
        responseMimeType: "application/json",
      },
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      data?.error?.message ||
      `Gemini request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status === 429 ? 429 : 502;
    throw err;
  }

  const text =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") ||
    "";
  const parsed = extractJson(text);
  const rawAlbums = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.albums)
      ? parsed.albums
      : [];

  const seen = new Set();
  const albums = [];
  for (const raw of rawAlbums) {
    const album = normalizeAlbum(raw, seen);
    if (album) albums.push(album);
    if (albums.length >= count) break;
  }

  if (albums.length < 4) {
    const err = new Error("Gemini returned too few usable albums.");
    err.status = 502;
    throw err;
  }

  return {
    albums,
    model: GEMINI_MODEL,
    generatedAt: new Date().toISOString(),
  };
}
