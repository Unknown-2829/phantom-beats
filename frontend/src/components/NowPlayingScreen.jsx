/**
 * Phantom Beats — Now Playing (Full-Screen View)
 * Spotify-style full-screen player. Opens when user taps anywhere on the mini player bar.
 * Swipe down or tap × to dismiss.
 */

import { useRef, useCallback, useEffect, useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { downloadTrack } from '../services/api';
import { formatTime } from '../utils/helpers';

export default function NowPlayingScreen({ onClose, onLyricsToggle, onEqToggle, showLyrics, showEq }) {
    const {
        currentTrack, isPlaying, isLoading, duration, currentTime,
        volume, isMuted, repeatMode, isShuffled,
        togglePlay, seek, setVolume, toggleMute,
        playNext, playPrev, toggleRepeat, toggleShuffle,
        queue, queueIndex, addToQueue,
    } = usePlayer();

    const seekBarRef = useRef(null);
    const isSeeking = useRef(false);
    const startY = useRef(0);
    const [dragY, setDragY] = useState(0);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);

    const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
    const repeatIcon = repeatMode === 'one' ? '🔂' : '🔁';
    const volumeIcon = isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊';

    // ─── Seek helpers ─────────────────────────────────────────────────────────
    const getSeekRatio = (clientX) => {
        if (!seekBarRef.current || !duration) return null;
        const rect = seekBarRef.current.getBoundingClientRect();
        return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    };

    const handleSeekClick = (e) => {
        const ratio = getSeekRatio(e.clientX);
        if (ratio !== null) seek(ratio * duration);
    };

    const handleSeekTouchStart = (e) => {
        isSeeking.current = true;
        const t = e.touches[0];
        const ratio = getSeekRatio(t.clientX);
        if (ratio !== null) seek(ratio * duration);
    };

    const handleSeekTouchMove = (e) => {
        if (!isSeeking.current) return;
        e.preventDefault();
        const t = e.touches[0];
        const ratio = getSeekRatio(t.clientX);
        if (ratio !== null) seek(ratio * duration);
    };

    const handleSeekTouchEnd = () => { isSeeking.current = false; };

    // ─── Swipe-down to close ──────────────────────────────────────────────────
    const handlePanelTouchStart = (e) => {
        startY.current = e.touches[0].clientY;
    };
    const handlePanelTouchMove = (e) => {
        const dy = e.touches[0].clientY - startY.current;
        if (dy > 0) setDragY(dy);
    };
    const handlePanelTouchEnd = () => {
        if (dragY > 120) onClose();
        setDragY(0);
    };

    // Close on Escape
    useEffect(() => {
        const onKey = (e) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    if (!currentTrack) return null;

    const thumbnail = currentTrack.thumbnail ||
        `https://img.youtube.com/vi/${currentTrack.video_id}/hqdefault.jpg`;

    return (
        <div
            className="now-playing-screen"
            style={{ transform: `translateY(${dragY}px)`, opacity: dragY > 0 ? Math.max(0.3, 1 - dragY / 300) : 1 }}
        >
            {/* Drag handle */}
            <div
                className="now-playing-screen__handle-area"
                onTouchStart={handlePanelTouchStart}
                onTouchMove={handlePanelTouchMove}
                onTouchEnd={handlePanelTouchEnd}
            >
                <div className="now-playing-screen__handle" />
            </div>

            {/* Header */}
            <div className="now-playing-screen__header">
                <button className="now-playing-screen__close" onClick={onClose} aria-label="Close">
                    ⌄
                </button>
                <span className="now-playing-screen__playing-from">Now Playing</span>
                <button
                    className="now-playing-screen__more"
                    onClick={() => downloadTrack(currentTrack.video_id, currentTrack.title)}
                    title="Download"
                >
                    ⬇
                </button>
            </div>

            {/* Album Art */}
            <div className="now-playing-screen__art-wrap">
                <div className={`now-playing-screen__art ${isPlaying ? 'is-playing' : ''}`}>
                    <img src={thumbnail} alt={currentTrack.title} />
                </div>
            </div>

            {/* Track Info */}
            <div className="now-playing-screen__info">
                <div>
                    <div className="now-playing-screen__title">{currentTrack.title}</div>
                    <div className="now-playing-screen__artist">{currentTrack.artist}</div>
                </div>
                <button
                    className={`now-playing-screen__like ${isShuffled ? 'active' : ''}`}
                    onClick={toggleShuffle}
                    title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
                >
                    🔀
                </button>
            </div>

            {/* Seek Bar */}
            <div className="now-playing-screen__seek-section">
                <div
                    className="now-playing-screen__seek-bar"
                    ref={seekBarRef}
                    onClick={handleSeekClick}
                    onTouchStart={handleSeekTouchStart}
                    onTouchMove={handleSeekTouchMove}
                    onTouchEnd={handleSeekTouchEnd}
                    style={{ touchAction: 'none' }}
                >
                    <div className="now-playing-screen__seek-fill" style={{ width: `${progress}%` }}>
                        <div className="now-playing-screen__seek-thumb" />
                    </div>
                </div>
                <div className="now-playing-screen__times">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                </div>
            </div>

            {/* Main Controls */}
            <div className="now-playing-screen__controls">
                <button
                    className={`now-playing-screen__ctrl ${repeatMode !== 'off' ? 'active' : ''}`}
                    onClick={toggleRepeat}
                    title={`Repeat: ${repeatMode}`}
                >{repeatIcon}</button>

                <button className="now-playing-screen__ctrl" onClick={playPrev} title="Previous">⏮</button>

                <button className="now-playing-screen__play-btn" onClick={togglePlay}>
                    {isLoading
                        ? <div className="loading-spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
                        : isPlaying ? '⏸' : '▶'
                    }
                </button>

                <button className="now-playing-screen__ctrl" onClick={playNext} title="Next">⏭</button>

                <button
                    className={`now-playing-screen__ctrl ${isMuted ? 'active' : ''}`}
                    onClick={toggleMute}
                    title="Mute/Unmute"
                >{volumeIcon}</button>
            </div>

            {/* Extra Actions Row */}
            <div className="now-playing-screen__extras">
                <button
                    className={`now-playing-screen__extra-btn ${showLyrics ? 'active' : ''}`}
                    onClick={onLyricsToggle}
                >
                    <span>📝</span>
                    <span>Lyrics</span>
                </button>
                <button
                    className={`now-playing-screen__extra-btn ${showEq ? 'active' : ''}`}
                    onClick={onEqToggle}
                >
                    <span>🎛️</span>
                    <span>EQ</span>
                </button>
                <button
                    className="now-playing-screen__extra-btn"
                    onClick={() => setShowVolumeSlider(p => !p)}
                >
                    <span>{volumeIcon}</span>
                    <span>Volume</span>
                </button>
                <button
                    className="now-playing-screen__extra-btn"
                    onClick={() => downloadTrack(currentTrack.video_id, currentTrack.title)}
                >
                    <span>⬇</span>
                    <span>Save</span>
                </button>
            </div>

            {/* Volume Slider (shown when toggled) */}
            {showVolumeSlider && (
                <div className="now-playing-screen__volume-row">
                    <span>🔈</span>
                    <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => { setVolume(parseFloat(e.target.value)); }}
                        className="now-playing-screen__volume-slider"
                        aria-label="Volume"
                    />
                    <span>🔊</span>
                </div>
            )}

            {/* Up Next mini-list */}
            {queue.length > 1 && (
                <div className="now-playing-screen__up-next">
                    <div className="now-playing-screen__up-next-title">Up Next</div>
                    {queue.slice(queueIndex + 1, queueIndex + 4).map((t, i) => (
                        <div key={t.video_id + i} className="now-playing-screen__up-next-item">
                            <img src={t.thumbnail || `https://img.youtube.com/vi/${t.video_id}/hqdefault.jpg`} alt="" />
                            <div>
                                <div className="now-playing-screen__up-next-name">{t.title}</div>
                                <div className="now-playing-screen__up-next-artist">{t.artist}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
