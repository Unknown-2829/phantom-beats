/**
 * Phantoms Music — TrackCard Component
 * Displays a song as a card with thumbnail, title, artist, and actions.
 */

import { useState } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { downloadTrack } from '../services/api';
import { formatTime } from '../utils/helpers';

export default function TrackCard({ track, tracks, index, onAddToPlaylist }) {
    const { playAll, currentTrack, isPlaying, addToQueue } = usePlayer();
    const isCurrentTrack = currentTrack?.video_id === track.video_id;
    const [downloading, setDownloading] = useState(false);
    const [queued, setQueued] = useState(false);

    const handlePlay = () => {
        if (tracks) {
            playAll(tracks, index);
        } else {
            playAll([track], 0);
        }
    };

    const handleQueue = (e) => {
        e.stopPropagation();
        addToQueue(track);
        setQueued(true);
        setTimeout(() => setQueued(false), 2000);
    };

    const handleDownload = async (e) => {
        e.stopPropagation();
        if (downloading) return;
        setDownloading(true);
        try {
            await downloadTrack(track.video_id, track.title, track);
        } finally {
            setTimeout(() => setDownloading(false), 3000);
        }
    };


    return (
        <div className={`track-card ${isCurrentTrack ? 'playing' : ''}`} onClick={handlePlay}>
            <div className="track-card__thumbnail">
                <img
                    src={track.thumbnail || `https://img.youtube.com/vi/${track.video_id}/hqdefault.jpg`}
                    alt={track.title}
                    loading="lazy"
                    onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23333" width="1" height="1"/></svg>'; }}
                />
                <div className="track-card__play-overlay">
                    <button className="track-card__play-btn" aria-label="Play">
                        {isCurrentTrack && isPlaying ? '⏸' : '▶'}
                    </button>
                </div>
                {track.duration > 0 && (
                    <span className="track-card__duration">{formatTime(track.duration)}</span>
                )}
                <div className="track-card__actions">
                    <button
                        className="track-card__action-btn"
                        onClick={handleQueue}
                        aria-label="Add to queue"
                        title={queued ? 'Added!' : 'Add to queue'}
                        style={queued ? { background: 'var(--accent-primary)' } : {}}
                    >
                        {queued ? '✓' : '⊕'}
                    </button>
                    {onAddToPlaylist && (
                        <button
                            className="track-card__action-btn"
                            onClick={(e) => { e.stopPropagation(); onAddToPlaylist(track); }}
                            aria-label="Add to playlist"
                            title="Add to playlist"
                        >
                            +
                        </button>
                    )}
                    <button
                        className="track-card__action-btn"
                        onClick={handleDownload}
                        aria-label="Download"
                        title={downloading ? 'Starting download…' : 'Download MP3'}
                    >
                        {downloading ? '⏳' : '⬇'}
                    </button>
                </div>

            </div>
            <div className="track-card__info">
                <div className="track-card__title" title={track.title}>{track.title}</div>
                <div className="track-card__artist" title={track.artist}>{track.artist}</div>
            </div>
        </div>
    );
}

/**
 * List-view variant of a track item (used in playlists).
 */
export function TrackListItem({ track, index, tracks, isActive, onRemove, draggable, onDragStart, onDragOver, onDrop }) {
    const { playAll, currentTrack, isPlaying, addToQueue } = usePlayer();
    const isCurrent = currentTrack?.video_id === track.video_id;
    const [downloading, setDownloading] = useState(false);
    const [queued, setQueued] = useState(false);

    const handlePlay = () => {
        if (tracks) playAll(tracks, index);
        else playAll([track], 0);
    };

    const handleQueue = (e) => {
        e.stopPropagation();
        addToQueue(track);
        setQueued(true);
        setTimeout(() => setQueued(false), 2000);
    };

    const handleDownload = async (e) => {
        e.stopPropagation();
        if (downloading) return;
        setDownloading(true);
        try {
            await downloadTrack(track.video_id, track.title);
        } finally {
            setTimeout(() => setDownloading(false), 3000);
        }
    };

    return (
        <div
            className={`track-list-item ${isCurrent ? 'playing' : ''}`}
            onClick={handlePlay}
            draggable={draggable}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDrop={onDrop}
        >
            <span className="track-list-item__index">
                {isCurrent && isPlaying ? '🎵' : index + 1}
            </span>
            <div className="track-list-item__thumb">
                <img
                    src={track.thumbnail || `https://img.youtube.com/vi/${track.video_id}/hqdefault.jpg`}
                    alt=""
                    loading="lazy"
                    onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23333" width="1" height="1"/></svg>'; }}
                />
            </div>
            <div className="track-list-item__info">
                <div className="track-list-item__title">{track.title}</div>
                <div className="track-list-item__artist">{track.artist}</div>
            </div>
            <span className="track-list-item__duration">{formatTime(track.duration)}</span>
            <div className="track-list-item__actions">
                <button
                    className="btn--icon"
                    onClick={handleQueue}
                    title={queued ? 'Added to queue!' : 'Add to queue'}
                    style={queued ? { color: 'var(--accent-primary)' } : {}}
                >
                    {queued ? '✓' : '⊕'}
                </button>
                <button
                    className="btn--icon"
                    onClick={handleDownload}
                    title="Download"
                >
                    {downloading ? '⏳' : '⬇'}
                </button>
                {onRemove && (
                    <button
                        className="btn--icon"
                        onClick={(e) => { e.stopPropagation(); onRemove(track); }}
                        title="Remove"
                    >
                        ✕
                    </button>
                )}
            </div>
        </div>
    );
}
