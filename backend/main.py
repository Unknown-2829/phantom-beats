"""
╔═══════════════════════════════════════════════════════════════════════════════╗
║                        🎵 PHANTOMS MUSIC — Server                          ║
║                                                                             ║
║  Advanced free web music player powered by FastAPI + yt-dlp.                ║
║  Streams HD audio from YouTube's massive catalog.                           ║
║                                                                             ║
║  Run:  uvicorn main:app --reload --host 0.0.0.0 --port 8000                ║
║  Docs: http://localhost:8000/docs                                           ║
╚═══════════════════════════════════════════════════════════════════════════════╝
"""

import sys
import os

# Ensure backend directory is in the path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import asyncio

from config import CORS_ORIGINS, HOST, PORT, DEBUG
import database as db
from services.ytdlp_service import clear_caches

# Import route modules
from routes.search import router as search_router
from routes.stream import router as stream_router
from routes.playlists import router as playlist_router
from routes.auth_routes import router as auth_router


# ═══════════════════════════════════════════════════════════════════════════════
# App Lifespan (startup & shutdown)
# ═══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup, cleanup on shutdown."""
    print("🎵 Phantoms Music — Starting up...")
    await db.init_db()
    print("✅ Database initialized")

    # Start periodic cache cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())

    yield

    # Shutdown
    cleanup_task.cancel()
    clear_caches()
    print("👋 Phantoms Music — Shut down complete")


async def periodic_cleanup():
    """Periodically clean up old cache entries."""
    while True:
        try:
            await asyncio.sleep(3600)  # Every hour
            await db.cleanup_old_cache()
            clear_caches()
            print("🧹 Cache cleanup completed")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"⚠️ Cache cleanup error: {e}")


# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI Application
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Phantoms Music",
    description="🎵 Advanced free web music player — stream HD audio from YouTube's massive library",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if DEBUG else None,
    redoc_url="/redoc" if DEBUG else None,
)

# ─── CORS Middleware ──────────────────────────────────────────────────────────
allow_all = "*" in CORS_ORIGINS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if not allow_all else [],
    allow_origin_regex=r".*" if allow_all else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Global Error Handler ────────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Catch-all error handler for unhandled exceptions."""
    print(f"❌ Unhandled error: {exc}")
    return JSONResponse(
        status_code=500,
        content={
            "error": "An unexpected error occurred",
            "detail": str(exc)[:200] if DEBUG else "Internal server error"
        }
    )


# ─── Register Routers ────────────────────────────────────────────────────────
app.include_router(search_router)
app.include_router(stream_router)
app.include_router(playlist_router)
app.include_router(auth_router)


# ─── Health Check & Info ──────────────────────────────────────────────────────

@app.get("/", tags=["Info"])
async def root():
    return {
        "name": "Phantoms Music",
        "version": "1.0.0",
        "description": "🎵 Advanced free web music player",
        "endpoints": {
            "docs": "/docs",
            "search": "/api/search?q=<query>",
            "autocomplete": "/api/search/autocomplete?q=<query>",
            "trending": "/api/search/trending?category=music",
            "genres": "/api/search/genres",
            "stream": "/api/stream/<video_id>",
            "playlists": "/api/playlists",
            "auth": "/api/auth/login | /api/auth/register",
        }
    }


@app.get("/health", tags=["Info"])
async def health_check():
    return {"status": "healthy", "service": "phantoms-music"}


# ═══════════════════════════════════════════════════════════════════════════════
# Run with: python main.py
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=HOST, port=PORT, reload=DEBUG)
