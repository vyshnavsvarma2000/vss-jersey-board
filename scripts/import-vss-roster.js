/**
 * Re-import VSS squad from the auction Excel export.
 * Usage: node scripts/import-vss-roster.js "C:\path\VVS team.xlsx"
 */
const fs = require("fs");
const path = require("path");

const xlsxPath = process.argv[2];
if (!xlsxPath) {
  console.error('Usage: node scripts/import-vss-roster.js "<path-to-xlsx>"');
  process.exit(1);
}

const { execFileSync } = require("child_process");
const outPath = path.join(__dirname, "..", "data", "vss-roster.json");

const py = `
import pandas as pd, json, sys
df = pd.read_excel(${JSON.stringify(xlsxPath)}, sheet_name='VSS - Spoorthi - Vyshnav', header=None)
start = next(i for i in range(len(df)) if str(df.iloc[i,0]).strip()=='#' and str(df.iloc[i,1]).strip()=='Player') + 1
players = []
for i in range(start, len(df)):
    name = df.iloc[i,1]
    if pd.isna(name) or not str(name).strip(): break
    num = df.iloc[i,0]
    players.append({
        'squad_number': int(float(num)) if pd.notna(num) else len(players)+1,
        'name': str(name).strip(),
        'gender': '' if pd.isna(df.iloc[i,2]) else str(df.iloc[i,2]).strip(),
        'role': '' if pd.isna(df.iloc[i,3]) else str(df.iloc[i,3]).strip(),
    })
doc = {'team':'Spoorthi - Vyshnav','code':'VSS','pool':'Pool B','players':players}
print(json.dumps(doc, ensure_ascii=False))
`;

const json = execFileSync("py", ["-3", "-c", py], { encoding: "utf8" });
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(JSON.parse(json), null, 2), "utf8");
console.log("Updated", outPath, "—", JSON.parse(json).players.length, "players");
