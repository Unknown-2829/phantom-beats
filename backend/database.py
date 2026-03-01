"""
Phantoms Music — Database Layer
SQLite database with tables for users, playlists, playlist tracks, and search history.
Uses aiosqlite for async operations compatible with FastAPI.
"""

import aiosqlite
import json
from datetime import datetime
from config import DB_PATH


# ═══════════════════════════════════════════════════════════════════════════════
# Database Initialization
# ═══════════════════════════════════════════════════════════════════════════════

async def init_db():
    """Create all tables if they don't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript("""
            -- Users table for JWT authentication
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                avatar_url TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Playlists belonging to users
            CREATE TABLE IF NOT EXISTS playlists (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                cover_url TEXT DEFAULT '',
                is_public INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            -- Tracks within playlists (with ordering)
            CREATE TABLE IF NOT EXISTS playlist_tracks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                playlist_id INTEGER NOT NULL,
                video_id TEXT NOT NULL,
                title TEXT NOT NULL,
                artist TEXT DEFAULT 'Unknown Artist',
                thumbnail TEXT DEFAULT '',
                duration INTEGER DEFAULT 0,
                position INTEGER NOT NULL,
                added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            );

            -- Search history per user
            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                query TEXT NOT NULL,
                results_count INTEGER DEFAULT 0,
                searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Metadata cache for song details
            CREATE TABLE IF NOT EXISTS metadata_cache (
                video_id TEXT PRIMARY KEY,
                metadata TEXT NOT NULL,
                cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Create indexes for performance
            CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);
            CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);
            CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
            CREATE INDEX IF NOT EXISTS idx_metadata_cache_time ON metadata_cache(cached_at);
        """)
        await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# User Operations
# ═══════════════════════════════════════════════════════════════════════════════

async def create_user(username: str, email: str, password_hash: str) -> dict:
    """Register a new user. Returns the user dict or raises on duplicate."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, password_hash)
        )
        await db.commit()
        return {"id": cursor.lastrowid, "username": username, "email": email}


async def get_user_by_username(username: str) -> dict | None:
    """Find user by username for login."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE username = ?", (username,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def get_user_by_id(user_id: int) -> dict | None:
    """Find user by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT id, username, email, avatar_url, created_at FROM users WHERE id = ?", (user_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None


# ═══════════════════════════════════════════════════════════════════════════════
# Playlist Operations
# ═══════════════════════════════════════════════════════════════════════════════

async def create_playlist(user_id: int, name: str, description: str = "") -> dict:
    """Create a new playlist for a user."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)",
            (user_id, name, description)
        )
        await db.commit()
        return {"id": cursor.lastrowid, "name": name, "description": description, "tracks": []}


async def get_user_playlists(user_id: int) -> list:
    """Get all playlists for a user, including track count."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT p.*, COUNT(pt.id) as track_count
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.updated_at DESC
        """, (user_id,))
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


async def get_playlist(playlist_id: int) -> dict | None:
    """Get playlist with all its tracks."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        # Get playlist info
        cursor = await db.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
        playlist = await cursor.fetchone()
        if not playlist:
            return None
        result = dict(playlist)
        # Get tracks ordered by position
        cursor = await db.execute(
            "SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
            (playlist_id,)
        )
        tracks = await cursor.fetchall()
        result["tracks"] = [dict(t) for t in tracks]
        return result


async def update_playlist(playlist_id: int, name: str = None, description: str = None) -> bool:
    """Update playlist name and/or description."""
    async with aiosqlite.connect(DB_PATH) as db:
        updates = []
        params = []
        if name is not None:
            updates.append("name = ?")
            params.append(name)
        if description is not None:
            updates.append("description = ?")
            params.append(description)
        if not updates:
            return False
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(playlist_id)
        await db.execute(
            f"UPDATE playlists SET {', '.join(updates)} WHERE id = ?",
            params
        )
        await db.commit()
        return True


async def delete_playlist(playlist_id: int, user_id: int) -> bool:
    """Delete a playlist (only if owned by user)."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "DELETE FROM playlists WHERE id = ? AND user_id = ?",
            (playlist_id, user_id)
        )
        await db.commit()
        return cursor.rowcount > 0


# ═══════════════════════════════════════════════════════════════════════════════
# Playlist Track Operations
# ═══════════════════════════════════════════════════════════════════════════════

async def add_track_to_playlist(playlist_id: int, track: dict) -> dict:
    """Add a track to the end of a playlist."""
    async with aiosqlite.connect(DB_PATH) as db:
        # Get next position
        cursor = await db.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?",
            (playlist_id,)
        )
        next_pos = (await cursor.fetchone())[0]
        cursor = await db.execute(
            """INSERT INTO playlist_tracks (playlist_id, video_id, title, artist, thumbnail, duration, position)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (playlist_id, track["video_id"], track["title"],
             track.get("artist", "Unknown Artist"), track.get("thumbnail", ""),
             track.get("duration", 0), next_pos)
        )
        await db.execute("UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (playlist_id,))
        await db.commit()
        return {**track, "id": cursor.lastrowid, "position": next_pos}


async def remove_track_from_playlist(playlist_id: int, track_id: int) -> bool:
    """Remove a track and reorder remaining tracks."""
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute(
            "DELETE FROM playlist_tracks WHERE id = ? AND playlist_id = ?",
            (track_id, playlist_id)
        )
        if cursor.rowcount == 0:
            return False
        # Reorder remaining tracks
        cursor = await db.execute(
            "SELECT id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
            (playlist_id,)
        )
        rows = await cursor.fetchall()
        for i, row in enumerate(rows):
            await db.execute("UPDATE playlist_tracks SET position = ? WHERE id = ?", (i, row[0]))
        await db.commit()
        return True


async def reorder_playlist_tracks(playlist_id: int, track_ids: list[int]) -> bool:
    """Reorder tracks by providing the new order of track IDs."""
    async with aiosqlite.connect(DB_PATH) as db:
        for position, track_id in enumerate(track_ids):
            await db.execute(
                "UPDATE playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?",
                (position, track_id, playlist_id)
            )
        await db.execute("UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", (playlist_id,))
        await db.commit()
        return True


# ═══════════════════════════════════════════════════════════════════════════════
# Search History
# ═══════════════════════════════════════════════════════════════════════════════

async def save_search(user_id: int | None, query: str, results_count: int):
    """Log a search query."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO search_history (user_id, query, results_count) VALUES (?, ?, ?)",
            (user_id, query, results_count)
        )
        await db.commit()


async def get_search_history(user_id: int, limit: int = 20) -> list:
    """Get recent search history for a user."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT DISTINCT query, MAX(searched_at) as last_searched FROM search_history WHERE user_id = ? GROUP BY query ORDER BY last_searched DESC LIMIT ?",
            (user_id, limit)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]


# ═══════════════════════════════════════════════════════════════════════════════
# Metadata Cache
# ═══════════════════════════════════════════════════════════════════════════════

async def cache_metadata(video_id: str, metadata: dict):
    """Cache song metadata."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT OR REPLACE INTO metadata_cache (video_id, metadata, cached_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
            (video_id, json.dumps(metadata))
        )
        await db.commit()


async def get_cached_metadata(video_id: str, max_age_seconds: int = 3600) -> dict | None:
    """Get cached metadata if fresh enough."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM metadata_cache WHERE video_id = ? AND cached_at > datetime('now', ?)",
            (video_id, f'-{max_age_seconds} seconds')
        )
        row = await cursor.fetchone()
        if row:
            return json.loads(row["metadata"])
        return None


async def cleanup_old_cache(max_age_seconds: int = 86400):
    """Remove cache entries older than max_age_seconds."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "DELETE FROM metadata_cache WHERE cached_at < datetime('now', ?)",
            (f'-{max_age_seconds} seconds',)
        )
        await db.commit()
