# 🟣 Kingo YT Downloader — Deployment Guide
## 100% Free Stack

---

## 📁 Project Structure

```
kingo/
├── backend/
│   ├── server.js          ← Express API + yt-dlp + Admin API
│   ├── package.json
│   └── render.yaml        ← Render.com deploy config
└── frontend/
    ├── src/
    │   ├── main.jsx       ← Routes /admin to Admin, rest to App
    │   ├── App.jsx        ← Main user-facing app
    │   └── Admin.jsx      ← Full admin control panel
    ├── index.html
    ├── vite.config.js
    └── package.json
```

---

## 🚀 Deploy in 3 Steps (All Free)

### STEP 1 — Push to GitHub
```bash
git init
git add .
git commit -m "Kingo v2"
git remote add origin https://github.com/YOUR_USERNAME/kingo.git
git push -u origin main
```

### STEP 2 — Deploy Backend on Render.com (Free)
1. Sign up at https://render.com (use GitHub login)
2. New → Web Service → Connect your repo
3. Settings:
   - Root Directory: `backend`
   - Build Command: `npm install && pip install yt-dlp`
   - Start Command: `node server.js`
   - Plan: **Free**
4. Add Environment Variables:
   - `ADMIN_SECRET` = your-secret-password-here ← CHANGE THIS!
5. Deploy → copy your URL: `https://kingo-api.onrender.com`

### STEP 3 — Deploy Frontend on Vercel (Free)
1. Sign up at https://vercel.com (use GitHub login)
2. New Project → Import your repo
3. Root Directory: `frontend`
4. Environment Variables:
   - `VITE_API_URL` = `https://kingo-api.onrender.com`
5. Deploy!

---

## 🔐 Accessing the Admin Panel

Once deployed, go to:
```
https://your-app.vercel.app/admin
```

Login with the `ADMIN_SECRET` you set in Render.

### Admin Panel Features:

| Section | What you can do |
|---------|----------------|
| **Dashboard** | Live stats: total downloads, today, errors, data served, charts |
| **Downloads Log** | Search/filter all downloads, export CSV |
| **Error Logs** | See all yt-dlp errors, clear logs |
| **IP Manager** | Block/unblock abusive IPs |
| **Settings** | Maintenance mode, rate limits, allowed formats, banner message |

---

## 🔧 Running Locally

### Prerequisites
```bash
# Node.js from https://nodejs.org
# Python + yt-dlp
pip install yt-dlp
# ffmpeg (for format conversion)
# Mac:    brew install ffmpeg
# Ubuntu: sudo apt install ffmpeg
# Win:    https://ffmpeg.org/download.html
```

### Backend
```bash
cd backend
npm install
ADMIN_SECRET=mysecret node server.js
# → http://localhost:3001
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173       (main app)
# → http://localhost:5173/admin (admin panel)
```

---

## ⚙️ Admin API Reference

All admin routes require header: `x-admin-key: YOUR_SECRET`

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/admin/stats` | Dashboard stats & charts |
| GET | `/api/admin/downloads` | Paginated download log |
| GET | `/api/admin/errors` | Error log |
| DELETE | `/api/admin/errors` | Clear error log |
| POST | `/api/admin/block` | Block/unblock IP |
| GET | `/api/admin/blocked` | List blocked IPs |
| GET | `/api/admin/settings` | Get server settings |
| PATCH | `/api/admin/settings` | Update server settings |
| GET | `/api/admin/export` | Download CSV export |

---

## 🐛 Troubleshooting

**yt-dlp not found**: Add `--break-system-packages` flag:
```
npm install && pip install yt-dlp --break-system-packages
```

**403 from YouTube**: Update yt-dlp (YouTube changes frequently):
```bash
pip install -U yt-dlp
```

**Admin panel shows "Cannot reach backend"**: Check your `VITE_API_URL` env var in Vercel matches the Render URL exactly.

**Render cold starts (30s delay)**: Free tier sleeps after 15 min. Upgrade to $7/mo Render plan to avoid this.

---

## 💡 Security Tips

- **Always change** `ADMIN_SECRET` from the default value
- The admin panel at `/admin` is only protected by the secret key — don't share it
- For production, consider adding IP allowlisting for the admin panel
- Render free tier logs are public — don't log sensitive data

---

## ⚠️ Legal
Personal use only. Respect YouTube's Terms of Service.
