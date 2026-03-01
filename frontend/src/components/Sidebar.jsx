/**
 * Phantoms Music — Sidebar Component
 * Navigation with genre categories, playlists, and user info.
 */

import { useAuth } from '../contexts/AuthContext';

export default function Sidebar({
    currentView, onNavigate, playlists, onCreatePlaylist, onPlaylistClick, isOpen, onClose, canInstall, onInstallClick
}) {
    const { user } = useAuth();

    const navItems = [
        { id: 'home', icon: '🏠', label: 'Home' },
        { id: 'explore', icon: '🧭', label: 'Explore' },
        { id: 'search', icon: '🔍', label: 'Search' },
        { id: 'trending', icon: '🔥', label: 'Trending' },
        { id: 'genres', icon: '🎵', label: 'Genres' },
        { id: 'downloads', icon: '⬇', label: 'Downloads' },
    ];

    return (
        <>
            {isOpen && <div className="sidebar-overlay visible" onClick={onClose} />}
            <aside className={`app__sidebar ${isOpen ? 'open' : ''}`}>

                {/* ─── Logo ─────────────────────────────────────────── */}
                <div className="sidebar__logo" onClick={() => { onNavigate('home'); onClose(); }}>
                    <div className="sidebar__logo-icon">
                        <img
                            src="/logo.png"
                            alt="Phantoms"
                            style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }}
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                            }}
                        />
                        <span style={{
                            display: 'none', width: 36, height: 36, borderRadius: 8,
                            background: 'linear-gradient(135deg,#8b5cf6,#ec4899)',
                            alignItems: 'center', justifyContent: 'center',
                            fontSize: '1.3rem'
                        }}>👻</span>
                    </div>
                    <span className="sidebar__logo-text">Phantom Beats</span>
                </div>


                {/* ─── Main Navigation ──────────────────────────────── */}
                <nav className="sidebar__nav">
                    <div className="sidebar__section-title">Menu</div>
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            className={`sidebar__nav-item ${currentView === item.id ? 'active' : ''}`}
                            onClick={() => { onNavigate(item.id); onClose(); }}
                        >
                            <span className="icon">{item.icon}</span>
                            {item.label}
                        </button>
                    ))}

                    {/* ─── Library Section ──────────────────────────── */}
                    <div className="sidebar__section-title" style={{ marginTop: 16 }}>Your Library</div>
                    {user ? (
                        <>
                            <button className="sidebar__nav-item" onClick={onCreatePlaylist}>
                                <span className="icon">➕</span>
                                Create Playlist
                            </button>
                            <div className="sidebar__playlists">
                                {playlists.map(pl => (
                                    <div
                                        key={pl.id}
                                        className="sidebar__playlist-item"
                                        onClick={() => { onPlaylistClick(pl); onClose(); }}
                                    >
                                        <span>🎶 {pl.name}</span>
                                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                            {pl.track_count || 0}
                                        </span>
                                    </div>
                                ))}
                                {playlists.length === 0 && (
                                    <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                        No playlists yet
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Sign in to create playlists
                        </div>
                    )}
                </nav>

                {/* ─── User info / Install / Profile at bottom ──── */}
                <div className="sidebar__footer" style={{ marginTop: 'auto' }}>
                    {/* Install App — only shown when PWA prompt is available, auto-hides after install */}
                    {canInstall && (
                        <button
                            className="sidebar__nav-item sidebar__install-btn"
                            onClick={onInstallClick}
                            style={{ color: 'var(--accent-primary)', marginBottom: 8, fontWeight: 600 }}
                            title="Install Phantom Beats as an app"
                        >
                            <span className="icon">📲</span>
                            Install App
                            <span style={{ fontSize: '0.65rem', marginLeft: 6, opacity: 0.8 }}>Free</span>
                        </button>
                    )}
                    {user ? (
                        <button
                            className={`sidebar__nav-item ${currentView === 'profile' ? 'active' : ''}`}
                            onClick={() => { onNavigate('profile'); onClose(); }}
                        >
                            <span className="icon">👤</span>
                            {user.username}
                        </button>
                    ) : (
                        <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            Not signed in
                        </div>
                    )}
                </div>

            </aside>
        </>
    );
}
