/**
 * Phantom Beats — Mobile Bottom Navigation Bar
 * Spotify/Instagram style bottom nav for mobile screens.
 * Shows on ≤768px, hidden on desktop.
 */

import { usePlayer } from '../contexts/PlayerContext';

const BASE_ITEMS = [
    { id: 'home', icon: '🏠', label: 'Home' },
    { id: 'search', icon: '🔍', label: 'Search' },
    { id: 'trending', icon: '🔥', label: 'Trending' },
    { id: 'explore', icon: '🧭', label: 'Explore' },
    { id: 'library', icon: '📚', label: 'Library' },
];

export default function MobileBottomNav({
    currentView, onNavigate, onLibraryClick, sidebarOpen,
    canInstall, onInstallClick
}) {
    const { currentTrack } = usePlayer();

    // Dynamically add install button when PWA is installable
    const navItems = canInstall
        ? [...BASE_ITEMS, { id: 'install', icon: '📲', label: 'Install' }]
        : BASE_ITEMS;

    const handleNav = (id) => {
        if (id === 'library') {
            onLibraryClick?.(); // toggles sidebar
        } else if (id === 'install') {
            onInstallClick?.();
        } else {
            onNavigate(id);
        }
    };

    const isActive = (id) => {
        if (id === 'library') return sidebarOpen;
        if (id === 'install') return false;
        return currentView === id || (id === 'library' && (currentView === 'playlist' || currentView === 'downloads'));
    };

    return (
        // Note: no 'with-player' offset needed — player sits at bottom:60px via CSS
        <nav className="mobile-bottom-nav">
            {navItems.map(item => (
                <button
                    key={item.id}
                    className={`mobile-bottom-nav__item ${isActive(item.id) ? 'active' : ''} ${item.id === 'install' ? 'install' : ''}`}
                    onClick={() => handleNav(item.id)}
                    aria-label={item.label}
                >
                    <span className="mobile-bottom-nav__icon">{item.icon}</span>
                    <span className="mobile-bottom-nav__label">{item.label}</span>
                </button>
            ))}
        </nav>
    );
}
