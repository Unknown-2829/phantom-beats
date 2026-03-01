/**
 * Phantoms Music — Explore Page
 * Curated collections, featured artists, mood playlists, new releases.
 */

import { useState, useEffect } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import * as api from '../services/api';

const MOODS = [
    { id: 'happy', label: 'Happy', emoji: '😊', query: 'happy upbeat songs 2024', color: '#f59e0b' },
    { id: 'sad', label: 'Sad', emoji: '💔', query: 'sad emotional songs', color: '#6366f1' },
    { id: 'chill', label: 'Chill', emoji: '😌', query: 'chill relaxing music', color: '#0891b2' },
    { id: 'party', label: 'Party', emoji: '🎉', query: 'party hits 2024', color: '#ec4899' },
    { id: 'focus', label: 'Focus', emoji: '🎯', query: 'focus study music lofi', color: '#10b981' },
    { id: 'workout', label: 'Workout', emoji: '💪', query: 'workout gym motivation', color: '#ef4444' },
    { id: 'romance', label: 'Romance', emoji: '❤️', query: 'romantic love songs', color: '#e11d48' },
    { id: 'sleep', label: 'Sleep', emoji: '🌙', query: 'sleep calm peaceful music', color: '#7c3aed' },
];

const COLLECTIONS = [
    { id: 'trending', label: '🔥 Trending Now', query: 'trending music 2024' },
    { id: 'bollywood', label: '🎬 Bollywood Hits', query: 'bollywood hits 2024' },
    { id: 'anime', label: '⚔️ Anime OSTs', query: 'anime opening soundtrack' },
    { id: 'lofi', label: '🌙 Lo-Fi Beats', query: 'lofi hip hop chill beats' },
    { id: 'gaming', label: '🎮 Gaming Music', query: 'epic gaming music' },
    { id: 'kpop', label: '🌸 K-Pop', query: 'kpop hits 2024' },
];

function MiniTrackCard({ track, onClick }) {
    return (
        <div className="mini-track-card" onClick={() => onClick(track)}>
            <img
                src={track.thumbnail || `https://img.youtube.com/vi/${track.video_id}/hqdefault.jpg`}
                alt={track.title}
                onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23333" width="1" height="1"/></svg>'; }}
            />
            <div className="mini-track-card__play">▶</div>
            <div className="mini-track-card__info">
                <div className="mini-track-card__title">{track.title}</div>
                <div className="mini-track-card__artist">{track.artist}</div>
            </div>
        </div>
    );
}

function CollectionRow({ collection, onPlayAll }) {
    const [tracks, setTracks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        api.searchSongs(collection.query, 8).then(data => {
            if (!cancelled) {
                setTracks(Array.isArray(data) ? data : (data?.results || []));
                setLoading(false);
            }
        }).catch(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [collection.query]);


    return (
        <div className="collection-row">
            <div className="collection-row__header">
                <h2 className="collection-row__title">{collection.label}</h2>
                {tracks.length > 0 && (
                    <button className="btn btn--ghost btn--sm" onClick={() => onPlayAll(tracks)}>
                        Play all →
                    </button>
                )}
            </div>
            <div className="collection-row__tracks">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="mini-track-card skeleton-card">
                            <div className="skeleton" style={{ width: '100%', aspectRatio: '16/9', borderRadius: 8 }} />
                        </div>
                    ))
                ) : (
                    tracks.map((track, i) => (
                        <MiniTrackCard
                            key={track.video_id + i}
                            track={track}
                            onClick={() => onPlayAll(tracks, i)}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

export default function ExplorePage({ onSearch }) {
    const { playAll } = usePlayer();
    const [activeMood, setActiveMood] = useState(null);
    const [moodTracks, setMoodTracks] = useState([]);
    const [moodLoading, setMoodLoading] = useState(false);

    const handleMoodClick = async (mood) => {
        if (activeMood?.id === mood.id) {
            setActiveMood(null);
            setMoodTracks([]);
            return;
        }
        setActiveMood(mood);
        setMoodLoading(true);
        try {
            const data = await api.searchSongs(mood.query, 12);
            setMoodTracks(Array.isArray(data) ? data : (data?.results || []));
        } catch (_) { }
        setMoodLoading(false);
    };


    return (
        <div className="explore-page">
            {/* Hero */}
            <div className="explore-hero">
                <div className="explore-hero__content">
                    <h1 className="explore-hero__title">Discover Music</h1>
                    <p className="explore-hero__subtitle">Find new music across all genres and moods</p>
                    <button
                        className="btn btn--primary btn--lg"
                        onClick={() => onSearch('trending music 2024')}
                    >
                        🔥 Explore Trending
                    </button>
                </div>
            </div>

            {/* Mood Selector */}
            <div className="section-header">
                <h2 className="section-title">🎭 What's Your Mood?</h2>
            </div>
            <div className="mood-grid">
                {MOODS.map(mood => (
                    <button
                        key={mood.id}
                        className={`mood-btn ${activeMood?.id === mood.id ? 'active' : ''}`}
                        style={{ '--mood-color': mood.color }}
                        onClick={() => handleMoodClick(mood)}
                    >
                        <span className="mood-btn__emoji">{mood.emoji}</span>
                        <span className="mood-btn__label">{mood.label}</span>
                    </button>
                ))}
            </div>

            {/* Mood Results */}
            {activeMood && (
                <div className="mood-results">
                    <div className="section-header">
                        <h2 className="section-title">{activeMood.emoji} {activeMood.label} Music</h2>
                        {moodTracks.length > 0 && (
                            <button className="btn btn--primary btn--sm" onClick={() => playAll(moodTracks)}>
                                ▶ Play All
                            </button>
                        )}
                    </div>
                    {moodLoading ? (
                        <div className="empty-state"><div className="loading-spinner" /></div>
                    ) : (
                        <div className="tracks-grid">
                            {moodTracks.map((track, i) => (
                                <div
                                    key={track.video_id + i}
                                    className="track-card"
                                    onClick={() => playAll(moodTracks, i)}
                                >
                                    <div className="track-card__thumbnail">
                                        <img
                                            src={track.thumbnail || `https://img.youtube.com/vi/${track.video_id}/hqdefault.jpg`}
                                            alt={track.title}
                                            loading="lazy"
                                            onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23333" width="1" height="1"/></svg>'; }}
                                        />
                                        <div className="track-card__play-overlay">
                                            <button className="track-card__play-btn">▶</button>
                                        </div>
                                    </div>
                                    <div className="track-card__info">
                                        <div className="track-card__title">{track.title}</div>
                                        <div className="track-card__artist">{track.artist}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Curated Collections */}
            <div style={{ marginTop: 32 }}>
                {COLLECTIONS.map(col => (
                    <CollectionRow
                        key={col.id}
                        collection={col}
                        onPlayAll={(tracks, idx = 0) => playAll(tracks, idx)}
                    />
                ))}
            </div>
        </div>
    );
}
