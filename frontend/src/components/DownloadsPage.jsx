/**
 * Phantoms Music — Downloads Page
 * Manages locally cached songs (IndexedDB) for offline playback.
 * Users can download tracks, see them here, and play them without internet.
 */

import { useState, useEffect, useCallback } from 'react';
import { usePlayer } from '../contexts/PlayerContext';
import { formatTime } from '../utils/helpers';

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
const DB_NAME = 'phantoms_downloads';
const STORE_NAME = 'tracks';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'video_id' });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveDownload(track, audioBlob) {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
            ...track,
            blob: audioBlob,
            blob_url: URL.createObjectURL(audioBlob),
            downloaded_at: new Date().toISOString(),
            size_bytes: audioBlob.size,
        });
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error('[Downloads] Failed to save:', e);
        throw e;
    }
}

async function getAllDownloads() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

async function deleteDownload(videoId) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(videoId);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

function formatSize(bytes) {
    if (!bytes) return '';
    if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
}

// ─── DownloadsPage Component ──────────────────────────────────────────────────
export default function DownloadsPage() {
    const { playAll } = usePlayer();
    const [downloads, setDownloads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const onOnline = () => setIsOnline(true);
        const onOffline = () => setIsOnline(false);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    const loadDownloads = useCallback(async () => {
        setLoading(true);
        try {
            const all = await getAllDownloads();
            setDownloads(all.sort((a, b) =>
                new Date(b.downloaded_at) - new Date(a.downloaded_at)
            ));
        } catch (e) {
            console.error('[Downloads] Load error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadDownloads(); }, [loadDownloads]);

    const handlePlay = (index) => {
        // Create playable tracks using the blob URL for offline playback
        const playableTracks = downloads.map(d => ({
            ...d,
            // Use blob URL if available (offline), fallback to proxy
            _offline_url: d.blob_url,
        }));
        playAll(playableTracks, index);
    };

    const handleDelete = async (videoId, e) => {
        e.stopPropagation();
        await deleteDownload(videoId);
        setDownloads(prev => prev.filter(d => d.video_id !== videoId));
    };

    const totalSize = downloads.reduce((sum, d) => sum + (d.size_bytes || 0), 0);

    return (
        <div className="downloads-page">
            {/* ─── Header ─────────────────────────────────────────────── */}
            <div className="downloads-header">
                <div>
                    <h1 className="downloads-title">
                        ⬇ Downloads
                    </h1>
                    <p className="downloads-subtitle">
                        {downloads.length} songs · {formatSize(totalSize)} stored locally
                    </p>
                </div>
                <div className={`online-badge ${isOnline ? 'online' : 'offline'}`}>
                    <span className="online-badge__dot" />
                    {isOnline ? 'Online' : 'Offline Mode'}
                </div>
            </div>

            {/* ─── Offline notice ──────────────────────────────────────── */}
            {!isOnline && (
                <div className="offline-notice">
                    🔌 You're offline — playing cached downloads only
                </div>
            )}

            {/* ─── Content ─────────────────────────────────────────────── */}
            {loading ? (
                <div className="empty-state"><div className="loading-spinner" /></div>
            ) : downloads.length === 0 ? (
                <div className="empty-state" style={{ minHeight: 300 }}>
                    <div className="empty-state__icon">⬇</div>
                    <div className="empty-state__text">No downloads yet</div>
                    <div className="empty-state__subtext">
                        Click the ⬇ button on any song to save it for offline playback
                    </div>
                </div>
            ) : (
                <>
                    {downloads.length > 1 && (
                        <div style={{ marginBottom: 16 }}>
                            <button
                                className="btn btn--primary"
                                onClick={() => handlePlay(0)}
                            >
                                ▶ Play All Downloads
                            </button>
                        </div>
                    )}
                    <div className="downloads-list">
                        {downloads.map((track, i) => (
                            <div
                                key={track.video_id}
                                className="download-item"
                                onClick={() => handlePlay(i)}
                            >
                                <div className="download-item__thumb">
                                    <img
                                        src={track.thumbnail || `https://img.youtube.com/vi/${track.video_id}/hqdefault.jpg`}
                                        alt={track.title}
                                        onError={(e) => { e.target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect fill="%23333" width="1" height="1"/></svg>'; }}
                                    />
                                    <div className="download-item__play-overlay">▶</div>
                                </div>
                                <div className="download-item__info">
                                    <div className="download-item__title">{track.title}</div>
                                    <div className="download-item__artist">{track.artist}</div>
                                    <div className="download-item__meta">
                                        <span>{formatTime(track.duration)}</span>
                                        {track.size_bytes && (
                                            <span className="download-item__size">
                                                {formatSize(track.size_bytes)}
                                            </span>
                                        )}
                                        <span className="download-item__date">
                                            {new Date(track.downloaded_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                                <div className="download-item__actions">
                                    <button
                                        className="btn--icon"
                                        onClick={(e) => handleDelete(track.video_id, e)}
                                        title="Remove download"
                                    >
                                        🗑
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
