const crypto = require("crypto");
const express = require("express");
const fs = require("fs");
const path = require("path");

const { buildRoomExportXlsx } = require("./lib/build-export-xlsx");

const PORT = process.env.PORT || 3847;
const HOST = process.env.HOST || "0.0.0.0";
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const storePath = path.join(dataDir, "store.json");

fs.mkdirSync(dataDir, { recursive: true });

function readStore() {
  if (!fs.existsSync(storePath)) {
    return { rooms: {}, entries: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(storePath, "utf8"));
  } catch {
    return { rooms: {}, entries: [] };
  }
}

function writeStore(store) {
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), "utf8");
}

function normalizeRoomCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 32);
}

function normalizeName(name) {
  return String(name || "").trim().slice(0, 80);
}

function normalizeTeamPref(pref) {
  return String(pref || "").trim().slice(0, 120);
}

function normalizeNote(note) {
  const n = String(note || "").trim();
  return n ? n.slice(0, 200) : null;
}

const JERSEY_SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL", "3XL"]);

function normalizeJerseySize(size) {
  const s = String(size || "").trim();
  if (!s || !JERSEY_SIZES.has(s)) return null;
  return s;
}

function listEntries(store, roomCode) {
  return store.entries
    .filter((e) => e.room_code === roomCode)
    .sort(
      (a, b) =>
        a.jersey_number - b.jersey_number || a.display_name.localeCompare(b.display_name)
    );
}

function aggregateTeamSuggestions(entries) {
  const map = new Map();
  for (const e of entries) {
    const key = e.team_preference.toLowerCase();
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.supporters.push(e.display_name);
    } else {
      map.set(key, {
        name: e.team_preference,
        count: 1,
        supporters: [e.display_name],
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

const ROSTER_FILES = {
  vss: path.join(dataDir, "vss-roster.json"),
};

function loadRoster(rosterId) {
  const file = ROSTER_FILES[rosterId];
  if (!file || !fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function nameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function resolveRosterName(roster, displayName) {
  if (!roster?.players?.length) return normalizeName(displayName);
  const key = nameKey(displayName);
  const match = roster.players.find((p) => nameKey(p.name) === key);
  return match ? match.name : null;
}

function rosterProgress(roster, entries) {
  if (!roster?.players?.length) {
    return { roster: null, pendingPlayers: [], respondedCount: 0, totalPlayers: 0 };
  }
  const responded = new Set(entries.map((e) => nameKey(e.display_name)));
  const pendingPlayers = roster.players
    .filter((p) => !responded.has(nameKey(p.name)))
    .map((p) => p.name);
  const respondedCount = roster.players.length - pendingPlayers.length;
  return {
    roster,
    pendingPlayers,
    respondedCount,
    totalPlayers: roster.players.length,
  };
}

function sanitizeEntry(entry) {
  if (!entry) return entry;
  const { manage_token, ...publicFields } = entry;
  return { ...publicFields, requiresManageToken: Boolean(manage_token) };
}

function boardPayload(store, roomCode) {
  const room = store.rooms[roomCode];
  const entries = listEntries(store, roomCode);
  const rosterDoc = room?.roster_id ? loadRoster(room.roster_id) : null;
  const progress = rosterProgress(rosterDoc, entries);
  return {
    room,
    entries: entries.map(sanitizeEntry),
    teamSuggestions: aggregateTeamSuggestions(entries),
    takenNumbers: entries.map((e) => e.jersey_number),
    ...progress,
  };
}

function newManageToken() {
  return crypto.randomBytes(16).toString("hex");
}

function isRosterAdmin(roster, displayName) {
  if (!roster?.admins?.length || !displayName) return false;
  const key = nameKey(displayName);
  return roster.admins.some((name) => nameKey(name) === key);
}

function entryAuthorized(entry, displayName, manageToken, roster) {
  if (!entry) return false;
  if (isRosterAdmin(roster, displayName)) return true;
  if (entry.manage_token) {
    return (
      typeof manageToken === "string" &&
      manageToken.length > 0 &&
      manageToken === entry.manage_token
    );
  }
  return nameKey(entry.display_name) === nameKey(displayName);
}

function ensurePresetRooms() {
  const store = readStore();
  let changed = false;
  if (!store.rooms.VSS) {
    store.rooms.VSS = {
      code: "VSS",
      title: "Spoorthi - Vyshnav (VSS) · CCL 2026",
      roster_id: "vss",
      created_at: new Date().toISOString(),
    };
    changed = true;
  } else if (!store.rooms.VSS.roster_id) {
    store.rooms.VSS.roster_id = "vss";
    changed = true;
  }
  if (changed) writeStore(store);
}

function generateRoomCode(store) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (store.rooms[code]) return generateRoomCode(store);
  return code;
}

function nextEntryId(store) {
  const max = store.entries.reduce((m, e) => Math.max(m, e.id || 0), 0);
  return max + 1;
}

const app = express();
app.use(express.json({ limit: "32kb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/rooms/:code", (req, res) => {
  const code = normalizeRoomCode(req.params.code);
  if (!code) {
    return res.status(400).json({ error: "Invalid room code." });
  }

  const store = readStore();
  const room = store.rooms[code];
  if (!room) {
    return res.status(404).json({ error: "Room not found." });
  }

  res.json(boardPayload(store, code));
});

app.get("/api/rooms/:code/export", async (req, res) => {
  const code = normalizeRoomCode(req.params.code);
  if (!code) {
    return res.status(400).json({ error: "Invalid room code." });
  }

  const store = readStore();
  const room = store.rooms[code];
  if (!room) {
    return res.status(404).json({ error: "Room not found." });
  }

  try {
    const payload = boardPayload(store, code);
    const workbook = await buildRoomExportXlsx({
      room,
      entries: payload.entries,
      teamSuggestions: payload.teamSuggestions,
      pendingPlayers: payload.pendingPlayers,
      roster: payload.roster,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `${code}-jersey-board-${stamp}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export failed:", err);
    res.status(500).json({ error: "Could not generate Excel file." });
  }
});

app.post("/api/rooms", (req, res) => {
  const store = readStore();
  const code = normalizeRoomCode(req.body?.code) || generateRoomCode(store);
  const title = String(req.body?.title || "Team jersey board").trim().slice(0, 120);

  if (!code || code.length < 3) {
    return res.status(400).json({ error: "Room code must be at least 3 characters." });
  }

  if (store.rooms[code]) {
    return res.status(409).json({
      error: "Room code already exists. Pick another or open the existing board.",
    });
  }

  store.rooms[code] = {
    code,
    title: title || "Team jersey board",
    created_at: new Date().toISOString(),
  };
  writeStore(store);
  res.status(201).json({ room: store.rooms[code] });
});

app.post("/api/rooms/:code/entries", (req, res) => {
  const code = normalizeRoomCode(req.params.code);
  const store = readStore();
  if (!store.rooms[code]) {
    return res.status(404).json({ error: "Room not found. Create the board first." });
  }

  let displayName = normalizeName(req.body?.displayName);
  const jerseyNumber = parseInt(req.body?.jerseyNumber, 10);
  const teamPreference = normalizeTeamPref(req.body?.teamPreference);
  const jerseySize = normalizeJerseySize(req.body?.jerseySize);
  const note = normalizeNote(req.body?.note);

  const room = store.rooms[code];
  const rosterDoc = room?.roster_id ? loadRoster(room.roster_id) : null;
  if (rosterDoc) {
    const resolved = resolveRosterName(rosterDoc, displayName);
    if (!resolved) {
      return res.status(400).json({
        error: "Pick your name from the squad list (must match the auction roster).",
      });
    }
    displayName = resolved;
  }

  if (!displayName) {
    return res.status(400).json({ error: "Name is required." });
  }
  if (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 9999) {
    return res.status(400).json({ error: "Enter a valid jersey number (0–9999)." });
  }
  if (!jerseySize) {
    return res.status(400).json({ error: "Select a valid jersey size (XS–3XL)." });
  }
  if (!teamPreference) {
    return res.status(400).json({ error: "Team name preference is required." });
  }

  const roomEntries = listEntries(store, code);
  if (roomEntries.some((e) => e.jersey_number === jerseyNumber)) {
    return res.status(409).json({ error: `Jersey #${jerseyNumber} is already taken.` });
  }
  if (roomEntries.some((e) => nameKey(e.display_name) === nameKey(displayName))) {
    return res.status(409).json({ error: "You already have an entry. Use Edit to change it." });
  }

  const entryId = nextEntryId(store);
  const manageToken = newManageToken();
  store.entries.push({
    id: entryId,
    room_code: code,
    display_name: displayName,
    jersey_number: jerseyNumber,
    jersey_size: jerseySize,
    team_preference: teamPreference,
    note,
    manage_token: manageToken,
    created_at: new Date().toISOString(),
  });
  writeStore(store);

  res.status(201).json({
    ...boardPayload(store, code),
    entryId,
    manageToken,
  });
});

function findEntryForUser(store, code, id, displayName, manageToken, rosterDoc) {
  const entry = store.entries.find((e) => e.id === id && e.room_code === code);
  if (!entry) return null;
  if (!entryAuthorized(entry, displayName, manageToken, rosterDoc)) return null;
  return entry;
}

app.put("/api/rooms/:code/entries/:id", (req, res) => {
  const code = normalizeRoomCode(req.params.code);
  const id = parseInt(req.params.id, 10);
  const store = readStore();
  if (!store.rooms[code]) {
    return res.status(404).json({ error: "Room not found." });
  }

  let displayName = normalizeName(req.body?.displayName);
  const jerseyNumber = parseInt(req.body?.jerseyNumber, 10);
  const teamPreference = normalizeTeamPref(req.body?.teamPreference);
  const jerseySize = normalizeJerseySize(req.body?.jerseySize);
  const note = normalizeNote(req.body?.note);

  const room = store.rooms[code];
  const rosterDoc = room?.roster_id ? loadRoster(room.roster_id) : null;
  if (rosterDoc) {
    const resolved = resolveRosterName(rosterDoc, displayName);
    if (!resolved) {
      return res.status(400).json({ error: "Pick your name from the squad list." });
    }
    displayName = resolved;
  }

  if (!Number.isInteger(id) || !displayName) {
    return res.status(400).json({ error: "Entry id and your name are required to update." });
  }
  if (!Number.isInteger(jerseyNumber) || jerseyNumber < 0 || jerseyNumber > 9999) {
    return res.status(400).json({ error: "Enter a valid jersey number (0–9999)." });
  }
  if (!jerseySize) {
    return res.status(400).json({ error: "Select a valid jersey size (XS–3XL)." });
  }
  if (!teamPreference) {
    return res.status(400).json({ error: "Team name preference is required." });
  }

  const manageToken = String(req.body?.manageToken || "").trim();
  const entry = findEntryForUser(store, code, id, displayName, manageToken, rosterDoc);
  if (!entry) {
    return res.status(403).json({
      error: "Not allowed to update this entry. Use the same phone/browser where you first submitted.",
    });
  }

  const roomEntries = listEntries(store, code);
  if (roomEntries.some((e) => e.id !== id && e.jersey_number === jerseyNumber)) {
    return res.status(409).json({ error: `Jersey #${jerseyNumber} is already taken.` });
  }

  entry.jersey_number = jerseyNumber;
  entry.jersey_size = jerseySize;
  entry.team_preference = teamPreference;
  entry.note = note;
  entry.updated_at = new Date().toISOString();
  if (!entry.manage_token) {
    entry.manage_token = newManageToken();
  }
  writeStore(store);

  res.json({
    ...boardPayload(store, code),
    entryId: entry.id,
    manageToken: entry.manage_token,
  });
});

app.delete("/api/rooms/:code/entries/:id", (req, res) => {
  const code = normalizeRoomCode(req.params.code);
  const id = parseInt(req.params.id, 10);
  const displayName = normalizeName(req.body?.displayName);
  const manageToken = String(req.body?.manageToken || "").trim();

  if (!Number.isInteger(id) || !displayName) {
    return res.status(400).json({ error: "Entry id and your name are required to remove." });
  }

  const store = readStore();
  if (!store.rooms[code]) {
    return res.status(404).json({ error: "Room not found." });
  }

  const room = store.rooms[code];
  const rosterDoc = room?.roster_id ? loadRoster(room.roster_id) : null;
  let actorName = displayName;
  if (rosterDoc) {
    const resolved = resolveRosterName(rosterDoc, displayName);
    if (!resolved) {
      return res.status(400).json({ error: "Pick your name from the squad list." });
    }
    actorName = resolved;
  }

  const entry = store.entries.find((e) => e.id === id && e.room_code === code);
  if (!entry || !entryAuthorized(entry, actorName, manageToken, rosterDoc)) {
    return res.status(403).json({
      error: "Not allowed to delete this entry. Use the same phone/browser where you first submitted.",
    });
  }

  const idx = store.entries.findIndex((e) => e.id === id && e.room_code === code);
  if (idx === -1) {
    return res.status(404).json({ error: "Entry not found." });
  }

  store.entries.splice(idx, 1);
  writeStore(store);

  res.json(boardPayload(store, code));
});

app.delete("/api/rooms/:code/captain/entries/:id", (req, res) => {
  const captainSecret = process.env.CAPTAIN_SECRET;
  if (!captainSecret || req.get("x-captain-secret") !== captainSecret) {
    return res.status(404).json({ error: "Not found" });
  }

  const code = normalizeRoomCode(req.params.code);
  const id = parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: "Invalid entry id." });
  }

  const store = readStore();
  const idx = store.entries.findIndex((e) => e.id === id && e.room_code === code);
  if (idx === -1) {
    return res.status(404).json({ error: "Entry not found." });
  }

  store.entries.splice(idx, 1);
  writeStore(store);
  res.json(boardPayload(store, code));
});

ensurePresetRooms();

app.listen(PORT, HOST, () => {
  const base = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  console.log(`Jersey board listening on ${HOST}:${PORT}`);
  console.log(`VSS squad board: ${base.replace(/\/$/, "")}/?room=VSS`);
});
