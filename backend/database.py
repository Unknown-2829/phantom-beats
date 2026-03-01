"""
Phantoms Music — Database Layer
SQLite database with tables for users, playlists, playlist tracks, and search history.
Uses aiosqlite for async operations compatible with FastAPI.
"""

import json
from datetime import datetime
import os
import libsql_client
from config import DB_PATH, TURSO_DB_URL, TURSO_DB_AUTH_TOKEN

def get_db_client():
    """Returns a LibSQL connection, either remote (Turso) or local (SQLite)."""
    if TURSO_DB_URL and TURSO_DB_AUTH_TOKEN:
        return libsql_client.create_client(
            url=TURSO_DB_URL,
            auth_token=TURSO_DB_AUTH_TOKEN
        )
    else:
        # Fallback to local SQLite file
        local_url = f"file:{DB_PATH}"
        return libsql_client.create_client(url=local_url)

# ═══════════════════════════════════════════════════════════════════════════════
# Database Initialization
# ═══════════════════════════════════════════════════════════════════════════════

async def init_db():
    """Create all tables if they don't exist."""
    async with get_db_client() as db:
        await db.batch([
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                avatar_url TEXT DEFAULT '',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            """
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
            """,
            """
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
            """,
            """
            CREATE TABLE IF NOT EXISTS search_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                query TEXT NOT NULL,
                results_count INTEGER DEFAULT 0,
                searched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS metadata_cache (
                video_id TEXT PRIMARY KEY,
                metadata TEXT NOT NULL,
                cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            "CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist ON playlist_tracks(playlist_id);",
            "CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);",
            "CREATE INDEX IF NOT EXISTS idx_metadata_cache_time ON metadata_cache(cached_at);"
        ])


# ═══════════════════════════════════════════════════════════════════════════════
# User Operations
# ═══════════════════════════════════════════════════════════════════════════════

def row_to_dict(row, columns) -> dict:
    return {col: row[i] for i, col in enumerate(columns)}

async def create_user(username: str, email: str, password_hash: str) -> dict:
    """Register a new user. Returns the user dict or raises on duplicate."""
    async with get_db_client() as db:
        # LibSQL uses positional arguments with a tuple or list
        result = await db.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            [username, email, password_hash]
        )
        return {"id": result.last_insert_rowid, "username": username, "email": email}


async def get_user_by_username(username: str) -> dict | None:
    """Find user by username for login."""
    async with get_db_client() as db:
        result = await db.execute("SELECT * FROM users WHERE username = ?", [username])
        if not result.rows:
            return None
        return row_to_dict(result.rows[0], result.columns)


async def get_user_by_id(user_id: int) -> dict | None:
    """Find user by ID."""
    async with get_db_client() as db:
        result = await db.execute(
            "SELECT id, username, email, avatar_url, created_at FROM users WHERE id = ?", 
            [user_id]
        )
        if not result.rows:
            return None
        return row_to_dict(result.rows[0], result.columns)


# ═══════════════════════════════════════════════════════════════════════════════
# Playlist Operations
# ═══════════════════════════════════════════════════════════════════════════════

async def create_playlist(user_id: int, name: str, description: str = "") -> dict:
    """Create a new playlist for a user."""
    async with get_db_client() as db:
        result = await db.execute(
            "INSERT INTO playlists (user_id, name, description) VALUES (?, ?, ?)",
            [user_id, name, description]
        )
        return {"id": result.last_insert_rowid, "name": name, "description": description, "tracks": []}


async def get_user_playlists(user_id: int) -> list:
    """Get all playlists for a user, including track count."""
    async with get_db_client() as db:
        result = await db.execute("""
            SELECT p.*, COUNT(pt.id) as track_count
            FROM playlists p
            LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
            WHERE p.user_id = ?
            GROUP BY p.id
            ORDER BY p.updated_at DESC
        """, [user_id])
        return [row_to_dict(row, result.columns) for row in result.rows]


async def get_playlist(playlist_id: int) -> dict | None:
    """Get playlist with all its tracks."""
    async with get_db_client() as db:
        # Get playlist info
        result = await db.execute("SELECT * FROM playlists WHERE id = ?", [playlist_id])
        if not result.rows:
            return None
            
        playlist_dict = row_to_dict(result.rows[0], result.columns)
        
        # Get tracks ordered by position
        tracks_result = await db.execute(
            "SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
            [playlist_id]
        )
        
        playlist_dict["tracks"] = [row_to_dict(t, tracks_result.columns) for t in tracks_result.rows]
        return playlist_dict


async def update_playlist(playlist_id: int, name: str = None, description: str = None) -> bool:
    """Update playlist name and/or description."""
    async with get_db_client() as db:
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
        return True        )
        await db.commit()
        return True


async def delete_playlist(playlist_id: int, user_id: int) -> bool:
    """Delete a playlist (only if owned by user)."""
    async with get_db_client() as db:
        result = await db.execute(
            "DELETE FROM playlists WHERE id = ? AND user_id = ?",
            [playlist_id, user_id]
        )
        return result.rows_affected > 0


# ═══════════════════════════════════════════════════════════════════════════════
# Playlist Track Operations
# ═══════════════════════════════════════════════════════════════════════════════

async def add_track_to_playlist(playlist_id: int, track: dict) -> dict:
    """Add a track to the end of a playlist."""
    async with get_db_client() as db:
        # Get next position
        pos_result = await db.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?",
            [playlist_id]
        )
        next_pos = pos_result.rows[0][0] if pos_result.rows else 0
        
        insert_result = await db.execute(
            """INSERT INTO playlist_tracks (playlist_id, video_id, title, artist, thumbnail, duration, position)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            [playlist_id, track["video_id"], track["title"],
             track.get("artist", "Unknown Artist"), track.get("thumbnail", ""),
             track.get("duration", 0), next_pos]
        )
        await db.execute("UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", [playlist_id])
        return {**track, "id": insert_result.last_insert_rowid, "position": next_pos}


async def remove_track_from_playlist(playlist_id: int, track_id: int) -> bool:
    """Remove a track and reorder remaining tracks."""
    async with get_db_client() as db:
        del_result = await db.execute(
            "DELETE FROM playlist_tracks WHERE id = ? AND playlist_id = ?",
            [track_id, playlist_id]
        )
        if del_result.rows_affected == 0:
            return False
            
        # Reorder remaining tracks
        tracks_res = await db.execute(
            "SELECT id FROM playlist_tracks WHERE playlist_id = ? ORDER BY position",
            [playlist_id]
        )
        # We process updates in a batch for LibSQL efficiency
        statements = []
        for i, row in enumerate(tracks_res.rows):
            statements.append(libsql_client.Statement(
                "UPDATE playlist_tracks SET position = ? WHERE id = ?",
                [i, row[0]]
            ))
        if statements:
            await db.batch(statements)
            
        return True


async def reorder_playlist_tracks(playlist_id: int, track_ids: list[int]) -> bool:
    """Reorder tracks by providing the new order of track IDs."""
    async with get_db_client() as db:
        statements = []
        for position, track_id in enumerate(track_ids):
            statements.append(libsql_client.Statement(
                "UPDATE playlist_tracks SET position = ? WHERE id = ? AND playlist_id = ?",
                [position, track_id, playlist_id]
            ))
            
        statements.append(libsql_client.Statement(
            "UPDATE playlists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?", 
            [playlist_id]
        ))
        
        await db.batch(statements)
        return True


# ═══════════════════════════════════════════════════════════════════════════════
# Search History
# ═══════════════════════════════════════════════════════════════════════════════

async def save_search(user_id: int | None, query: str, results_count: int):
    """Log a search query."""
    async with get_db_client() as db:
        await db.execute(
            "INSERT INTO search_history (user_id, query, results_count) VALUES (?, ?, ?)",
            [user_id, query, results_count]
        )


async def get_search_history(user_id: int, limit: int = 20) -> list:
    """Get recent search history for a user."""
    async with get_db_client() as db:
        result = await db.execute(
            "SELECT DISTINCT query, MAX(searched_at) as last_searched FROM search_history WHERE user_id = ? GROUP BY query ORDER BY last_searched DESC LIMIT ?",
            [user_id, limit]
        )
        return [row_to_dict(row, result.columns) for row in result.rows]


# ═══════════════════════════════════════════════════════════════════════════════
# Metadata Cache
# ═══════════════════════════════════════════════════════════════════════════════

async def cache_metadata(video_id: str, metadata: dict):
    """Cache song metadata."""
    async with get_db_client() as db:
        await db.execute(
            "INSERT OR REPLACE INTO metadata_cache (video_id, metadata, cached_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
            [video_id, json.dumps(metadata)]
        )


async def get_cached_metadata(video_id: str, max_age_seconds: int = 3600) -> dict | None:
    """Get cached metadata if fresh enough."""
    async with get_db_client() as db:
        result = await db.execute(
            "SELECT * FROM metadata_cache WHERE video_id = ? AND cached_at > datetime('now', ?)",
            [video_id, f'-{max_age_seconds} seconds']
        )
        if result.rows:
            return json.loads(result.rows[0][result.columns.index('metadata')])
        return None


async def cleanup_old_cache(max_age_seconds: int = 86400):
    """Remove cache entries older than max_age_seconds."""
    async with get_db_client() as db:
        await db.execute(
            "DELETE FROM metadata_cache WHERE cached_at < datetime('now', ?)",
            [f'-{max_age_seconds} seconds']
        )
