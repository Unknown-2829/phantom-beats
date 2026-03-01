/**
 * Phantom Beats — Player Component
 * Bottom bar: track info, controls, touch-friendly seek, volume, EQ, lyrics, queue.
 * Mobile: compact Spotify-style layout with touch drag seek.
 */

import { useRef, useCallback, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { downloadTrack } from '../services/api';
import { formatTime } from '../utils/helpers';

export default function Player({ onLyricsToggle, onEqToggle, onQueueToggle, showLyrics, showEq, showQueue, onExpand }) {
    const {
        currentTrack, isPlaying, isLoading, duration, currentTime,
        volume, isMuted, repeatMode, isShuffled,
        togglePlay, seek, setVolume, toggleMute,
        playNext, playPrev, toggleRepeat, toggleShuffle,
    } = usePlayer();

    const seekBarRef = useRef(null);
    const volumeBarRef = useRef(null);
    const isSeeking = useRef(false);
    const [showMobileExtras, setShowMobileExtras] = useState(false);

    // ─── Seek helpers ────────────────────────────────────────────────────────
    const getSeekRatio = (clientX) => {
        if (!seekBarRef.current || !duration) return null;
        const rect = seekBarRef.current.getBoundingClientRect();
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    // Mouse events
    const handleSeekClick = useCallback((e) => {
        const ratio = getSeekRatio(e.clientX);
        if (ratio !== null) seek(ratio * duration);
    }, [duration, seek]);

    const handleSeekMouseDown = useCallback((e) => {
        e.preventDefault();
        isSeeking.current = true;
        const move = (ev) => {
            if (!isSeeking.current) return;
            const ratio = getSeekRatio(ev.clientX);
            if (ratio !== null) seek(ratio * duration);
        };
        const up = () => { isSeeking.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move);
        window.addEventListener('mouseup', up);
    }, [duration, seek]);

    // Touch events for mobile seek
    const handleSeekTouchStart = useCallback((e) => {
        isSeeking.current = true;
        const t = e.touches[0];
        const ratio = getSeekRatio(t.clientX);
        if (ratio !== null) seek(ratio * duration);
    }, [duration, seek]);

    const handleSeekTouchMove = useCallback((e) => {
        if (!isSeeking.current) return;
        e.preventDefault();
        const t = e.touches[0];
        const ratio = getSeekRatio(t.clientX);
        if (ratio !== null) seek(ratio * duration);
    }, [duration, seek]);

    const handleSeekTouchEnd = useCallback(() => {
        isSeeking.current = false;
    }, []);

    // Volume click
    const handleVolumeClick = useCallback((e) => {
        if (!volumeBarRef.current) return;
        const rect = volumeBarRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        setVolume(ratio);
    }, [setVolume]);

    // Download
    const handleDownload = useCallback(() => {
        if (!currentTrack) return;
        downloadTrack(currentTrack.video_id, currentTrack.title);
    }, [currentTrack]);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const volumePercent = isMuted ? 0 : volume * 100;
    const volumeIcon = isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';
    const repeatIcon = repeatMode === 'one' ? '🔂' : '🔁';

    // ─── Empty state ─────────────────────────────────────────────────────────
    if (!currentTrack) {
        return (
            <div className="app__player app__player--empty">
                <div className="player">
                    <div className="empty-state" style={{ padding: '0', flexDirection: 'row', gap: '12px' }}>
                        <span style={{ fontSize: '1.2rem', opacity: 0.4 }}>🎵</span>
                        <span className="empty-state__text" style={{ fontSize: '0.8rem' }}>
                            Search for a song to start playing
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ─── Full Player ─────────────────────────────────────────────────────────
    return (
        <div className="app__player">
            <div className="player">

                {/* ─── Track Info (tap to open full-screen) ────────────── */}
                <div
                    className="player__track-info"
                    onClick={onExpand}
                    style={{ cursor: 'pointer' }}
                    title="Expand player">
                    <div className={`player__thumb ${isPlaying ? 'spinning' : ''}`}>
                        <img
                            src={currentTrack.thumbnail || `https://img.youtube.com/vi/${currentTrack.video_id}/hqdefault.jpg`}
                            alt={currentTrack.title}
                            onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23333" width="1" height="1"/></svg>'; }}
                        />
                    </div>
                    <div style={{ minWidth: 0 }}>
                        <div className="player__title" title={currentTrack.title}>{currentTrack.title}</div>
                        <div className="player__artist" title={currentTrack.artist}>{currentTrack.artist}</div>
                    </div>
                </div>

                {/* ─── Playback Controls ──────────────────────────────────── */}
                <div className="player__controls">
                    <div className="player__buttons">
                        <button
                            className={`btn--icon ${isShuffled ? 'active' : ''}`}
                            onClick={toggleShuffle}
                            title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
                        >🔀</button>
                        <button className="btn--icon" onClick={playPrev} title="Previous">⏮</button>
                        <button className="player__play-btn" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'}>
                            {isLoading ? (
                                <div className="loading-spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
                            ) : isPlaying ? '⏸' : '▶'}
                        </button>
                        <button className="btn--icon" onClick={playNext} title="Next">⏭</button>
                        <button
                            className={`btn--icon ${repeatMode !== 'off' ? 'active' : ''}`}
                            onClick={toggleRepeat}
                            title={`Repeat: ${repeatMode}`}
                        >{repeatIcon}</button>
                    </div>

                    {/* Seek bar — mouse + touch */}
                    <div className="player__progress">
                        <span className="player__time">{formatTime(currentTime)}</span>
                        <div
                            className="player__seek-bar"
                            ref={seekBarRef}
                            onClick={handleSeekClick}
                            onMouseDown={handleSeekMouseDown}
                            onTouchStart={handleSeekTouchStart}
                            onTouchMove={handleSeekTouchMove}
                            onTouchEnd={handleSeekTouchEnd}
                            style={{ touchAction: 'none' }}
                        >
                            <div className="player__seek-fill" style={{ width: `${progress}%` }}>
                                <div className="player__seek-thumb" />
                            </div>
                        </div>
                        <span className="player__time">{formatTime(duration)}</span>
                    </div>
                </div>

                {/* ─── Extras (desktop) ───────────────────────────────────── */}
                <div className="player__extras">
                    <button className="btn--icon" onClick={handleDownload} title="Download MP3">⬇</button>
                    <button className={`btn--icon ${showQueue ? 'active' : ''}`} onClick={onQueueToggle} title="Queue">☰</button>
                    <button className={`btn--icon ${showLyrics ? 'active' : ''}`} onClick={onLyricsToggle} title="Lyrics">📝</button>
                    <button className={`btn--icon ${showEq ? 'active' : ''}`} onClick={onEqToggle} title="Equalizer">🎛️</button>
                    <div className="player__volume">
                        <button className="btn--icon" onClick={toggleMute} title="Volume">{volumeIcon}</button>
                        <div
                            className="player__volume-bar"
                            ref={volumeBarRef}
                            onClick={handleVolumeClick}
                        >
                            <div className="player__volume-fill" style={{ width: `${volumePercent}%` }} />
                        </div>
                    </div>
                </div>

                {/* ─── Mobile Extras Toggle ───────────────────────────────── */}
                <div className="player__mobile-extras-toggle">
                    <button
                        className={`btn--icon ${showMobileExtras ? 'active' : ''}`}
                        onClick={() => setShowMobileExtras(p => !p)}
                        title="More options"
                        style={{ fontSize: '1rem' }}
                    >•••</button>
                </div>

                {/* ─── Mobile Extras Drawer ───────────────────────────────── */}
                {showMobileExtras && (
                    <div className="player__mobile-extras-drawer">
                        <button className="player__mobile-action" onClick={handleDownload} title="Download">
                            <span>⬇</span><span>Download</span>
                        </button>
                        <button className={`player__mobile-action ${showQueue ? 'active' : ''}`} onClick={() => { onQueueToggle(); setShowMobileExtras(false); }} title="Queue">
                            <span>☰</span><span>Queue</span>
                        </button>
                        <button className={`player__mobile-action ${showLyrics ? 'active' : ''}`} onClick={() => { onLyricsToggle(); setShowMobileExtras(false); }} title="Lyrics">
                            <span>📝</span><span>Lyrics</span>
                        </button>
                        <button className={`player__mobile-action ${showEq ? 'active' : ''}`} onClick={() => { onEqToggle(); setShowMobileExtras(false); }} title="EQ">
                            <span>🎛️</span><span>EQ</span>
                        </button>
                        <button className="player__mobile-action" onClick={toggleMute} title="Mute">
                            <span>{volumeIcon}</span><span>{isMuted ? 'Unmute' : 'Mute'}</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
