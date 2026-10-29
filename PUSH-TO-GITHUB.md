# Host on GitHub (vyshnavsvarma2000)

**GitHub stores the code.** The live WhatsApp link still needs **Render** (free) — see `FREE-HOSTING.md` after push.

## Step 1 — Log in (once)

PowerShell:

```powershell
& "${env:ProgramFiles}\GitHub CLI\gh.exe" auth login
```

- GitHub.com → HTTPS → **Login with a web browser**
- Open https://github.com/login/device and enter the code shown

## Step 2 — Create repo and push (after login)

From this folder:

```powershell
cd $env:USERPROFILE\vss-jersey-board-deploy

& "${env:ProgramFiles}\GitHub CLI\gh.exe" repo create vss-jersey-board --public --source=. --remote=origin --push
```

Repo URL: **https://github.com/vyshnavsvarma2000/vss-jersey-board**

## Manual alternative (website)

1. Open https://github.com/new  
2. Repository name: **vss-jersey-board** → Public → **Create repository** (no README)  
3. Run:

```powershell
cd $env:USERPROFILE\vss-jersey-board-deploy
git remote remove origin 2>$null
git remote add origin https://github.com/vyshnavsvarma2000/vss-jersey-board.git
git push -u origin main
```

(Git may ask you to sign in in the browser.)

If push says **Permission denied to vyshnavsvarma-a11y** (or another account), Windows is using the wrong saved login:

```powershell
cmdkey /list | findstr git
# Remove the github.com entry, then push again and sign in as vyshnavsvarma2000
git credential reject
# paste: protocol=https`nhost=github.com`n
# (blank line), then git push -u github main
```

Or use GitHub CLI after `gh auth login` as **vyshnavsvarma2000**:

```powershell
git remote set-url github https://github.com/vyshnavsvarma2000/vss-jersey-board.git
git push -u github main
```

## Step 3 — Free live URL (Render)

1. https://render.com → sign up → **New Web Service** → connect **vss-jersey-board**
2. Build: `npm install` · Start: `npm start` · Plan: **Free**
3. Env: `PUBLIC_BASE_URL` = your Render URL  
4. WhatsApp: `https://YOUR-SERVICE.onrender.com/?room=VSS`

## Note on GitHub Pages

GitHub Pages only hosts **static** sites. This app needs **Node.js**, so use Render (or similar), not Pages alone.
