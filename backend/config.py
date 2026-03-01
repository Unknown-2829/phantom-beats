"""
Phantoms Music — Configuration
Loads settings from environment variables with sensible defaults.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# ─── Paths & Database ─────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
DB_PATH = os.getenv("DB_PATH", str(BASE_DIR / "phantoms_music.db"))

# Turso DB Configuration
TURSO_DB_URL = os.getenv("TURSO_DB_URL", "")
TURSO_DB_AUTH_TOKEN = os.getenv("TURSO_DB_AUTH_TOKEN", "")

# ─── JWT Settings ─────────────────────────────────────────────────────────────
JWT_SECRET = os.getenv("JWT_SECRET", "phantoms-music-super-secret-key-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = int(os.getenv("JWT_EXPIRATION_HOURS", "72"))

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")

# ─── yt-dlp Settings ─────────────────────────────────────────────────────────
YTDLP_MAX_RESULTS = int(os.getenv("YTDLP_MAX_RESULTS", "20"))
YTDLP_CACHE_TTL = int(os.getenv("YTDLP_CACHE_TTL", "3600"))  # 1 hour

# ─── Server ───────────────────────────────────────────────────────────────────
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
