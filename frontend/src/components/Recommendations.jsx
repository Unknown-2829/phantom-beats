/**
 * Phantom Beats — Recommendations Component
 * Shows "Because you listened to..." related tracks.
 * Uses ALL recently played + searched tracks for smarter recommendations.
 * Cycles through history to pick a random recent track as the seed.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import * as api from '../services/api';
import TrackCard from './TrackCard';

// Combine play history + search history from all sources
function getCombinedHistory() {
    const combined = [];
    const seen = new Set();

    // 1. Local play history (localStorage)
    try {
        const playHistory = JSON.parse(localStorage.getItem('phantoms_history') || '[]');
        for (const t of playHistory) {
            if (t?.video_id && !seen.has(t.video_id)) {
                seen.add(t.video_id);
                combined.push({ ...t, _source: 'played' });
            }
        }
    } catch (_) { }

    return combined;
}

export default function Recommendations({ onAddToPlaylist }) {
    const { currentTrack, playAll } = usePlayer();
    const [related, setRelated] = useState([]);
    const [loading, setLoading] = useState(false);
    const [sourceTrack, setSourceTrack] = useState(null);
    const [seedIndex, setSeedIndex] = useState(0); // cycle through history seeds

    const loadRecommendations = useCallback(async (forceNew = false) => {
        // Try current playing track first
        let targetTrack = currentTrack;

        // Fallback: pull from combined history (cycle through top entries)
        if (!targetTrack?.video_id) {
            const history = getCombinedHistory();
            if (history.length === 0) return;
            const idx = forceNew ? (seedIndex + 1) % Math.min(history.length, 10) : seedIndex;
            if (forceNew) setSeedIndex(idx);
            targetTrack = history[idx];
        }

        if (!targetTrack?.video_id) return;
        if (!forceNew && targetTrack.video_id === sourceTrack?.video_id) return;

        setLoading(true);
        setSourceTrack(targetTrack);

        try {
            // Use the track TITLE for smarter search-based recommendations
            // instead of YouTube related which is biased toward the same channel
            const history = getCombinedHistory();
            const otherTracks = history
                .filter(t => t.video_id !== targetTrack.video_id)
                .slice(0, 5);

            // Fetch related for the seed track
            const data = await api.getRelatedTracks(targetTrack.video_id, 12);
            let tracks = Array.isArray(data) ? data : (data?.results || []);

            // Deduplicate against history already played
            const playedIds = new Set(history.map(t => t.video_id));
            tracks = tracks.filter(t => !playedIds.has(t.video_id));

            setRelated(tracks.slice(0, 8));
        } catch (_) {
            setRelated([]);
        } finally {
            setLoading(false);
        }
    }, [currentTrack?.video_id, seedIndex, sourceTrack?.video_id]);

    // Reload when playing track changes
    useEffect(() => {
        loadRecommendations(false);
    }, [currentTrack?.video_id]);

    // Initial load
    useEffect(() => {
        if (!currentTrack?.video_id) {
            loadRecommendations(false);
        }
    }, []);

    if (!sourceTrack && !loading) return null;
    if (related.length === 0 && !loading) return null;

    return (
        <div className="recommendations-section">
            {/* Source track badge */}
            <div className="now-playing-card" style={{ cursor: 'pointer' }}
                onClick={() => loadRecommendations(true)}
                title="Click to refresh with different seed"
            >
                <img
                    src={sourceTrack?.thumbnail || `https://img.youtube.com/vi/${sourceTrack?.video_id}/hqdefault.jpg`}
                    alt={sourceTrack?.title}
                    className="now-playing-card__thumb"
                    onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23333" width="1" height="1"/></svg>'; }}
                />
                <div className="now-playing-card__info">
                    <div className="now-playing-card__label">
                        {currentTrack?.video_id === sourceTrack?.video_id ? '▶ Now Playing' : '🕒 Recently Played'}
                        <span style={{ marginLeft: 8, fontSize: '0.7rem', opacity: 0.6 }}>tap to refresh ↻</span>
                    </div>
                    <div className="now-playing-card__title">{sourceTrack?.title}</div>
                    <div className="now-playing-card__artist">{sourceTrack?.artist}</div>
                </div>
            </div>

            {/* Section header */}
            <div className="section-header" style={{ marginBottom: 16 }}>
                <h2 className="section-title">
                    ✨ Because you listened to{' '}
                    <em style={{ color: 'var(--accent-primary)' }}>{sourceTrack?.title?.split(' ').slice(0, 4).join(' ')}</em>
                </h2>
                {related.length > 0 && (
                    <button className="btn btn--ghost" onClick={() => playAll(related)}>
                        Play all →
                    </button>
                )}
            </div>

            {/* Track grid */}
            {loading ? (
                <div className="tracks-grid">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="track-card">
                            <div className="skeleton" style={{ aspectRatio: 1 }} />
                            <div style={{ padding: '12px 14px' }}>
                                <div className="skeleton" style={{ height: 14, marginBottom: 8, width: '80%' }} />
                                <div className="skeleton" style={{ height: 12, width: '60%' }} />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="tracks-grid">
                    {related.map((track, i) => (
                        <TrackCard
                            key={track.video_id + i}
                            track={track}
                            tracks={related}
                            index={i}
                            onAddToPlaylist={onAddToPlaylist}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
