const ExcelJS = require("exceljs");

function nameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function styleHeaderRow(row) {
  row.font = { bold: true };
  row.alignment = { vertical: "middle" };
}

async function buildRoomExportXlsx({ room, entries, teamSuggestions, pendingPlayers, roster }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Team Jersey Board";
  wb.created = new Date();

  const submissions = wb.addWorksheet("Submissions");
  submissions.columns = [
    { header: "Jersey number", key: "jersey_number", width: 14 },
    { header: "Name", key: "display_name", width: 28 },
    { header: "Jersey size", key: "jersey_size", width: 12 },
    { header: "Team preference", key: "team_preference", width: 24 },
    { header: "Note", key: "note", width: 24 },
    { header: "Submitted", key: "created_at", width: 22 },
    { header: "Last updated", key: "updated_at", width: 22 },
  ];
  styleHeaderRow(submissions.getRow(1));
  for (const e of entries) {
    submissions.addRow({
      jersey_number: e.jersey_number,
      display_name: e.display_name,
      jersey_size: e.jersey_size || "",
      team_preference: e.team_preference,
      note: e.note || "",
      created_at: e.created_at || "",
      updated_at: e.updated_at || "",
    });
  }

  const teamSheet = wb.addWorksheet("Team name ideas");
  teamSheet.columns = [
    { header: "Team name", key: "name", width: 28 },
    { header: "Votes", key: "count", width: 10 },
    { header: "Suggested by", key: "supporters", width: 48 },
  ];
  styleHeaderRow(teamSheet.getRow(1));
  for (const s of teamSuggestions) {
    teamSheet.addRow({
      name: s.name,
      count: s.count,
      supporters: s.supporters.join(", "),
    });
  }

  if (roster?.players?.length) {
    const responded = new Set(entries.map((e) => nameKey(e.display_name)));
    const pending = wb.addWorksheet("Pending");
    pending.columns = [
      { header: "Name", key: "name", width: 32 },
      { header: "Status", key: "status", width: 14 },
    ];
    styleHeaderRow(pending.getRow(1));
    for (const p of roster.players) {
      const done = responded.has(nameKey(p.name));
      pending.addRow({ name: p.name, status: done ? "Submitted" : "Pending" });
    }
    if (pendingPlayers?.length) {
      pending.addRow({});
      pending.addRow({ name: "Still waiting on:", status: pendingPlayers.join(", ") });
    }
  }

  const meta = wb.addWorksheet("Info");
  meta.columns = [
    { header: "Field", key: "field", width: 18 },
    { header: "Value", key: "value", width: 50 },
  ];
  styleHeaderRow(meta.getRow(1));
  meta.addRow({ field: "Board title", value: room.title });
  meta.addRow({ field: "Room code", value: room.code });
  meta.addRow({ field: "Exported at", value: new Date().toISOString() });
  meta.addRow({ field: "Submission count", value: entries.length });

  return wb;
}

module.exports = { buildRoomExportXlsx };
