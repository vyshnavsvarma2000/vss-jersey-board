# Team Jersey Board

A small live board for your group to claim jersey numbers (0–99) and suggest team names. Share one link in WhatsApp; everyone sees the same roster.

## VSS squad (Spoorthi · Vyshnav)

The roster is imported from your auction Excel sheet (`VSS - Spoorthi - Vyshnav` tab) into `data/vss-roster.json` (17 players).

- Board room code: **`VSS`**
- Local URL: **http://localhost:3847/?room=VSS**
- Each player picks their name from the dropdown (auction names), chooses a jersey number, and enters a team name suggestion.
- **Squad responses** shows who has / has not submitted; **WhatsApp reminder (pending)** nags only the missing names.

Re-import after the Excel file changes:

```powershell
npm run import:vss -- "C:\Users\vyshnavsvarma\Downloads\VVS team.xlsx"
```

## Run locally

```bash
cd team-jersey-board
npm install
npm start
```

Open **http://localhost:3847**

1. **Create new** — set a title (optional custom room code).
2. **Share on WhatsApp** — sends the board link and room code.
3. Teammates open the link, enter name, number, and team name preference.

Data is stored in `data/store.json` on the machine running the server.

## Export Excel

On the board, click **Export Excel** (or `GET /api/rooms/VSS/export`). The workbook includes:

- **Submissions** — jersey number, name, size, team preference, notes, timestamps  
- **Team name ideas** — vote counts  
- **Pending** — squad members who have not submitted (VSS roster)  
- **Info** — room metadata  

## Permanent public URL

See **[DEPLOY.md](./DEPLOY.md)** — deploy to **Render** (free HTTPS URL, no tunnel). Share:

`https://YOUR-SERVICE.onrender.com/?room=VSS`

## Share with people outside your network (temporary)

- Cloudflare tunnel: `npx cloudflared tunnel --url http://127.0.0.1:3847` (URL changes when restarted)

## API (optional)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/rooms` | Create room `{ title, code? }` |
| GET | `/api/rooms/:code` | Full board state |
| POST | `/api/rooms/:code/entries` | Add pick `{ displayName, jerseyNumber, jerseySize, teamPreference, note? }` |
| PUT | `/api/rooms/:code/entries/:id` | Update own pick (same body as POST) |
| DELETE | `/api/rooms/:code/entries/:id` | Remove own entry `{ displayName }` |

Jersey numbers and names are unique per room.
