# Free hosting for VSS jersey board

## Best choice: Render (free, no credit card)

| | |
|---|---|
| **Cost** | $0 |
| **Card** | Not required |
| **URL** | Stable `https://vss-jersey-board.onrender.com` |
| **PC off** | Works |
| **Catch** | Sleeps after ~15 min idle; first visit ~1 min wake |
| **Data** | Kept while service runs; redeploy may reset — use **Export Excel** backup |

### Deploy in 5 steps

1. **GitHub** — create empty repo `vss-jersey-board`.
2. Push the standalone copy (already prepared on your machine):

   ```powershell
   cd $env:USERPROFILE\vss-jersey-board-deploy
   git remote remove origin 2>$null
   git remote add origin https://github.com/vyshnavsvarma2000/vss-jersey-board.git
   git push -u origin main
   ```

   (Folder created at `C:\Users\vyshnavsvarma\vss-jersey-board-deploy` with a commit ready.)

3. [render.com](https://render.com) → sign up → **New → Web Service** → connect GitHub repo.
4. **Build:** `npm install` · **Start:** `npm start` · **Plan:** Free → **Create**.
5. **Environment** → add `PUBLIC_BASE_URL` = your Render URL → WhatsApp:

   `https://YOUR-SERVICE.onrender.com/?room=VSS`

---

## Other free options (comparison)

| Host | Card? | Always awake? | Notes |
|------|-------|---------------|--------|
| **Render** | No | No (sleeps) | **Use this** |
| **Railway** | No to start | ~$1/mo credit after trial | Runs out if traffic grows |
| **Zeabur** | Check site | Auto-sleep | Less common |
| **Oracle Cloud Free VM** | Yes | Yes | Hard signup; you manage Linux + Node |
| **Cloudflare tunnel** | No | While PC on | **Not hosting** — not for you |

---

## Do not use for WhatsApp

- `localhost`
- `trycloudflare.com` (dies when your PC stops)

See [DEPLOY.md](./DEPLOY.md) for more detail.
