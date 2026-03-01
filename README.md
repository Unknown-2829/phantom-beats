# 🎵 Phantom Beats

> **Stream HD music — free, open-source, no ads, no limits.**   
> Powered by YouTube • Built with FastAPI + React

![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.115-green.svg)

---

## ✨ Features

| Feature | Details |
|---------|---------|
| 🔍 **Smart Search** | Real-time search with history tracking |
| 🎵 **HD Streaming** | 320kbps audio streamed via yt-dlp proxy |
| 🎛️ **Equalizer** | 10-band Web Audio API EQ with 10 presets |
| 📋 **Playlists** | Create, edit, reorder (drag & drop), import/export |
| 🔐 **JWT Auth** | User registration & login with bcrypt + 7-day tokens |
| 🌙 **Themes** | Beautiful dark mode with dynamic album-art gradient |
| 📝 **Lyrics** | Auto-fetched from lrclib.net & lyrics.ovh |
| 🔥 **Trending** | Browse by 25+ genres: Anime, J-Pop, Gaming, Lo-Fi, etc. |
| 🧭 **Explore** | Hero section, mood boards, curated collections |
| 📱 **PWA** | Installable app, works offline, mobile-first |
| 🎮 **Keyboard** | Space, Alt+←/→, Shift+←/→, ↑/↓, M shortcuts |
| ⬇ **Downloads** | Download tracks as MP3 with ID3 metadata |
| 💿 **Offline Library** | IndexedDB caching for offline playback |
| 🎯 **Recommendations** | AI-powered "Because you listened to..." section |
| 📊 **Play History** | Recently played tracks with smart suggestions |
| 🔍 **Search History** | Your searches, saved & displayed in Profile |
| 👤 **User Profile** | Stats, playlists, history tabs, keyboard shortcuts |
| 🎚️ **Queue** | Full playback queue panel with click-to-play |

---

## 📁 Project Structure

```
phantom beats/
├── backend/                    # Python FastAPI server
│   ├── main.py                 # App entry point
│   ├── config.py               # Environment config
│   ├── database.py             # SQLite async operations
│   ├── auth.py                 # JWT + bcrypt auth
│   ├── requirements.txt        # Python dependencies
│   ├── .env                    # Environment variables
│   ├── routes/
│   │   ├── search.py           # Search, trending, lyrics, related
│   │   ├── stream.py           # Audio proxy (urllib → FFmpeg → MP3)
│   │   ├── playlists.py        # Playlists + Spotify import
│   │   └── auth_routes.py      # Register, login, profile
│   └── services/
│       ├── ytdlp_service.py    # yt-dlp wrapper (search, stream, cache)
│       └── lyrics_service.py   # Multi-source lyrics fetcher
└── frontend/                   # React Vite app
    ├── index.html
    ├── package.json
    ├── vite.config.js          # Dev proxy: /api → :8000
    ├── public/
    │   ├── manifest.json       # PWA manifest
    │   ├── icon.svg            # App icon
    │   ├── logo.png            # Sidebar logo
    │   └── sw.js               # Service worker (offline cache)
    └── src/
        ├── App.jsx             # Root component + routing
        ├── App.css             # Complete design system
        ├── components/
        │   ├── Player.jsx      # Bottom player bar
        │   ├── Sidebar.jsx     # Navigation + playlists
        │   ├── SearchBar.jsx   # Search with debounce
        │   ├── TrackCard.jsx   # Track + queue item
        │   ├── Recommendations.jsx  # Smart suggestions
        │   ├── ExplorePage.jsx      # Discover/explore
        │   ├── ProfilePage.jsx      # User profile + history
        │   ├── DownloadsPage.jsx    # Offline downloads
        │   ├── PlaylistManager.jsx  # Playlist editor
        │   ├── AuthModal.jsx        # Login/register
        │   ├── LyricsPanel.jsx      # Lyrics view
        │   └── Equalizer.jsx        # EQ panel
        ├── contexts/
        │   ├── PlayerContext.jsx   # Audio engine + queue + EQ
        │   ├── ThemeContext.jsx    # Dark/light mode
        │   └── AuthContext.jsx     # JWT session management
        ├── services/
        │   └── api.js             # All backend API calls
        └── utils/
            └── helpers.js         # formatTime, shuffle, debounce
```

---

## 🚀 Quick Start (Local)

### Prerequisites

- **Python 3.10+** — [python.org](https://python.org)
- **Node.js 18+** — [nodejs.org](https://nodejs.org)
- **FFmpeg** — installed and in PATH ([download](https://ffmpeg.org/download.html))

### 1. Clone the Repo

```bash
git clone https://github.com/yourusername/phantom-beats.git
cd phantom-beats
```

### 2. Backend Setup

```bash
cd backend

# (recommended) Create virtual environment
python -m venv venv

# Activate — Windows
venv\Scripts\activate
# Activate — macOS/Linux
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env   # Windows
cp .env.example .env     # macOS/Linux

# Edit .env — set a strong JWT_SECRET!
# Then start the server:
python main.py
```

✅ API running at **http://localhost:8000**  
📘 Interactive API docs at **http://localhost:8000/docs**

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

✅ App running at **http://localhost:5173**

> The Vite dev server auto-proxies `/api/*` to the backend — no CORS issues in dev.

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | **(required — change this!)** | Secret key for JWT signing |
| `JWT_EXPIRATION_HOURS` | `168` (7 days) | Token lifetime |
| `DB_PATH` | `./phantom_beats.db` | SQLite database location |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origins (comma-separated) |
| `YTDLP_MAX_RESULTS` | `20` | Max search results per query |
| `YTDLP_CACHE_TTL` | `3600` | Search cache TTL in seconds |
| `HOST` | `0.0.0.0` | Backend host |
| `PORT` | `8000` | Backend port |
| `DEBUG` | `true` | Enable hot reload (set `false` in prod) |

---

## 🎹 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `Alt + →` | Next track |
| `Alt + ←` | Previous track |
| `Shift + →` | Seek +10s |
| `Shift + ←` | Seek −10s |
| `↑ / ↓` | Volume up/down |
| `M` | Toggle mute |

---

## ☁️ Hosting Guide

### 🏆 Recommended Free Stack

| Service | What to host | Free Tier |
|---------|-------------|-----------|
| **Render.com** | Backend (FastAPI) | 750 hrs/month, auto-deploys from Git |
| **Vercel** | Frontend (React/Vite) | Unlimited static sites, global CDN |

> **Why not Cloudflare Pages for the backend?** Cloudflare Pages is a static CDN — it can't run a Python server. Cloudflare Workers *can* run code but doesn't support Python or FFmpeg, which Phantom Beats requires.

---

### Backend — Deploy to Render.com (Free)

1. **Push backend to GitHub** (you can use a monorepo).

2. Go to [render.com](https://render.com) → **New → Web Service**

3. Connect your GitHub repo, set **Root Directory** to `backend`

4. Configure the service:
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `python main.py`

5. Add **Environment Variables** in the Render dashboard:
   ```
   JWT_SECRET=your-very-secret-key-here
   JWT_EXPIRATION_HOURS=168
   CORS_ORIGINS=https://your-frontend-url.vercel.app
   DEBUG=false
   HOST=0.0.0.0
   PORT=10000
   ```

6. Make sure FFmpeg is available — Render's Python environment includes FFmpeg by default. ✅

7. Click **Deploy**. Your API will be live at `https://your-app.onrender.com`.

> ⚠️ **Note:** Render free tier spins down after 15 min of inactivity. The first request after sleep takes ~30s to wake up. Upgrade to Starter ($7/mo) to keep it always-on.

---

### Frontend — Deploy to Vercel (Free)

1. Go to [vercel.com](https://vercel.com) → **Add New Project**

2. Import your GitHub repo, set **Root Directory** to `frontend`

3. Add **Environment Variable:**
   ```
   VITE_API_BASE=https://your-backend.onrender.com
   ```

4. In `frontend/src/services/api.js`, update the base URL:
   ```js
   const API_BASE = import.meta.env.VITE_API_BASE || '/api';
   ```

5. Update `vite.config.js` — the proxy is only needed in dev, not prod.

6. Click **Deploy**. Your app will be live at `https://your-app.vercel.app`.

---

### Alternative: Self-Host with a VPS (Best for performance)

For a permanent, fast, fully-controlled deployment:

```bash
# On your VPS (Ubuntu):
# 1. Install deps
sudo apt update && sudo apt install python3 python3-pip nodejs npm ffmpeg nginx -y

# 2. Clone & build frontend
cd /var/www && git clone <repo> phantom-beats && cd phantom-beats/frontend
npm install && npm run build

# 3. Configure nginx to serve frontend + proxy API
# (see nginx.conf example below)

# 4. Run backend with systemd or pm2
cd backend && pip install gunicorn
gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

**nginx.conf example:**
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Serve built React app
    root /var/www/phantom-beats/frontend/dist;
    index index.html;
    try_files $uri /index.html;

    # Proxy API to FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## 🔧 Production Checklist

- [ ] Set a strong, random `JWT_SECRET` (e.g., `openssl rand -hex 32`)
- [ ] Set `DEBUG=false` in backend `.env`
- [ ] Set `CORS_ORIGINS` to your exact frontend URL
- [ ] Ensure FFmpeg is installed on the server
- [ ] Run `yt-dlp --update` regularly (YouTube changes frequently)
- [ ] Optionally set up periodic `pip install --upgrade yt-dlp` via cron

---

## 📄 License

[MIT](LICENSE) — free for personal and commercial use.

---

**Made with 💜 — Phantom Beats**
