"""
Phantoms Music — Search Routes
Endpoints for searching songs, autocomplete, trending, and search history.
"""

from fastapi import APIRouter, Query, Depends
from typing import Optional
from auth import get_current_user
from services.ytdlp_service import search_songs, search_autocomplete, get_trending, get_track_info, get_related_tracks
from services.lyrics_service import get_lyrics
import database as db

router = APIRouter(prefix="/api/search", tags=["Search"])


@router.get("")
async def search(
    q: str = Query(..., min_length=1, description="Search query"),
    limit: int = Query(20, ge=1, le=50),
    user: dict = Depends(get_current_user)
):
    """
    Search for songs on YouTube.
    Returns a list of tracks with metadata (title, artist, duration, thumbnail).
    """
    try:
        results = await search_songs(q, limit=limit)

        # Save search history if user is logged in
        if user:
            await db.save_search(user["id"], q, len(results))

        return {
            "query": q,
            "count": len(results),
            "results": results
        }
    except Exception as e:
        return {"query": q, "count": 0, "results": [], "error": str(e)[:200]}


@router.get("/autocomplete")
async def autocomplete(
    q: str = Query(..., min_length=1, description="Partial search query")
):
    """
    Get search suggestions / autocomplete results.
    Returns a list of suggested search strings.
    """
    suggestions = await search_autocomplete(q)
    return {"query": q, "suggestions": suggestions}


@router.get("/trending")
async def trending(
    category: str = Query("music", description="Genre category"),
    limit: int = Query(20, ge=1, le=50)
):
    """
    Get trending songs by category.
    Categories: music, pop, hiphop, rock, edm, rnb, latin, bollywood, kpop, classical, jazz, lofi
    """
    results = await get_trending(category=category, limit=limit)
    return {
        "category": category,
        "count": len(results),
        "results": results
    }


@router.get("/genres")
async def genres():
    """Return all available genre categories."""
    return {
        "genres": [
            {"id": "music",      "name": "All Music",   "icon": "🎵", "color": "#8b5cf6"},
            {"id": "pop",        "name": "Pop",          "icon": "🎤", "color": "#ec4899"},
            {"id": "hiphop",     "name": "Hip Hop",      "icon": "🎧", "color": "#f59e0b"},
            {"id": "rock",       "name": "Rock",         "icon": "🎸", "color": "#ef4444"},
            {"id": "edm",        "name": "EDM",          "icon": "🎛️", "color": "#06b6d4"},
            {"id": "rnb",        "name": "R&B / Soul",   "icon": "🎷", "color": "#8b5cf6"},
            {"id": "latin",      "name": "Latin",        "icon": "💃", "color": "#f97316"},
            {"id": "bollywood",  "name": "Bollywood",    "icon": "🎬", "color": "#e11d48"},
            {"id": "kpop",       "name": "K-Pop",        "icon": "🌸", "color": "#d946ef"},
            {"id": "jpop",       "name": "J-Pop",        "icon": "🗾", "color": "#f43f5e"},
            {"id": "anime",      "name": "Anime OST",    "icon": "⚔️", "color": "#7c3aed"},
            {"id": "classical",  "name": "Classical",    "icon": "🎻", "color": "#0ea5e9"},
            {"id": "jazz",       "name": "Jazz",         "icon": "🎺", "color": "#a855f7"},
            {"id": "lofi",       "name": "Lo-Fi",        "icon": "🌙", "color": "#6366f1"},
            {"id": "indie",      "name": "Indie",        "icon": "🌿", "color": "#10b981"},
            {"id": "metal",      "name": "Metal",        "icon": "🤘", "color": "#6b7280"},
            {"id": "country",    "name": "Country",      "icon": "🤠", "color": "#d97706"},
            {"id": "afrobeats",  "name": "Afrobeats",    "icon": "🌍", "color": "#059669"},
            {"id": "reggaeton",  "name": "Reggaeton",    "icon": "🌴", "color": "#dc2626"},
            {"id": "chill",      "name": "Chill",        "icon": "😌", "color": "#0891b2"},
            {"id": "gaming",     "name": "Gaming",       "icon": "🎮", "color": "#4f46e5"},
            {"id": "sad",        "name": "Sad",          "icon": "💔", "color": "#475569"},
            {"id": "workout",    "name": "Workout",      "icon": "💪", "color": "#dc2626"},
            {"id": "party",      "name": "Party",        "icon": "🎉", "color": "#f59e0b"},
            {"id": "podcast",    "name": "Podcast",      "icon": "🎙️", "color": "#64748b"},
        ]
    }



@router.get("/track/{video_id}")
async def track_info(video_id: str):
    """Get detailed info for a specific track."""
    info = await get_track_info(video_id)
    if "error" in info:
        return {"error": info["error"]}
    return info


@router.get("/related/{video_id}")
async def related_tracks(video_id: str, limit: int = Query(10, ge=1, le=30)):
    """Get related / recommended tracks."""
    tracks = await get_related_tracks(video_id, limit=limit)
    return {"video_id": video_id, "count": len(tracks), "results": tracks}


@router.get("/lyrics")
async def lyrics(
    title: str = Query(..., description="Song title"),
    artist: str = Query("", description="Artist name")
):
    """Fetch lyrics for a song."""
    result = await get_lyrics(title, artist)
    return result


@router.get("/history")
async def search_history(user: dict = Depends(get_current_user)):
    """Get the current user's search history."""
    if not user:
        return {"history": []}
    history = await db.get_search_history(user["id"])
    return {"history": history}
