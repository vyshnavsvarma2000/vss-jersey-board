# Deploy permanently (PC can be off)

Your WhatsApp link must point to **Render** (or similar), not `localhost` or Cloudflare tunnel.

## Recommended: small repo + Render (≈15 min)

Using a **separate repo** with only `team-jersey-board` avoids deploying the whole `carestack.tests` project.

### 1. Create a Git repo for the app only

From PowerShell (adjust paths if needed):

```powershell
mkdir $env:USERPROFILE\vss-jersey-board-deploy
Copy-Item -Recurse "C:\Users\vyshnavsvarma\carestack.tests\team-jersey-board\*" $env:USERPROFILE\vss-jersey-board-deploy\
cd $env:USERPROFILE\vss-jersey-board-deploy
git init
git add .
git commit -m "chore: VSS jersey board for Render"
```

Push to **GitHub** (public or private) or **GitLab.com** — create an empty repo on the site, then:

```powershell
git remote add origin https://github.com/YOUR_USER/vss-jersey-board.git
git branch -M main
git push -u origin main
```

> If you only use company GitLab (`gitlab.infra.aws.carestack.com`), check whether Render is allowed to connect to it. Otherwise use a personal GitHub repo for this side project.

### 2. Render account

1. Go to [https://render.com](https://render.com) and sign up (free tier, **no card**).
2. **New +** → **Web Service**.
3. Connect **GitHub** (or GitLab) and select **`vss-jersey-board`** repo.
4. Settings:
   - **Name:** `vss-jersey-board` (defines URL: `https://vss-jersey-board.onrender.com`)
   - **Region:** Singapore or closest to India
   - **Branch:** `main`
   - **Root directory:** leave empty (repo root *is* the app)
   - **Runtime:** Node
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Plan:** Free
5. **Create Web Service** and wait for the first deploy (green “Live”).

### 3. Environment variable

In Render → your service → **Environment**:

| Key | Value |
|-----|--------|
| `PUBLIC_BASE_URL` | `https://vss-jersey-board.onrender.com` (your exact Render URL) |

Save → service redeploys once.

### 4. WhatsApp link

Share:

```text
https://vss-jersey-board.onrender.com/?room=VSS
```

Replace the hostname with yours if the service name differs.

---

## Using Blueprint from `carestack.tests` (monorepo)

If the whole repo is connected to Render:

1. **New → Blueprint** → select `carestack.tests`.
2. Blueprint reads `team-jersey-board/render.yaml` (`rootDir: team-jersey-board`).
3. Set `PUBLIC_BASE_URL` as above.

---

## What to expect on free Render

| Topic | Behavior |
|--------|----------|
| PC off | **Fine** — app runs on Render |
| Sleep | After **~15 min** no traffic, service sleeps; first visit may take **~1 min** |
| Data | Submissions kept across sleep; **may reset** if you redeploy or change build — use **Export Excel** as backup |
| Always-on + disk | **Starter ~$7/mo** — no sleep, optional persistent disk |

---

## After deploy checklist

1. Open `https://YOUR-SERVICE.onrender.com/?room=VSS`
2. Submit a test pick → refresh → still there
3. **Export Excel** works from the button
4. Post the URL in WhatsApp; stop local tunnel and `npm start` on your PC

---

## Do not use for production

- Cloudflare quick tunnel (`trycloudflare.com`) — dies when your PC/tunnel stops
- `http://localhost:3847` — only on your machine
