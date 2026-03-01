/**
 * Phantoms Music — LyricsPanel Component
 * Fetches and displays song lyrics.
 */

import { useState, useEffect } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { getLyrics } from '../services/api';

export default function LyricsPanel() {
    const { currentTrack } = usePlayer();
    const [lyrics, setLyrics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!currentTrack) {
            setLyrics(null);
            return;
        }

        let cancelled = false;

        async function fetchLyrics() {
            setLoading(true);
            setError(null);
            try {
                const data = await getLyrics(currentTrack.title, currentTrack.artist);
                if (cancelled) return;
                if (data.lyrics) {
                    setLyrics(data.lyrics);
                } else {
                    setError(data.error || 'Lyrics not found');
                    setLyrics(null);
                }
            } catch (err) {
                if (!cancelled) {
                    setError('Failed to load lyrics');
                    setLyrics(null);
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        fetchLyrics();
        return () => { cancelled = true; };
    }, [currentTrack?.video_id]);

    if (!currentTrack) {
        return (
            <div className="lyrics-panel">
                <div className="empty-state">
                    <div className="empty-state__icon">📝</div>
                    <div className="empty-state__text">Play a song to see lyrics</div>
                </div>
            </div>
        );
    }

    return (
        <div className="lyrics-panel">
            <div className="section-header">
                <div>
                    <h2 className="section-title">Lyrics</h2>
                    <p className="section-subtitle">{currentTrack.title} — {currentTrack.artist}</p>
                </div>
            </div>

            {loading && (
                <div className="empty-state">
                    <div className="loading-spinner" />
                    <div className="empty-state__text" style={{ marginTop: 16 }}>Loading lyrics...</div>
                </div>
            )}

            {error && !loading && (
                <div className="empty-state">
                    <div className="empty-state__icon">😔</div>
                    <div className="empty-state__text">{error}</div>
                    <div className="empty-state__subtext">Lyrics may not be available for all tracks</div>
                </div>
            )}

            {lyrics && !loading && (
                <div className="lyrics-panel__text">{lyrics}</div>
            )}
        </div>
    );
}
