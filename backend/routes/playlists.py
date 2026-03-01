"""
Phantoms Music — Playlist Routes
Full CRUD for playlists and track management.
"""

from fastapi import APIRouter, HTTPException, Depends, Body
import json
import re
import urllib.request
import asyncio
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field
from typing import Optional
from auth import require_auth
from ytmusicapi import YTMusic
import database as db

router = APIRouter(prefix="/api/playlists", tags=["Playlists"])


# ─── Request Models ───────────────────────────────────────────────────────────

class CreatePlaylistRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=500)

class UpdatePlaylistRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)

class AddTrackRequest(BaseModel):
    video_id: str
    title: str
    artist: str = "Unknown Artist"
    thumbnail: str = ""
    duration: int = 0

class ReorderRequest(BaseModel):
    track_ids: list[int]

class ImportPlaylistRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str = ""
    tracks: list[AddTrackRequest]


class ImportSpotifyRequest(BaseModel):
    url: str

# ─── Playlist CRUD ────────────────────────────────────────────────────────────

@router.get("")
async def list_playlists(user: dict = Depends(require_auth)):
    """Get all playlists for the authenticated user."""
    playlists = await db.get_user_playlists(user["id"])
    return {"playlists": playlists}


@router.post("")
async def create_playlist(req: CreatePlaylistRequest, user: dict = Depends(require_auth)):
    """Create a new playlist."""
    playlist = await db.create_playlist(user["id"], req.name, req.description)
    return {"message": "Playlist created", "playlist": playlist}


@router.get("/{playlist_id}")
async def get_playlist(playlist_id: int, user: dict = Depends(require_auth)):
    """Get a playlist with all its tracks."""
    playlist = await db.get_playlist(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"playlist": playlist}


@router.put("/{playlist_id}")
async def update_playlist(
    playlist_id: int,
    req: UpdatePlaylistRequest,
    user: dict = Depends(require_auth)
):
    """Update playlist name or description."""
    # Verify ownership
    playlist = await db.get_playlist(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.update_playlist(playlist_id, name=req.name, description=req.description)
    return {"message": "Playlist updated"}


@router.delete("/{playlist_id}")
async def delete_playlist(playlist_id: int, user: dict = Depends(require_auth)):
    """Delete a playlist."""
    deleted = await db.delete_playlist(playlist_id, user["id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Playlist not found or access denied")
    return {"message": "Playlist deleted"}


# ─── Track Management ─────────────────────────────────────────────────────────

@router.post("/{playlist_id}/tracks")
async def add_track(
    playlist_id: int,
    req: AddTrackRequest,
    user: dict = Depends(require_auth)
):
    """Add a track to a playlist."""
    playlist = await db.get_playlist(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    track = await db.add_track_to_playlist(playlist_id, req.model_dump())
    return {"message": "Track added", "track": track}


@router.delete("/{playlist_id}/tracks/{track_id}")
async def remove_track(
    playlist_id: int,
    track_id: int,
    user: dict = Depends(require_auth)
):
    """Remove a track from a playlist."""
    playlist = await db.get_playlist(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    removed = await db.remove_track_from_playlist(playlist_id, track_id)
    if not removed:
        raise HTTPException(status_code=404, detail="Track not found in playlist")
    return {"message": "Track removed"}


@router.put("/{playlist_id}/reorder")
async def reorder_tracks(
    playlist_id: int,
    req: ReorderRequest,
    user: dict = Depends(require_auth)
):
    """Reorder tracks in a playlist by providing new track ID order."""
    playlist = await db.get_playlist(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    await db.reorder_playlist_tracks(playlist_id, req.track_ids)
    return {"message": "Playlist reordered"}


# ─── Import / Export ──────────────────────────────────────────────────────────

@router.post("/import")
async def import_playlist(req: ImportPlaylistRequest, user: dict = Depends(require_auth)):
    """Import a playlist from JSON data."""
    playlist = await db.create_playlist(user["id"], req.name, req.description)
    imported_tracks = []
    for track in req.tracks:
        t = await db.add_track_to_playlist(playlist["id"], track.model_dump())
        imported_tracks.append(t)
    playlist["tracks"] = imported_tracks
    return {"message": f"Imported {len(imported_tracks)} tracks", "playlist": playlist}


@router.get("/{playlist_id}/export")
async def export_playlist(playlist_id: int, user: dict = Depends(require_auth)):
    """Export a playlist as JSON."""
    playlist = await db.get_playlist(playlist_id)
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")
    if playlist["user_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return {
        "name": playlist["name"],
        "description": playlist.get("description", ""),
        "tracks": [
            {
                "video_id": t["video_id"],
                "title": t["title"],
                "artist": t["artist"],
                "thumbnail": t["thumbnail"],
                "duration": t["duration"],
            }
            for t in playlist.get("tracks", [])
        ]
    }

@router.post("/import-spotify")
async def import_spotify_playlist(req: ImportSpotifyRequest, user: dict = Depends(require_auth)):
    """
    Import a Spotify public playlist into Phantom Beats.
    Strategy:
      1. Ask Spotify's JSON token endpoint for an anonymous bearer token
      2. Use that token to call the Spotify Web API for playlist tracks
      3. Search YouTube Music for each track title + artist
      4. Create a new playlist in Phantom Beats with the found tracks
    """
    playlist_url = req.url.split('?')[0]  # strip tracking params
    if 'open.spotify.com/playlist/' not in playlist_url:
        raise HTTPException(status_code=400, detail="Invalid Spotify playlist URL. Expected: https://open.spotify.com/playlist/...")

    # ─── Step 1: Get an anonymous Spotify access token ────────────────────────
    token = None
    BROWSER_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://open.spotify.com/',
        'Origin': 'https://open.spotify.com',
    }

    # Method A: Spotify's dedicated anonymous token endpoint (most stable)
    try:
        token_req = urllib.request.Request(
            'https://open.spotify.com/get_access_token?reason=transport&productType=web_player',
            headers=BROWSER_HEADERS
        )
        token_resp = urllib.request.urlopen(token_req, timeout=12).read()
        token_data = json.loads(token_resp.decode('utf-8'))
        token = token_data.get('accessToken')
    except Exception as e:
        print(f"[Spotify] Token endpoint failed: {e}")

    # Method B: Scrape page HTML for embedded token (fallback)
    if not token:
        try:
            page_req = urllib.request.Request(playlist_url, headers=BROWSER_HEADERS)
            html = urllib.request.urlopen(page_req, timeout=12).read().decode('utf-8')
            for pattern in [r'"accessToken":"([^"]+)"', r'access_token=([^&"]+)']: 
                m = re.search(pattern, html)
                if m:
                    token = m.group(1)
                    break
        except Exception as e:
            print(f"[Spotify] HTML scrape fallback failed: {e}")

    # ─── Step 2: Fetch playlist tracks from Spotify Web API ──────────────────
    playlist_name = "Imported Spotify Playlist"
    tracks_data = []

    pid_match = re.search(r'playlist/([a-zA-Z0-9]+)', playlist_url)
    pid = pid_match.group(1) if pid_match else None

    if token and pid:
        try:
            api_req = urllib.request.Request(
                f'https://api.spotify.com/v1/playlists/{pid}?fields=name,tracks.items(track(name,artists(name)))',
                headers={**BROWSER_HEADERS, 'Authorization': f'Bearer {token}'}
            )
            api_resp = urllib.request.urlopen(api_req, timeout=12).read()
            data = json.loads(api_resp.decode('utf-8'))
            playlist_name = data.get('name', playlist_name)
            tracks_data = data.get('tracks', {}).get('items', [])
            print(f"[Spotify] Got {len(tracks_data)} tracks via API for: {playlist_name}")
        except Exception as e:
            print(f"[Spotify] API call failed: {e}")
            token = None  # force ytmusicapi fallback

    # ─── Step 3: ytmusicapi fallback if Spotify API failed ───────────────────
    if not tracks_data:
        print("[Spotify] Falling back to ytmusicapi community playlist search...")
        try:
            ytmusic = YTMusic()
            loop = asyncio.get_event_loop()
            # Search for the playlist by its Spotify ID (community bots often sync these)
            search_q = pid or "spotify"
            pl_results = await loop.run_in_executor(None, lambda: ytmusic.search(search_q, filter="community_playlists", limit=1))
            if not pl_results:
                raise HTTPException(status_code=400, detail="Spotify is blocking requests. Try again later or paste a YouTube Music playlist link instead.")
            yt_pl_id = pl_results[0]["browseId"]
            yt_pl_data = await loop.run_in_executor(None, lambda: ytmusic.get_playlist(yt_pl_id, limit=50))
            playlist_name = yt_pl_data.get('title', playlist_name)
            tracks_data = [
                {"track": {"name": t.get("title", ""), "artists": [{"name": a.get("name", "")} for a in t.get("artists", [])]}}
                for t in yt_pl_data.get('tracks', [])
            ]
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not reach Spotify or YouTube Music. Error: {str(e)[:120]}")

    if not tracks_data:
        raise HTTPException(status_code=404, detail="No tracks found. Is the playlist public?")

    # ─── Step 4: Match each track on YouTube Music ───────────────────────────
    ytmusic = YTMusic()

    async def fetch_track(item):
        track_obj = item.get('track') if isinstance(item, dict) else item
        if not track_obj:
            return None
        title = track_obj.get('name', '') or track_obj.get('title', '')
        artists = track_obj.get('artists', [])
        artist_name = artists[0].get('name', '') if artists else ''
        if not title:
            return None
        query = f"{title} {artist_name}".strip()
        try:
            loop = asyncio.get_event_loop()
            results = await loop.run_in_executor(None, lambda: ytmusic.search(query, filter="songs", limit=1))
            if results:
                best = results[0]
                return {
                    "video_id": best["videoId"],
                    "title": best["title"],
                    "artist": best.get("artists", [{"name": artist_name}])[0]["name"],
                    "thumbnail": best.get("thumbnails", [{"url": ""}])[-1]["url"],
                    "duration": best.get("duration_seconds", 0),
                }
        except Exception as exc:
            print(f"[Spotify] YTM search failed for '{query}': {exc}")
        return None

    tasks = [fetch_track(t) for t in tracks_data[:50]]
    results = await asyncio.gather(*tasks)
    valid_tracks = [r for r in results if r]

    if not valid_tracks:
        raise HTTPException(status_code=404, detail="Could not find any matching tracks on YouTube Music. The playlist may be private or contain region-locked songs.")

    # ─── Step 5: Save to Phantom Beats ───────────────────────────────────────
    playlist = await db.create_playlist(user["id"], playlist_name, f"Imported from Spotify · {len(valid_tracks)} tracks")
    saved_tracks = []
    for t in valid_tracks:
        saved = await db.add_track_to_playlist(playlist["id"], t)
        saved_tracks.append(saved)

    playlist["tracks"] = saved_tracks
    return {"message": f"✅ Imported {len(saved_tracks)} of {len(tracks_data)} tracks from '{playlist_name}'", "playlist": playlist}

