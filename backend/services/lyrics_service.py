"""
Phantoms Music — Lyrics Service
Fetches song lyrics from multiple free sources (no API key needed).
"""

import urllib.request
import urllib.parse
import json
import re
import asyncio
from typing import Optional


async def get_lyrics(title: str, artist: str = "") -> dict:
    """
    Fetch lyrics for a song. Tries multiple free sources in order:
    1. lrclib.net (best for synced/modern songs)
    2. lyrics.ovh (broad catalog)
    """
    # Clean title for better matching
    clean_title = _clean_title(title)

    # Try lrclib.net first (better for modern songs, supports Japanese etc)
    result = await _try_lrclib(clean_title, artist)
    if result:
        return result

    # Try lyrics.ovh
    result = await _try_lyrics_ovh(clean_title, artist)
    if result:
        return result

    # Fallback: try with original title
    result = await _try_lrclib(title, artist)
    if result:
        return result

    return {
        "lyrics": None,
        "source": None,
        "error": "Lyrics not found for this track"
    }


def _clean_title(title: str) -> str:
    """Remove common YouTube suffixes from title."""
    clean = re.sub(
        r'\s*[\(\[](official|music|lyric|lyrics|audio|video|hd|hq|4k|mv|ft\.?|feat\.?|full).*?[\)\]]',
        '', title, flags=re.IGNORECASE
    ).strip()
    # Also remove "- Topic" suffix
    clean = re.sub(r'\s*-\s*Topic\s*$', '', clean, flags=re.IGNORECASE)
    return clean


async def _try_lrclib(title: str, artist: str) -> Optional[dict]:
    """Try to get lyrics from lrclib.net (free, no key, good catalog)."""
    def _fetch():
        try:
            # Build search query
            query = f"{artist} {title}".strip() if artist else title
            url = f"https://lrclib.net/api/search?q={urllib.parse.quote(query)}"

            req = urllib.request.Request(url, headers={
                "User-Agent": "PhantomMusic/1.0 (https://github.com/phantom)",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode("utf-8"))

                if data and len(data) > 0:
                    # Get the best match
                    best = data[0]
                    lyrics = best.get("plainLyrics") or best.get("syncedLyrics", "")

                    if lyrics and len(lyrics.strip()) > 20:
                        return {
                            "lyrics": lyrics.strip(),
                            "source": "lrclib.net",
                            "title": best.get("trackName", title),
                            "artist": best.get("artistName", artist),
                            "synced": bool(best.get("syncedLyrics"))
                        }
        except Exception:
            pass
        return None

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch)


async def _try_lyrics_ovh(title: str, artist: str) -> Optional[dict]:
    """Try to get lyrics from lyrics.ovh"""
    def _fetch():
        try:
            if artist:
                url = f"https://api.lyrics.ovh/v1/{urllib.parse.quote(artist)}/{urllib.parse.quote(title)}"
            else:
                # Try to split "Artist - Title" format
                parts = title.split(" - ", 1)
                if len(parts) == 2:
                    url = f"https://api.lyrics.ovh/v1/{urllib.parse.quote(parts[0].strip())}/{urllib.parse.quote(parts[1].strip())}"
                else:
                    return None

            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json"
            })
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode("utf-8"))
                lyrics_text = data.get("lyrics", "")
                if lyrics_text and len(lyrics_text.strip()) > 20:
                    return {
                        "lyrics": lyrics_text.strip(),
                        "source": "lyrics.ovh",
                        "title": title,
                        "artist": artist
                    }
        except Exception:
            pass
        return None

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _fetch)
