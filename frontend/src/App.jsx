/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║                      🎵 PHANTOMS MUSIC — App                           ║
 * ║  Root component: wires up sidebar, header, content views, and player.  ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 */

import { useState, useEffect, useCallback } from 'react';
import './App.css';

// Contexts
import { useTheme } from './contexts/ThemeContext';
import { useAuth } from './contexts/AuthContext';
import { usePlayer } from './contexts/PlayerContext';

// Components
import SearchBar from './components/SearchBar';
import Player from './components/Player';
import Sidebar from './components/Sidebar';
import TrackCard from './components/TrackCard';
import PlaylistManager from './components/PlaylistManager';
import AuthModal from './components/AuthModal';
import LyricsPanel from './components/LyricsPanel';
import Equalizer from './components/Equalizer';
import ExplorePage from './components/ExplorePage';
import ProfilePage from './components/ProfilePage';
import DownloadsPage from './components/DownloadsPage';
import Recommendations from './components/Recommendations';
import MobileBottomNav from './components/MobileBottomNav';
import NowPlayingScreen from './components/NowPlayingScreen';
import QueuePanel from './components/QueuePanel';
// API
import * as api from './services/api';

// ─── Toast System ────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast--${t.type}`} onClick={() => onRemove(t.id)}>
                    <span>{t.type === 'error' ? '❌' : t.type === 'success' ? '✅' : 'ℹ️'}</span>
                    {t.message}
                </div>
            ))}
        </div>
    );
}

// ─── Add to Playlist Modal ──────────────────────────────────────────────────
function AddToPlaylistModal({ track, playlists, onClose, onAdd }) {
    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal__title">Add to Playlist</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 16 }}>
                    {track.title}
                </p>
                {playlists.length > 0 ? (
                    <div className="track-list" style={{ maxHeight: 300, overflow: 'auto' }}>
                        {playlists.map(pl => (
                            <div
                                key={pl.id}
                                className="track-list-item"
                                style={{ cursor: 'pointer' }}
                                onClick={() => onAdd(pl.id, track)}
                            >
                                <span className="track-list-item__index">🎶</span>
                                <div className="track-list-item__info">
                                    <div className="track-list-item__title">{pl.name}</div>
                                    <div className="track-list-item__artist">{pl.track_count || 0} tracks</div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        No playlists yet. Create one first!
                    </p>
                )}
                <div className="modal__actions">
                    <button className="btn btn--ghost" onClick={onClose}>Cancel</button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main App
// ═══════════════════════════════════════════════════════════════════════════════

export default function App() {
    const { theme, toggleTheme } = useTheme();
    const { user, logoutUser } = useAuth();
    const { error: playerError, clearError, currentTrack, queue, queueIndex, playTrack } = usePlayer();


    // ─── State ───────────────────────────────────────────────────────────────
    const [currentView, setCurrentViewState] = useState(() => {
        // Restore view from URL hash on page load
        const hash = window.location.hash.replace('#', '');
        const validViews = ['home', 'search', 'trending', 'explore', 'profile', 'downloads', 'genres', 'genre', 'playlist'];
        return validViews.includes(hash) ? hash : 'home';
    });

    // Browser History API — makes back/forward buttons work
    const setCurrentView = useCallback((view) => {
        setCurrentViewState(view);
        window.history.pushState({ view }, '', `#${view}`);
    }, []);

    useEffect(() => {
        const onPopState = (e) => {
            const view = e.state?.view || window.location.hash.replace('#', '') || 'home';
            setCurrentViewState(view);
        };
        window.addEventListener('popstate', onPopState);
        // Set initial state
        window.history.replaceState({ view: window.location.hash.replace('#', '') || 'home' }, '', window.location.href);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showAuth, setShowAuth] = useState(false);
    const [showLyrics, setShowLyrics] = useState(false);
    const [showEq, setShowEq] = useState(false);
    const [showQueue, setShowQueue] = useState(false);
    const [showNowPlaying, setShowNowPlaying] = useState(false);

    const [searchResults, setSearchResults] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);

    const [trendingTracks, setTrendingTracks] = useState([]);
    const [genreTracks, setGenreTracks] = useState([]);
    const [currentGenre, setCurrentGenre] = useState(null);
    const [genres, setGenres] = useState([]);

    const [playlists, setPlaylists] = useState([]);
    const [activePlaylist, setActivePlaylist] = useState(null);
    const [addToPlaylistTrack, setAddToPlaylistTrack] = useState(null);

    const [toasts, setToasts] = useState([]);
    const [homeLoading, setHomeLoading] = useState(true);

    // PWA Install State
    const [deferredPrompt, setDeferredPrompt] = useState(null);

    // ─── PWA Install Listener ────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstallClick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            addToast('App installed successfully!', 'success');
        }
        setDeferredPrompt(null);
    };

    // ─── Toast helper ────────────────────────────────────────────────────────
    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    }, []);

    // ─── Dynamic background gradient from album art ──────────────────────────
    useEffect(() => {
        if (!currentTrack?.thumbnail) {
            document.documentElement.style.removeProperty('--now-playing-color');
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = currentTrack.thumbnail + '?v=' + Date.now();
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 4; canvas.height = 4;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, 4, 4);
                const d = ctx.getImageData(0, 0, 4, 4).data;
                let r = 0, g = 0, b = 0;
                for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
                const px = d.length / 4;
                r = Math.round(r / px); g = Math.round(g / px); b = Math.round(b / px);
                document.documentElement.style.setProperty('--now-playing-color', `${r}, ${g}, ${b}`);
            } catch (_) { }
        };
    }, [currentTrack]);

    // Show player errors as toasts
    useEffect(() => {
        if (playerError) {
            addToast(playerError, 'error');
            clearError();
        }
    }, [playerError, addToast, clearError]);

    // ─── Load homepage data ──────────────────────────────────────────────────
    useEffect(() => {
        async function loadHome() {
            try {
                const [trending, genreData] = await Promise.all([
                    api.getTrending('music', 20),
                    api.getGenres()
                ]);
                setTrendingTracks(trending.results || []);
                setGenres(genreData.genres || []);
            } catch (e) {
                console.error('Failed to load homepage:', e);
                addToast('Failed to load trending music', 'error');
            } finally {
                setHomeLoading(false);
            }
        }
        loadHome();
    }, []);

    // ─── Load playlists when user logs in ────────────────────────────────────
    useEffect(() => {
        if (user) {
            loadPlaylists();
        } else {
            setPlaylists([]);
        }
    }, [user]);

    const loadPlaylists = async () => {
        try {
            const data = await api.getPlaylists();
            setPlaylists(data.playlists || []);
        } catch (e) {
            console.error('Failed to load playlists:', e);
        }
    };

    // ─── Search ──────────────────────────────────────────────────────────────
    const handleSearch = async (query) => {
        setSearchQuery(query);
        setCurrentView('search');
        setSearchLoading(true);
        try {
            const data = await api.searchSongs(query);
            setSearchResults(data.results || []);
        } catch (e) {
            addToast('Search failed: ' + e.message, 'error');
            setSearchResults([]);
        } finally {
            setSearchLoading(false);
        }
    };

    // ─── Genre selection ──────────────────────────────────────────────────────
    const handleGenreClick = async (genre) => {
        setCurrentGenre(genre);
        handleNavigate('genre');
        setSearchLoading(true);
        try {
            const data = await api.getTrending(genre.id, 20);
            setGenreTracks(data.results || []);
        } catch (e) {
            addToast('Failed to load genre tracks', 'error');
        } finally {
            setSearchLoading(false);
        }
    };

    // ─── Playlist actions ────────────────────────────────────────────────────
    const handleCreatePlaylist = async () => {
        if (!user) { setShowAuth(true); return; }
        const name = prompt('Playlist name:');
        const trimmedName = name?.trim();
        if (!trimmedName) return;

        // ⚡ Optimistic UI Update: add fake playlist temporarily
        const tempId = 'temp_' + Date.now();
        setPlaylists(prev => [{ id: tempId, name: trimmedName, track_count: 0 }, ...prev]);
        addToast('Playlist created!', 'success');

        try {
            await api.createPlaylist(trimmedName);
            // Replace fake with real from server
            loadPlaylists();
        } catch (e) {
            // Revert on failure
            setPlaylists(prev => prev.filter(p => p.id !== tempId));
            addToast('Failed to create playlist: ' + e.message, 'error');
        }
    };

    const handlePlaylistClick = async (pl) => {
        handleNavigate('playlist');
        setSearchLoading(true); // Instant page switch + show loading skeleton
        try {
            const data = await api.getPlaylist(pl.id);
            setActivePlaylist(data.playlist);
        } catch (e) {
            addToast('Failed to load playlist', 'error');
            setCurrentView('home');
        } finally {
            setSearchLoading(false);
        }
    };

    const handleAddToPlaylist = async (playlistId, track) => {
        // ⚡ Optimistic output
        setAddToPlaylistTrack(null);
        addToast('Added to playlist!', 'success');

        setPlaylists(prev => prev.map(p =>
            p.id === playlistId ? { ...p, track_count: (p.track_count || 0) + 1 } : p
        ));

        try {
            await api.addTrackToPlaylist(playlistId, {
                video_id: track.video_id,
                title: track.title,
                artist: track.artist,
                thumbnail: track.thumbnail,
                duration: track.duration,
            });
            // Update silently in background to confirm server state
            loadPlaylists();
        } catch (e) {
            // Revert on fail
            addToast('Failed to add: ' + e.message, 'error');
            loadPlaylists();
        }
    };

    const handleAddToPlaylistClick = (track) => {
        if (!user) { setShowAuth(true); return; }
        setAddToPlaylistTrack(track);
    };

    // Import playlist from JSON file
    const handleImportPlaylist = async () => {
        if (!user) { setShowAuth(true); return; }
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                await api.importPlaylist(data);
                await loadPlaylists();
                addToast('Playlist imported!', 'success');
            } catch (err) {
                addToast('Import failed: invalid JSON file', 'error');
            }
        };
        input.click();
    };

    // ─── Keyboard shortcuts ──────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            // Don't intercept when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.code === 'Space') {
                e.preventDefault();
                document.querySelector('.player__play-btn')?.click();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, []);

    // ─── Navigation handler ──────────────────────────────────────────────────
    const handleNavigate = useCallback((view) => {
        setShowLyrics(false);
        setShowEq(false);
        setShowQueue(false);
        setCurrentView(view);

        // Focus search input when navigating to search
        if (view === 'search') {
            setTimeout(() => {
                document.querySelector('.search-bar__input')?.focus();
            }, 100);
        }

        // Load fresh trending data when navigating to trending
        if (view === 'trending' && trendingTracks.length === 0) {
            (async () => {
                try {
                    const data = await api.getTrending('music', 20);
                    setTrendingTracks(data.results || []);
                } catch (e) {
                    addToast('Failed to load trending', 'error');
                }
            })();
        }
    }, [trendingTracks, addToast]);

    // ─── Render Content ──────────────────────────────────────────────────────
    const renderContent = () => {
        // Show lyrics, EQ panel, or Queue if active
        if (showLyrics) return <LyricsPanel />;
        if (showEq) return <Equalizer />;
        if (showQueue) return <QueuePanel />;

        switch (currentView) {
            case 'search':
                return (
                    <div>
                        <div className="section-header">
                            <div>
                                <h1 className="section-title">Search Results</h1>
                                <p className="section-subtitle">
                                    {searchResults.length} results for "{searchQuery}"
                                </p>
                            </div>
                        </div>
                        {searchLoading ? (
                            <div className="empty-state"><div className="loading-spinner" /></div>
                        ) : searchResults.length > 0 ? (
                            <div className="tracks-grid">
                                {searchResults.map((track, i) => (
                                    <TrackCard
                                        key={track.video_id + i}
                                        track={track}
                                        tracks={searchResults}
                                        index={i}
                                        onAddToPlaylist={handleAddToPlaylistClick}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state__icon">🔍</div>
                                <div className="empty-state__text">No results found</div>
                                <div className="empty-state__subtext">Try different keywords</div>
                            </div>
                        )}
                    </div>
                );

            case 'trending':
                return (
                    <div>
                        <div className="section-header">
                            <h1 className="section-title">🔥 Trending Now</h1>
                        </div>
                        {trendingTracks.length > 0 ? (
                            <div className="tracks-grid">
                                {trendingTracks.map((track, i) => (
                                    <TrackCard
                                        key={track.video_id + i}
                                        track={track}
                                        tracks={trendingTracks}
                                        index={i}
                                        onAddToPlaylist={handleAddToPlaylistClick}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state"><div className="loading-spinner" /></div>
                        )}
                    </div>
                );

            case 'genres':
                return (
                    <div>
                        <div className="section-header">
                            <h1 className="section-title">🎵 Browse by Genre</h1>
                        </div>
                        <div className="genres-grid">
                            {genres.map(genre => (
                                <div
                                    key={genre.id}
                                    className="genre-card"
                                    style={{ '--genre-color': genre.color }}
                                    onClick={() => handleGenreClick(genre)}
                                >
                                    <div className="genre-card__icon">{genre.icon}</div>
                                    <div className="genre-card__name">{genre.name}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                );

            case 'genre':
                return (
                    <div>
                        <div className="section-header">
                            <div>
                                <button className="btn btn--ghost" onClick={() => setCurrentView('genres')} style={{ marginBottom: 8 }}>
                                    ← Back to Genres
                                </button>
                                <h1 className="section-title">
                                    {currentGenre?.icon} {currentGenre?.name}
                                </h1>
                            </div>
                        </div>
                        {searchLoading ? (
                            <div className="empty-state"><div className="loading-spinner" /></div>
                        ) : (
                            <div className="tracks-grid">
                                {genreTracks.map((track, i) => (
                                    <TrackCard
                                        key={track.video_id + i}
                                        track={track}
                                        tracks={genreTracks}
                                        index={i}
                                        onAddToPlaylist={handleAddToPlaylistClick}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );

            case 'explore':
                return (
                    <ExplorePage
                        onSearch={(q) => {
                            handleSearch(q);
                        }}
                    />
                );

            case 'downloads':
                return <DownloadsPage />;

            case 'profile':
                return (
                    <ProfilePage
                        playlists={playlists}
                        onNavigate={handleNavigate}
                    />
                );

            case 'playlist':
                if (searchLoading) {
                    return <div className="empty-state"><div className="loading-spinner" /></div>;
                }
                if (activePlaylist) {
                    return (
                        <PlaylistManager
                            playlist={activePlaylist}
                            onUpdate={loadPlaylists}
                            onBack={() => setCurrentView('home')}
                        />
                    );
                }
                return null;

            case 'home':
            default:
                return (
                    <div>
                        {/* ── HERO: Recommended / Suggested Songs (top) ── */}
                        <Recommendations onAddToPlaylist={handleAddToPlaylistClick} />

                        {/* ── Browse Genres ── */}
                        <div className="section-header" style={{ marginTop: 36 }}>
                            <h1 className="section-title">Browse Genres</h1>
                            <button className="btn btn--ghost" onClick={() => setCurrentView('genres')}>See all →</button>
                        </div>
                        <div className="genres-row">
                            {genres.map(genre => (
                                <div
                                    key={genre.id}
                                    className="genre-card"
                                    style={{ '--genre-color': genre.color }}
                                    onClick={() => handleGenreClick(genre)}
                                >
                                    <div className="genre-card__icon">{genre.icon}</div>
                                    <div className="genre-card__name">{genre.name}</div>
                                </div>
                            ))}
                        </div>

                        {/* ── Trending ── */}
                        <div className="section-header" style={{ marginTop: 32 }}>
                            <h1 className="section-title">🔥 Trending</h1>
                            <button className="btn btn--ghost" onClick={() => setCurrentView('trending')}>See all →</button>
                        </div>
                        {homeLoading ? (
                            <div className="tracks-grid">
                                {Array.from({ length: 8 }).map((_, i) => (
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
                                {trendingTracks.slice(0, 12).map((track, i) => (
                                    <TrackCard
                                        key={track.video_id + i}
                                        track={track}
                                        tracks={trendingTracks}
                                        index={i}
                                        onAddToPlaylist={handleAddToPlaylistClick}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
        }   // end switch
    };  // end renderContent

    return (
        <div className="app">
            {/* Sidebar */}
            <Sidebar
                currentView={currentView}
                onNavigate={handleNavigate}
                playlists={playlists}
                onCreatePlaylist={handleCreatePlaylist}
                onPlaylistClick={handlePlaylistClick}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                canInstall={!!deferredPrompt}
                onInstallClick={handleInstallClick}
            />

            {/* Main Area */}
            <div className="app__main">
                {/* Header */}
                <header className="app__header">
                    <button
                        className="btn--icon menu-toggle"
                        onClick={() => setSidebarOpen(prev => !prev)}
                        aria-label="Toggle menu"
                    >
                        ☰
                    </button>

                    <SearchBar onSearch={handleSearch} />

                    <div className="header__actions">
                        {user && (
                            <button className="btn btn--ghost" onClick={handleImportPlaylist} title="Import playlist">
                                📥
                            </button>
                        )}
                        <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme" aria-label="Toggle theme">
                            {theme === 'dark' ? '☀️' : '🌙'}
                        </button>
                        {user ? (
                            <button
                                className="btn btn--ghost header__user-btn"
                                onClick={() => handleNavigate('profile')}
                                title="Go to Profile"
                            >
                                <span className="header__user-avatar">{(user.username[0] || '?').toUpperCase()}</span>
                                {user.username}
                            </button>
                        ) : (
                            <button className="btn btn--primary" onClick={() => setShowAuth(true)}>
                                Sign In
                            </button>
                        )}
                    </div>
                </header>

                {/* Content */}
                <main className="app__content">
                    {renderContent()}
                </main>
            </div>

            {/* Mobile Bottom Navigation (shown ≤768px) */}
            <MobileBottomNav
                currentView={currentView}
                onNavigate={handleNavigate}
                sidebarOpen={sidebarOpen}
                onLibraryClick={() => setSidebarOpen(prev => !prev)}
                canInstall={!!deferredPrompt}
                onInstallClick={handleInstallClick}
            />

            {/* Player Bar */}
            <Player
                onLyricsToggle={() => { setShowLyrics(prev => !prev); setShowEq(false); setShowQueue(false); }}
                onEqToggle={() => { setShowEq(prev => !prev); setShowLyrics(false); setShowQueue(false); }}
                onQueueToggle={() => { setShowQueue(prev => !prev); setShowLyrics(false); setShowEq(false); }}
                showLyrics={showLyrics}
                showEq={showEq}
                showQueue={showQueue}
                onExpand={() => setShowNowPlaying(true)}
            />

            {/* Full-Screen Now Playing */}
            {showNowPlaying && currentTrack && (
                <NowPlayingScreen
                    onClose={() => setShowNowPlaying(false)}
                    onLyricsToggle={() => { setShowLyrics(p => !p); setShowEq(false); setShowNowPlaying(false); }}
                    onEqToggle={() => { setShowEq(p => !p); setShowLyrics(false); setShowNowPlaying(false); }}
                    showLyrics={showLyrics}
                    showEq={showEq}
                />
            )}

            {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
            {addToPlaylistTrack && (
                <AddToPlaylistModal
                    track={addToPlaylistTrack}
                    playlists={playlists}
                    onClose={() => setAddToPlaylistTrack(null)}
                    onAdd={handleAddToPlaylist}
                />
            )}

            {/* Toasts */}
            <ToastContainer toasts={toasts} onRemove={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
        </div>
    );
}
