"""
Phantoms Music — yt-dlp Service
Wraps yt-dlp for searching YouTube, extracting audio stream URLs,
fetching track metadata, and getting recommendations.
"""

import yt_dlp
import asyncio
import hashlib
import time
import os
import tempfile
from functools import lru_cache
from typing import Optional
from config import YTDLP_MAX_RESULTS, YTDLP_CACHE_TTL

# ═══════════════════════════════════════════════════════════════════════════════
# YouTube Bot Protection (Cookies Bypass)
# ═══════════════════════════════════════════════════════════════════════════════
# YouTube aggressively blocks datacenter IPs (like Render) with "Sign in" errors.
# To bypass permanently without crashing Render's ENV limits, upload the cookies.txt
# file using Render's "Secret Files" feature, mapped to /etc/secrets/cookies.txt.

# Also support a local cookies.txt file in the backend root for development
import shutil

cookie_file_path = None
render_secret_path = "/etc/secrets/cookies.txt"
local_dev_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cookies.txt")

source_path = None
if os.path.exists(render_secret_path):
    print(f"[Phantom/yt-dlp] ✅ SECRETS MOUNT DETECTED: {render_secret_path}")
    source_path = render_secret_path
elif os.path.exists(local_dev_path):
    print(f"[Phantom/yt-dlp] ✅ LOCAL DEV COOKIES DETECTED: {local_dev_path}")
    source_path = local_dev_path
else:
    print(f"[Phantom/yt-dlp] ❌ WARNING: NO COOKIE FILE FOUND AT {render_secret_path}")

if source_path:
    try:
        writable_cookie_path = os.path.join(tempfile.gettempdir(), "phantom_working_cookies.txt")
        shutil.copy2(source_path, writable_cookie_path)
        cookie_file_path = writable_cookie_path
        
        # Verify file size to ensure the user didn't upload an empty file
        size_kb = os.path.getsize(cookie_file_path) / 1024
        print(f"[Phantom/yt-dlp] ✅ Success: Copied cookies to {cookie_file_path} ({size_kb:.1f} KB)")
        if size_kb < 1:
            print("[Phantom/yt-dlp] ❌ ERROR: Cookie file is almost empty! Did you paste the text correctly?")
            
    except Exception as e:
        print(f"[Phantom/yt-dlp] ❌ Warning: Could not copy cookies to writable path: {e}")
        cookie_file_path = source_path  # Fallback to read-only


# ═══════════════════════════════════════════════════════════════════════════════
# In-memory cache for stream URLs (they expire quickly)
# ═══════════════════════════════════════════════════════════════════════════════
_stream_cache: dict[str, dict] = {}
_search_cache: dict[str, dict] = {}


def _cache_key(prefix: str, value: str) -> str:
    return f"{prefix}:{hashlib.md5(value.encode()).hexdigest()}"


def _is_cache_valid(entry: dict, ttl: int = YTDLP_CACHE_TTL) -> bool:
    return (time.time() - entry.get("timestamp", 0)) < ttl


# ═══════════════════════════════════════════════════════════════════════════════
# yt-dlp Options
# ═══════════════════════════════════════════════════════════════════════════════

BASE_OPTS = {
    "quiet": True,
    "no_warnings": True,
    "extract_flat": False,
    "geo_bypass": True,
    "nocheckcertificate": True,
    "cookiefile": cookie_file_path,  # Uses the dynamic cookies file if provided
    "http_headers": {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
    "geo_bypass_country": "IN",
    "source_address": "0.0.0.0",
    "force_ipv4": True,
}

SEARCH_OPTS = {
    **BASE_OPTS,
    "extract_flat": True,       # Don't download, just get metadata
    "skip_download": True,
    "default_search": "ytsearch",
}

STREAM_OPTS = {
    **BASE_OPTS,
    "format": "bestaudio/best",
    "skip_download": True,
}

INFO_OPTS = {
    **BASE_OPTS,
    "skip_download": True,
}


# ═══════════════════════════════════════════════════════════════════════════════
# Search Functions
# ═══════════════════════════════════════════════════════════════════════════════

def _parse_track(entry: dict) -> dict:
    """Parse a yt-dlp entry into a clean track dict."""
    video_id = entry.get("id", entry.get("url", ""))
    # Handle various thumbnail formats
    thumbnails = entry.get("thumbnails", [])
    thumbnail = ""
    if thumbnails:
        # Get highest quality thumbnail
        thumbnail = thumbnails[-1].get("url", "")
    elif entry.get("thumbnail"):
        thumbnail = entry["thumbnail"]
    else:
        thumbnail = f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"

    return {
        "video_id": video_id,
        "title": entry.get("title", "Unknown Title"),
        "artist": entry.get("uploader", entry.get("channel", "Unknown Artist")),
        "duration": entry.get("duration", 0) or 0,
        "thumbnail": thumbnail,
        "view_count": entry.get("view_count", 0) or 0,
        "url": f"https://www.youtube.com/watch?v={video_id}",
    }


MAX_SONG_DURATION = 600  # 10 minutes — filter out compilations/playlists


def _is_valid_song(entry: dict) -> bool:
    """Filter out compilations, playlists, and non-music content."""
    duration = entry.get("duration", 0) or 0
    if duration > MAX_SONG_DURATION or duration < 30:
        return False  # Skip very long (compilations) or very short (intros) videos
    title = (entry.get("title") or "").lower()
    # Skip common non-song patterns
    skip_words = ["playlist", "compilation", "mix 20", "top 10", "top 20", "top 25", "top 50", "hours of", "full album"]
    if any(w in title for w in skip_words):
        return False
    return True


async def search_songs(query: str, limit: int = None) -> list[dict]:
    """
    Search YouTube for songs matching the query.
    Returns a list of track dicts, filtered to individual songs only.
    """
    if not query or not query.strip():
        return []

    max_results = limit or YTDLP_MAX_RESULTS
    cache_k = _cache_key("search", f"{query}:{max_results}")

    # Check cache
    if cache_k in _search_cache and _is_cache_valid(_search_cache[cache_k]):
        return _search_cache[cache_k]["data"]

    # Request extra results since we filter some out
    fetch_count = min(max_results * 3, 50)
    # Add "song" to help YouTube return individual tracks
    search_query = f"ytsearch{fetch_count}:{query} song"

    opts = {**SEARCH_OPTS}

    def _do_search():
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                result = ydl.extract_info(search_query, download=False)
                if not result:
                    return []
                entries = result.get("entries", [])
                tracks = [_parse_track(e) for e in entries if e and _is_valid_song(e)]
                return tracks[:max_results]
        except Exception as e:
            print(f"[yt-dlp] Search error: {e}")
            return []

    # Run in thread pool to avoid blocking the event loop
    loop = asyncio.get_event_loop()
    tracks = await loop.run_in_executor(None, _do_search)

    # Cache results
    _search_cache[cache_k] = {"data": tracks, "timestamp": time.time()}

    return tracks


async def search_autocomplete(query: str) -> list[str]:
    """
    Get search suggestions / autocomplete for a partial query.
    Uses YouTube's suggestion API via a simple HTTP request.
    """
    if not query or not query.strip():
        return []

    import urllib.request
    import json

    def _fetch_suggestions():
        try:
            url = f"https://suggestqueries-clients6.youtube.com/complete/search?client=youtube&q={urllib.parse.quote(query)}&ds=yt"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=3) as response:
                # Response is JSONP, parse it
                text = response.read().decode("utf-8")
                # Extract JSON from JSONP: window.google.ac.h(...)
                start = text.index("(") + 1
                end = text.rindex(")")
                data = json.loads(text[start:end])
                if data and len(data) > 1:
                    return [item[0] for item in data[1][:8]]
        except Exception as e:
            print(f"[yt-dlp] Autocomplete error: {e}")
        return []

    import urllib.parse
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch_suggestions)


# ═══════════════════════════════════════════════════════════════════════════════
# Stream Extraction
# ═══════════════════════════════════════════════════════════════════════════════

async def get_stream_url(video_id: str) -> dict:
    """
    Extract the best audio stream URL for a given video ID.
    Returns dict with url, format, bitrate, etc.
    """
    cache_k = _cache_key("stream", video_id)

    # Stream URLs expire quickly (~6 hours), cache for 30 min
    if cache_k in _stream_cache and _is_cache_valid(_stream_cache[cache_k], ttl=1800):
        return _stream_cache[cache_k]["data"]

    video_url = f"https://www.youtube.com/watch?v={video_id}"

    def _extract():
        try:
            with yt_dlp.YoutubeDL(STREAM_OPTS) as ydl:
                info = ydl.extract_info(video_url, download=False)
                if not info:
                    return {"error": "Could not extract stream info"}

                # Get the best audio URL
                stream_url = info.get("url", "")
                if not stream_url:
                    # Try formats list
                    formats = info.get("formats", [])
                    audio_formats = [
                        f for f in formats
                        if f.get("acodec") != "none" and f.get("vcodec") in ("none", None)
                    ]
                    if audio_formats:
                        # Sort by bitrate, highest first
                        audio_formats.sort(key=lambda f: f.get("abr", 0) or 0, reverse=True)
                        stream_url = audio_formats[0].get("url", "")

                return {
                    "url": stream_url,
                    "title": info.get("title", "Unknown"),
                    "artist": info.get("uploader", "Unknown Artist"),
                    "duration": info.get("duration", 0),
                    "thumbnail": info.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
                    "format": info.get("ext", "m4a"),
                    "bitrate": info.get("abr", 128),
                    "video_id": video_id,
                }
        except yt_dlp.utils.DownloadError as e:
            error_msg = str(e)
            if "Private video" in error_msg:
                return {"error": "This video is private and cannot be played"}
            elif "Video unavailable" in error_msg:
                return {"error": "This video is unavailable in your region"}
            elif "429" in error_msg or "rate" in error_msg.lower():
                return {"error": "Too many requests. Please try again in a moment"}
            return {"error": f"Cannot play this track: {error_msg[:100]}"}
        except Exception as e:
            return {"error": f"Stream extraction failed: {str(e)[:100]}"}

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _extract)

    # Cache successful extractions
    if "error" not in result:
        _stream_cache[cache_k] = {"data": result, "timestamp": time.time()}

    return result


# ═══════════════════════════════════════════════════════════════════════════════
# Track Info & Recommendations
# ═══════════════════════════════════════════════════════════════════════════════

async def get_track_info(video_id: str) -> dict:
    """Get detailed info for a specific track."""
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    def _extract():
        try:
            with yt_dlp.YoutubeDL(INFO_OPTS) as ydl:
                info = ydl.extract_info(video_url, download=False)
                if not info:
                    return {"error": "Track not found"}
                return _parse_track(info)
        except Exception as e:
            return {"error": str(e)[:100]}

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _extract)


async def get_related_tracks(video_id: str, limit: int = 10) -> list[dict]:
    """Get related / recommended tracks based on a video ID."""
    video_url = f"https://www.youtube.com/watch?v={video_id}"

    def _extract():
        try:
            opts = {
                **INFO_OPTS,
                "extract_flat": True,
            }
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                if not info:
                    return []
                # yt-dlp sometimes provides related entries
                entries = info.get("entries", [])
                # If no entries in result, try fetching from a playlist/mix
                if not entries:
                    # Try YouTube Mix
                    mix_url = f"https://www.youtube.com/watch?v={video_id}&list=RD{video_id}"
                    try:
                        mix_info = ydl.extract_info(mix_url, download=False)
                        entries = mix_info.get("entries", []) if mix_info else []
                    except Exception:
                        pass
                return [_parse_track(e) for e in entries[:limit] if e and e.get("id") != video_id]
        except Exception as e:
            print(f"[yt-dlp] Related tracks error: {e}")
            return []

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _extract)


async def get_trending(category: str = "music", limit: int = 20) -> list[dict]:
    """Get trending music from YouTube — individual songs only."""
    # Request extra to compensate for duration filtering
    fetch_count = min(limit * 3, 50)
    is_podcast = category == "podcast"

    queries = {
        "music":      f"ytsearch{fetch_count}:new hit song official audio 2025",
        "pop":        f"ytsearch{fetch_count}:pop song official audio 2025",
        "hiphop":     f"ytsearch{fetch_count}:hip hop rap song official audio 2025",
        "rock":       f"ytsearch{fetch_count}:rock song official audio 2025",
        "edm":        f"ytsearch{fetch_count}:EDM electronic song official 2025",
        "rnb":        f"ytsearch{fetch_count}:R&B soul song official audio 2025",
        "latin":      f"ytsearch{fetch_count}:latin reggaeton song official 2025",
        "bollywood":  f"ytsearch{fetch_count}:hindi bollywood song official audio 2025",
        "kpop":       f"ytsearch{fetch_count}:kpop song official MV 2025",
        "jpop":       f"ytsearch{fetch_count}:japanese pop song official audio 2025",
        "anime":      f"ytsearch{fetch_count}:anime opening ending theme song full",
        "classical":  f"ytsearch{fetch_count}:classical music orchestral piece",
        "jazz":       f"ytsearch{fetch_count}:jazz song live performance",
        "lofi":       f"ytsearch{fetch_count}:lofi hip hop chill beats",
        "indie":      f"ytsearch{fetch_count}:indie pop song 2025 official",
        "metal":      f"ytsearch{fetch_count}:metal rock song official audio 2025",
        "country":    f"ytsearch{fetch_count}:country song official audio 2025",
        "afrobeats":  f"ytsearch{fetch_count}:afrobeats afropop song official 2025",
        "reggaeton":  f"ytsearch{fetch_count}:reggaeton song official 2025",
        "chill":      f"ytsearch{fetch_count}:chill relaxing music acoustic song",
        "gaming":     f"ytsearch{fetch_count}:video game soundtrack epic music",
        "sad":        f"ytsearch{fetch_count}:sad emotional song heartbreak 2025",
        "workout":    f"ytsearch{fetch_count}:gym workout motivation music 2025",
        "party":      f"ytsearch{fetch_count}:party hits dance song 2025",
        "podcast":    f"ytsearch{fetch_count}:podcast episode 2025 interview",
    }

    search_query = queries.get(category, queries["music"])

    def _fetch():
        try:
            with yt_dlp.YoutubeDL(SEARCH_OPTS) as ydl:
                result = ydl.extract_info(search_query, download=False)
                if not result:
                    return []
                entries = result.get("entries", [])
                # Podcasts have longer duration — allow up to 90 min
                max_dur = 5400 if is_podcast else MAX_SONG_DURATION
                min_dur = 60 if is_podcast else 30
                filtered = [
                    e for e in entries
                    if e and (min_dur <= (e.get("duration") or 0) <= max_dur)
                ]
                tracks = [_parse_track(e) for e in filtered]
                return tracks[:limit]
        except Exception as e:
            print(f"[yt-dlp] Trending error: {e}")
            return []

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch)



def clear_caches():
    """Clear all in-memory caches."""
    global _stream_cache, _search_cache
    now = time.time()
    # Remove expired entries
    _stream_cache = {k: v for k, v in _stream_cache.items() if _is_cache_valid(v, 1800)}
    _search_cache = {k: v for k, v in _search_cache.items() if _is_cache_valid(v)}
