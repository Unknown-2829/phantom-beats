"""
Phantoms Music — Stream Routes
Smart audio proxy: serves raw WebM/Opus/M4A directly when browser-compatible,
falls back to FFmpeg MP3 conversion only when needed.
Download endpoint for saving songs as MP3.
"""

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, Response
from services.ytdlp_service import get_stream_url
import database as db
import subprocess
import shutil
import threading
import urllib.request

router = APIRouter(prefix="/api/stream", tags=["Streaming"])

FFMPEG_PATH = shutil.which("ffmpeg") or "ffmpeg"

# MIME types browsers can decode natively (no FFmpeg needed)
NATIVE_MIME_TYPES = {
    "webm": "audio/webm",
    "opus": "audio/ogg; codecs=opus",
    "ogg": "audio/ogg",
    "mp3": "audio/mpeg",
    "mp4": "audio/mp4",
    "m4a": "audio/mp4",
    "aac": "audio/aac",
}


@router.get("/{video_id}")
async def stream_audio(video_id: str):
    """Get stream URL + metadata for a video."""
    if not video_id or len(video_id) < 5:
        raise HTTPException(status_code=400, detail="Invalid video ID")

    result = await get_stream_url(video_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    if not result.get("url"):
        raise HTTPException(status_code=404, detail="No audio stream found")

    try:
        await db.cache_metadata(video_id, {
            "title": result.get("title"),
            "artist": result.get("artist"),
            "duration": result.get("duration"),
            "thumbnail": result.get("thumbnail"),
        })
    except Exception:
        pass

    return result


def _get_audio_headers(url: str) -> dict:
    """Fetch just the headers of the audio URL to get content-type/length."""
    try:
        req = urllib.request.Request(url, method="HEAD", headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        })
        with urllib.request.urlopen(req, timeout=5) as r:
            return dict(r.headers)
    except Exception:
        return {}


def _proxy_stream_raw(audio_url: str, content_type: str):
    """Stream raw audio bytes directly — no conversion, minimum latency."""
    try:
        req = urllib.request.Request(audio_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Range": "bytes=0-",
        })
        with urllib.request.urlopen(req, timeout=30) as response:
            while True:
                chunk = response.read(32768)  # 32KB
                if not chunk:
                    break
                yield chunk
    except GeneratorExit:
        pass
    except Exception as e:
        print(f"[Stream] Raw proxy error: {e}")


def _download_and_feed(audio_url: str, stdin_pipe):
    """Download audio data and feed to FFmpeg stdin."""
    try:
        req = urllib.request.Request(audio_url, headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        })
        with urllib.request.urlopen(req, timeout=60) as response:
            while True:
                chunk = response.read(65536)
                if not chunk:
                    break
                try:
                    stdin_pipe.write(chunk)
                except (BrokenPipeError, OSError):
                    break
    except Exception as e:
        print(f"[Stream] Download error: {e}")
    finally:
        try:
            stdin_pipe.close()
        except Exception:
            pass


def _proxy_stream_ffmpeg(audio_url: str):
    """
    Fallback: urllib → FFmpeg → MP3 → client.
    Used only when format isn't natively supported.
    """
    ffmpeg_proc = None
    try:
        cmd = [
            FFMPEG_PATH,
            "-i", "pipe:0",
            "-f", "mp3",
            "-ab", "192k",
            "-ar", "44100",
            "-ac", "2",
            "-vn",
            "-loglevel", "error",
            "pipe:1",
        ]
        ffmpeg_proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        download_thread = threading.Thread(
            target=_download_and_feed,
            args=(audio_url, ffmpeg_proc.stdin),
            daemon=True,
        )
        download_thread.start()

        while True:
            chunk = ffmpeg_proc.stdout.read(32768)
            if not chunk:
                break
            yield chunk

    except GeneratorExit:
        pass
    except Exception as e:
        print(f"[Stream] FFmpeg error: {e}")
    finally:
        if ffmpeg_proc:
            try:
                ffmpeg_proc.kill()
                ffmpeg_proc.wait(timeout=3)
            except Exception:
                pass


@router.get("/{video_id}/proxy")
async def stream_proxy(video_id: str, request: Request, response: Response):
    """
    Smart audio proxy that supports Range requests (seeking):
    - WebM/Opus/M4A → served raw with 206 Partial Content support
    - Other formats → FFmpeg converts to MP3 (no seeking support)
    """
    if not video_id or len(video_id) < 5:
        raise HTTPException(status_code=400, detail="Invalid video ID")

    result = await get_stream_url(video_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    audio_url = result.get("url")
    if not audio_url:
        raise HTTPException(status_code=404, detail="No audio stream found")

    fmt = result.get("ext", result.get("format", "")).lower()
    fmt = fmt.split("-")[0].split(".")[0]

    native_mime = NATIVE_MIME_TYPES.get(fmt)

    if native_mime:
        # ─── NATIVE PROXY WITH RANGE SUPPORT (ALLOWS SEEKING) ───
        req_headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        }
        
        # Forward the browser's Range request to YouTube
        range_header = request.headers.get("Range")
        if range_header:
            req_headers["Range"] = range_header
        else:
            req_headers["Range"] = "bytes=0-"

        import asyncio
        import urllib.request
        
        def _get_upstream():
            req = urllib.request.Request(audio_url, headers=req_headers)
            return urllib.request.urlopen(req, timeout=10)
            
        try:
            upstream_resp = await asyncio.to_thread(_get_upstream)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Upstream error: {str(e)}")

        resp_headers = {
            "Accept-Ranges": "bytes",
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            "Content-Disposition": "inline",
        }
        
        if "Content-Range" in upstream_resp.headers:
            resp_headers["Content-Range"] = upstream_resp.headers["Content-Range"]
        if "Content-Length" in upstream_resp.headers:
            resp_headers["Content-Length"] = upstream_resp.headers["Content-Length"]

        status_code = upstream_resp.getcode() # Usually 206 if Range was provided

        def stream_generator():
            try:
                while True:
                    chunk = upstream_resp.read(65536)
                    if not chunk:
                        break
                    yield chunk
            except Exception:
                pass
            finally:
                upstream_resp.close()

        print(f"[Stream] Native {fmt} \u2192 {native_mime} for {video_id} (Status: {status_code})")
        return StreamingResponse(
            stream_generator(),
            media_type=native_mime,
            headers=resp_headers,
            status_code=status_code
        )
    else:
        # ─── FFMPEG FALLBACK (NO SEEKING) ───
        headers = {
            "Cache-Control": "no-cache",
            "Access-Control-Allow-Origin": "*",
            "Content-Disposition": "inline",
            "Accept-Ranges": "none", # Cannot seek through live FFmpeg transcode
        }
        print(f"[Stream] FFmpeg conversion for {video_id} (format: {fmt})")
        return StreamingResponse(
            _proxy_stream_ffmpeg(audio_url),
            media_type="audio/mpeg",
            headers=headers,
        )



@router.get("/{video_id}/download")
async def download_audio(video_id: str):
    """
    Download a song as MP3 with ID3 metadata.
    IDM / download-manager compatible:
      • Proper Content-Disposition with UTF-8 encoded filename
      • Accept-Ranges: bytes (lets IDM segment download)
      • 320k MP3 with embedded title/artist metadata
    """
    if not video_id or len(video_id) < 5:
        raise HTTPException(status_code=400, detail="Invalid video ID")

    result = await get_stream_url(video_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    audio_url = result.get("url")
    if not audio_url:
        raise HTTPException(status_code=404, detail="No audio stream found")

    title = result.get("title", "audio")
    artist = result.get("artist", "Unknown")

    # Sanitize filename — remove chars illegal on Windows/Mac/Linux
    import re as _re
    safe_title = _re.sub(r'[\\/:*?"<>|]', '-', title).strip('. ')[:100]
    safe_filename = f"{safe_title}.mp3"

    # RFC 6266 Content-Disposition: ASCII fallback + UTF-8 filename*
    try:
        ascii_name = safe_filename.encode('ascii').decode('ascii')
        content_disposition = f'attachment; filename="{ascii_name}"'
    except UnicodeEncodeError:
        from urllib.parse import quote
        encoded = quote(safe_filename, safe='-_.~')
        content_disposition = f"attachment; filename=\"download.mp3\"; filename*=UTF-8''{encoded}"

    def _generate_mp3():
        proc = None
        try:
            cmd = [
                FFMPEG_PATH,
                "-i", "pipe:0",
                "-f", "mp3",
                "-ab", "320k",
                "-ar", "44100",
                "-ac", "2",
                "-vn",
                "-metadata", f"title={title}",
                "-metadata", f"artist={artist}",
                "-loglevel", "error",
                "pipe:1",
            ]
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )
            t = threading.Thread(
                target=_download_and_feed,
                args=(audio_url, proc.stdin),
                daemon=True,
            )
            t.start()
            while True:
                chunk = proc.stdout.read(65536)
                if not chunk:
                    break
                yield chunk
        except GeneratorExit:
            pass
        except Exception as e:
            print(f"[Download] Error: {e}")
        finally:
            if proc:
                try:
                    proc.kill()
                    proc.wait(timeout=3)
                except Exception:
                    pass

    return StreamingResponse(
        _generate_mp3(),
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": content_disposition,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Content-Disposition",
            "Accept-Ranges": "bytes",
            "X-Content-Type-Options": "nosniff",
        }
    )


@router.get("/{video_id}/download-url")
async def get_download_url(video_id: str):
    """
    Returns the direct MP3-convertible audio URL and a pre-built download link.
    IDM, aria2, wget etc. can use the download link directly.
    """
    if not video_id or len(video_id) < 5:
        raise HTTPException(status_code=400, detail="Invalid video ID")

    result = await get_stream_url(video_id)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    title = result.get("title", "Unknown")
    artist = result.get("artist", "Unknown")

    # The /download endpoint is IDM-compatible
    from config import HOST, PORT
    base = f"http://{HOST}:{PORT}"

    return {
        "video_id": video_id,
        "title": title,
        "artist": artist,
        "download_url": f"{base}/api/stream/{video_id}/download",
        "proxy_url": f"{base}/api/stream/{video_id}/proxy",
    }

