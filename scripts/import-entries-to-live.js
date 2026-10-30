#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const baseUrl = (process.argv[2] || "https://vss-jersey-board.onrender.com").replace(/\/$/, "");
const room = (process.argv[3] || "VSS").toUpperCase();
const jsonPath = process.argv[4];
const captainSecret = process.env.CAPTAIN_SECRET || process.argv[5];

if (!jsonPath || !captainSecret) {
  console.error(
    "Usage: CAPTAIN_SECRET=xxx node scripts/import-entries-to-live.js [baseUrl] [room] <entries.json>\n" +
      "   or: node scripts/import-entries-to-live.js [baseUrl] [room] <entries.json> <captainSecret>"
  );
  process.exit(1);
}

const doc = JSON.parse(fs.readFileSync(path.resolve(jsonPath), "utf8"));
const entries = doc.entries || doc;
const replace = Boolean(doc.replace);
if (!Array.isArray(entries) || entries.length === 0) {
  console.error("No entries array in JSON.");
  process.exit(1);
}

async function main() {
  const res = await fetch(`${baseUrl}/api/rooms/${encodeURIComponent(room)}/captain/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Captain-Secret": captainSecret,
    },
    body: JSON.stringify({ entries, replace }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(res.status, data.error || data);
    process.exit(1);
  }
  console.log(`Imported ${data.importedCount} entries into room ${room}.`);
  console.log(`Board: ${baseUrl}/?room=${room}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
