/**
 * Phantoms Music — PlaylistManager Component
 * View/edit a playlist: tracks list with drag-and-drop reorder, remove, import/export.
 */

import { useState, useRef, useCallback } from 'react';
import { TrackListItem } from './TrackCard';
import * as api from '../services/api';

export default function PlaylistManager({ playlist, onUpdate, onBack }) {
    const [tracks, setTracks] = useState(playlist?.tracks || []);
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(playlist?.name || '');
    const [spotifyUrl, setSpotifyUrl] = useState('');
    const [importing, setImporting] = useState(false);
    const dragItem = useRef(null);
    const dragOverItem = useRef(null);

    // ─── Drag & Drop ─────────────────────────────────────────────────────────
    const handleDragStart = (index) => {
        dragItem.current = index;
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        dragOverItem.current = index;
    };

    const handleDrop = async () => {
        if (dragItem.current === null || dragOverItem.current === null) return;
        const updated = [...tracks];
        const [removed] = updated.splice(dragItem.current, 1);
        updated.splice(dragOverItem.current, 0, removed);
        setTracks(updated);
        dragItem.current = null;
        dragOverItem.current = null;

        // Persist reorder
        try {
            await api.reorderPlaylistTracks(playlist.id, updated.map(t => t.id));
            onUpdate?.();
        } catch (e) {
            console.error('Reorder failed:', e);
        }
    };

    // ─── Remove Track ────────────────────────────────────────────────────────
    const handleRemove = async (track) => {
        try {
            await api.removeTrackFromPlaylist(playlist.id, track.id);
            setTracks(prev => prev.filter(t => t.id !== track.id));
            onUpdate?.();
        } catch (e) {
            console.error('Remove failed:', e);
        }
    };

    // ─── Rename ──────────────────────────────────────────────────────────────
    const handleRename = async () => {
        if (!name.trim()) return;
        try {
            await api.updatePlaylist(playlist.id, { name: name.trim() });
            setEditing(false);
            onUpdate?.();
        } catch (e) {
            console.error('Rename failed:', e);
        }
    };

    // ─── Export ──────────────────────────────────────────────────────────────
    const handleExport = async () => {
        try {
            const data = await api.exportPlaylist(playlist.id);
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${playlist.name.replace(/\s+/g, '_')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('Export failed:', e);
        }
    };

    // ─── Import Spotify ──────────────────────────────────────────────────────
    const handleImportSpotify = async (e) => {
        e.preventDefault();
        if (!spotifyUrl) return;
        setImporting(true);
        try {
            const result = await api.importSpotifyTracks(name, spotifyUrl);
            if (result.playlist?.tracks) {
                setTracks(result.playlist.tracks);
                onUpdate?.();
            }
        } catch (error) {
            console.error('Spotify import failed:', error);
            alert('Failed to import Spotify playlist. Ensure it is a public playlist URL.');
        } finally {
            setImporting(false);
            setSpotifyUrl('');
        }
    };

    return (
        <div className="playlist-panel">
            {/* Header */}
            <div className="playlist-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button className="btn--icon" onClick={onBack} title="Back">←</button>
                    {editing ? (
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                className="modal__input"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                                style={{ marginBottom: 0, width: 200 }}
                                autoFocus
                            />
                            <button className="btn btn--primary" onClick={handleRename}>Save</button>
                        </div>
                    ) : (
                        <h2 className="section-title" onClick={() => setEditing(true)} style={{ cursor: 'pointer' }}>
                            {playlist.name}
                        </h2>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn--ghost" onClick={handleExport} title="Export as JSON">📤 Export</button>
                    <button
                        className="btn btn--ghost"
                        onClick={() => api.deletePlaylist(playlist.id).then(() => { onUpdate?.(); onBack(); })}
                        title="Delete playlist"
                        style={{ color: 'var(--accent-red)' }}
                    >
                        🗑️ Delete
                    </button>
                </div>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 20 }}>
                {tracks.length} tracks • Drag to reorder
            </p>

            {/* Track List */}
            {tracks.length > 0 ? (
                <div className="track-list">
                    {tracks.map((track, i) => (
                        <TrackListItem
                            key={track.id || i}
                            track={track}
                            index={i}
                            tracks={tracks}
                            onRemove={handleRemove}
                            draggable
                            onDragStart={() => handleDragStart(i)}
                            onDragOver={(e) => handleDragOver(e, i)}
                            onDrop={handleDrop}
                        />
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    <div className="empty-state__icon">📋</div>
                    <div className="empty-state__text">This playlist is empty</div>
                    <div className="empty-state__subtext" style={{ marginBottom: 24 }}>Search for songs or import from Spotify</div>

                    <form onSubmit={handleImportSpotify} style={{ display: 'flex', gap: 8, maxWidth: 400, width: '100%' }}>
                        <input
                            type="url"
                            className="modal__input"
                            style={{ margin: 0, flex: 1 }}
                            placeholder="Paste Spotify Playlist URL..."
                            value={spotifyUrl}
                            onChange={(e) => setSpotifyUrl(e.target.value)}
                            disabled={importing}
                        />
                        <button type="submit" className="btn btn--primary" disabled={importing || !spotifyUrl}>
                            {importing ? 'Importing...' : 'Import'}
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
