/**
 * CRUD smoke test for jersey board API.
 * Usage: node scripts/crud-smoke.js [baseUrl] [roomCode] [playerName]
 */
const base = (process.argv[2] || "http://localhost:3847").replace(/\/$/, "");
const room = process.argv[3] || "VSS";
const player = process.argv[4] || "Vyshnav S Varma";

async function req(method, path, body) {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${data.error || res.statusText}`);
  }
  return data;
}

async function main() {
  console.log(`Testing ${base} room=${room} player=${player}`);

  const read0 = await req("GET", `/api/rooms/${room}`);
  console.log("READ (initial):", read0.entries.length, "entries");

  const existing = read0.entries.find((e) => e.display_name === player);
  if (existing) {
    await req("DELETE", `/api/rooms/${room}/entries/${existing.id}`, { displayName: player });
    console.log("CLEANUP: removed prior entry", existing.id);
  }

  const created = await req("POST", `/api/rooms/${room}/entries`, {
    displayName: player,
    jerseyNumber: 42,
    jerseySize: "L",
    teamPreference: "Smoke Test XI",
    note: "create",
  });
  const entry = created.entries.find((e) => e.display_name === player);
  if (!entry) throw new Error("CREATE failed: entry missing from response");
  console.log("CREATE:", entry.id, entry.jersey_number);

  const updated = await req("PUT", `/api/rooms/${room}/entries/${entry.id}`, {
    displayName: player,
    jerseyNumber: 43,
    jerseySize: "XL",
    teamPreference: "Smoke Test Updated",
    note: "update",
  });
  const afterUpdate = updated.entries.find((e) => e.id === entry.id);
  if (afterUpdate.jersey_number !== 43) throw new Error("UPDATE failed");
  console.log("UPDATE:", afterUpdate.jersey_number, afterUpdate.team_preference);

  const read1 = await req("GET", `/api/rooms/${room}`);
  if (!read1.entries.some((e) => e.id === entry.id && e.jersey_number === 43)) {
    throw new Error("READ after update failed");
  }
  console.log("READ:", read1.entries.length, "entries");

  const deleted = await req("DELETE", `/api/rooms/${room}/entries/${entry.id}`, {
    displayName: player,
  });
  if (deleted.entries.some((e) => e.id === entry.id)) throw new Error("DELETE failed");
  console.log("DELETE: ok, remaining", deleted.entries.length);

  console.log("CRUD smoke test passed.");
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
