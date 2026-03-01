/**
 * Phantoms Music — Profile Page
 * User account info, stats, recently played, account settings.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import * as api from '../services/api';
import { formatTime } from '../utils/helpers';

function StatCard({ icon, label, value }) {
    return (
        <div className="stat-card">
            <div className="stat-card__icon">{icon}</div>
            <div className="stat-card__value">{value}</div>
            <div className="stat-card__label">{label}</div>
        </div>
    );
}

export default function ProfilePage({ playlists, onNavigate }) {
    const { user, logout } = useAuth();
    const [history, setHistory] = useState([]);
    const [playHistory, setPlayHistory] = useState([]);
    const [historyView, setHistoryView] = useState('play'); // 'play' or 'search'
    const [editing, setEditing] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        api.getSearchHistory().then(d => setHistory(d.history || [])).catch(() => { });
        try {
            setPlayHistory(JSON.parse(localStorage.getItem('phantoms_history') || '[]'));
        } catch (_) { }
    }, []);

    const memberSince = user?.created_at
        ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
        : 'Recently';

    const avatarLetter = (user?.username || 'U')[0].toUpperCase();

    return (
        <div className="profile-page">
            {/* ─── Profile Header ─────────────────────────────────────────── */}
            <div className="profile-header">
                <div className="profile-avatar">
                    <span className="profile-avatar__letter">{avatarLetter}</span>
                </div>
                <div className="profile-info">
                    <h1 className="profile-info__name">{user?.username || 'Guest'}</h1>
                    <p className="profile-info__email">{user?.email || ''}</p>
                    <p className="profile-info__since">Member since {memberSince}</p>
                </div>
                <button className="btn btn--ghost" onClick={logout} style={{ marginLeft: 'auto' }}>
                    🚪 Sign Out
                </button>
            </div>

            {/* ─── Stats Row ──────────────────────────────────────────────── */}
            <div className="stats-row">
                <StatCard icon="🎵" label="Playlists" value={playlists?.length || 0} />
                <StatCard icon="🔍" label="Searches" value={history?.length || 0} />
                <StatCard icon="⭐" label="Rank" value="Music Fan" />
                <StatCard icon="🎧" label="Status" value="Active" />
            </div>

            {/* ─── Tabs ───────────────────────────────────────────────────── */}
            <div className="profile-tabs">
                {['overview', 'history', 'settings'].map(tab => (
                    <button
                        key={tab}
                        className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab === 'overview' && '🏠 Overview'}
                        {tab === 'history' && '🕐 History'}
                        {tab === 'settings' && '⚙️ Settings'}
                    </button>
                ))}
            </div>

            {/* ─── Overview Tab ───────────────────────────────────────────── */}
            {activeTab === 'overview' && (
                <div className="profile-tab-content">
                    <div className="section-header">
                        <h2 className="section-title">Your Playlists</h2>
                        <button className="btn btn--ghost btn--sm" onClick={() => onNavigate('playlists')}>
                            View all →
                        </button>
                    </div>
                    {playlists && playlists.length > 0 ? (
                        <div className="playlist-grid">
                            {playlists.slice(0, 6).map(pl => (
                                <div key={pl.id} className="playlist-mini-card" onClick={() => onNavigate('playlists')}>
                                    <div className="playlist-mini-card__icon">🎵</div>
                                    <div className="playlist-mini-card__name">{pl.name}</div>
                                    <div className="playlist-mini-card__count">{pl.track_count || 0} songs</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state__icon">🎵</div>
                            <div className="empty-state__text">No playlists yet</div>
                            <button className="btn btn--primary" style={{ marginTop: 12 }} onClick={() => onNavigate('playlists')}>
                                Create Playlist
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ─── History Tab ────────────────────────────────────────────── */}
            {activeTab === 'history' && (
                <div className="profile-tab-content">
                    <div className="section-header" style={{ marginBottom: 16 }}>
                        <h2 className="section-title">History</h2>
                        <div className="history-toggles" style={{ display: 'flex', gap: 8 }}>
                            <button className={`btn ${historyView === 'play' ? 'btn--primary' : 'btn--ghost'} btn--sm`} onClick={() => setHistoryView('play')}>Play History</button>
                            <button className={`btn ${historyView === 'search' ? 'btn--primary' : 'btn--ghost'} btn--sm`} onClick={() => setHistoryView('search')}>Search History</button>
                        </div>
                    </div>

                    {historyView === 'search' ? (
                        history.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">🔍</div>
                                <div className="empty-state__text">No search history yet</div>
                            </div>
                        ) : (
                            <div className="history-list">
                                {history.map((h, i) => (
                                    <div key={i} className="history-item">
                                        <span className="history-item__icon">🔍</span>
                                        <span className="history-item__query">{h.query}</span>
                                        <span className="history-item__count">{h.result_count} results</span>
                                        <span className="history-item__time">
                                            {new Date(h.created_at).toLocaleDateString()}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        playHistory.length === 0 ? (
                            <div className="empty-state">
                                <div className="empty-state__icon">🕐</div>
                                <div className="empty-state__text">No play history yet</div>
                            </div>
                        ) : (
                            <div className="history-list">
                                {playHistory.map((track, i) => (
                                    <div key={i} className="history-item" onClick={() => {/* optionally play track */ }} style={{ cursor: 'pointer' }}>
                                        <img src={track.thumbnail} alt="" style={{ width: 40, height: 40, borderRadius: 4, objectFit: 'cover' }} />
                                        <div style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                                            <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{track.artist}</div>
                                        </div>
                                        <span className="history-item__time">
                                            {formatTime(track.duration)}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )
                    )}
                </div>
            )}

            {/* ─── Settings Tab ───────────────────────────────────────────── */}
            {activeTab === 'settings' && (
                <div className="profile-tab-content">
                    <h2 className="section-title" style={{ marginBottom: 24 }}>Account Settings</h2>

                    <div className="settings-section">
                        <h3 className="settings-section__title">Account Info</h3>
                        <div className="settings-field">
                            <label>Username</label>
                            <div className="settings-field__value">{user?.username}</div>
                        </div>
                        <div className="settings-field">
                            <label>Email</label>
                            <div className="settings-field__value">{user?.email}</div>
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3 className="settings-section__title">Keyboard Shortcuts</h3>
                        <div className="shortcuts-grid">
                            {[
                                ['Space', 'Play / Pause'],
                                ['Alt + →', 'Next track'],
                                ['Alt + ←', 'Previous track'],
                                ['Shift + →', 'Seek +10s'],
                                ['Shift + ←', 'Seek -10s'],
                                ['↑ / ↓', 'Volume'],
                                ['M', 'Mute'],
                            ].map(([key, action]) => (
                                <div key={key} className="shortcut-row">
                                    <kbd className="shortcut-key">{key}</kbd>
                                    <span className="shortcut-action">{action}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="settings-section">
                        <h3 className="settings-section__title">Danger Zone</h3>
                        <button className="btn btn--danger" onClick={logout}>
                            Sign Out of All Devices
                        </button>
                    </div>

                    {message && <div className="settings-message">{message}</div>}
                </div>
            )}
        </div>
    );
}
