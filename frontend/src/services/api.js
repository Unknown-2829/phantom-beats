/**
 * Phantoms Music — API Service
 * Centralized HTTP client for all backend communication.
 */

const BASE_URL = '/api';

/**
 * Get the stored JWT token.
 */
function getToken() {
    return localStorage.getItem('phantoms_token');
}

/**
 * Make an authenticated API request.
 */
async function request(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    try {
        const res = await fetch(`${BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!res.ok) {
            const error = await res.json().catch(() => ({ detail: res.statusText }));

            // Auto-clear stale token on 401 (invalid/expired)
            if (res.status === 401) {
                localStorage.removeItem('phantoms_token');
            }

            throw new Error(error.detail || `HTTP ${res.status}`);
        }

        return await res.json();
    } catch (err) {
        if (err.name === 'TypeError' && err.message.includes('fetch')) {
            throw new Error('Network error — please check your connection');
        }
        throw err;
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Search
// ═══════════════════════════════════════════════════════════════════════════════

export async function searchSongs(query, limit = 20) {
    return request(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
}

export async function getAutocomplete(query) {
    return request(`/search/autocomplete?q=${encodeURIComponent(query)}`);
}

export async function getTrending(category = 'music', limit = 20) {
    return request(`/search/trending?category=${encodeURIComponent(category)}&limit=${limit}`);
}

export async function getGenres() {
    return request('/search/genres');
}

export async function getTrackInfo(videoId) {
    return request(`/search/track/${videoId}`);
}

export async function getRelatedTracks(videoId, limit = 10) {
    return request(`/search/related/${videoId}?limit=${limit}`);
}

export async function getLyrics(title, artist = '') {
    return request(`/search/lyrics?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`);
}

export async function getSearchHistory() {
    return request('/search/history');
}

// ═══════════════════════════════════════════════════════════════════════════════
// Streaming
// ═══════════════════════════════════════════════════════════════════════════════

export async function getStreamUrl(videoId) {
    return request(`/stream/${videoId}`);
}

export function getProxyStreamUrl(videoId) {
    return `${BASE_URL}/stream/${videoId}/proxy`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Playlists
// ═══════════════════════════════════════════════════════════════════════════════

export async function getPlaylists() {
    return request('/playlists');
}

export async function createPlaylist(name, description = '') {
    return request('/playlists', {
        method: 'POST',
        body: JSON.stringify({ name, description }),
    });
}

export async function getPlaylist(id) {
    return request(`/playlists/${id}`);
}

export async function updatePlaylist(id, data) {
    return request(`/playlists/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    });
}

export async function deletePlaylist(id) {
    return request(`/playlists/${id}`, { method: 'DELETE' });
}

export async function addTrackToPlaylist(playlistId, track) {
    return request(`/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify(track),
    });
}

export async function removeTrackFromPlaylist(playlistId, trackId) {
    return request(`/playlists/${playlistId}/tracks/${trackId}`, {
        method: 'DELETE',
    });
}

export async function reorderPlaylistTracks(playlistId, trackIds) {
    return request(`/playlists/${playlistId}/reorder`, {
        method: 'PUT',
        body: JSON.stringify({ track_ids: trackIds }),
    });
}

export async function importPlaylist(data) {
    return request('/playlists/import', {
        method: 'POST',
        body: JSON.stringify(data),
    });
}

export async function exportPlaylist(id) {
    return request(`/playlists/${id}/export`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Authentication
// ═══════════════════════════════════════════════════════════════════════════════

export async function register(username, email, password) {
    const data = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
    });
    if (data.token) {
        localStorage.setItem('phantoms_token', data.token);
    }
    return data;
}

export async function login(username, password) {
    const data = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
    });
    if (data.token) {
        localStorage.setItem('phantoms_token', data.token);
    }
    return data;
}

export async function getProfile() {
    return request('/auth/me');
}

export function logout() {
    localStorage.removeItem('phantoms_token');
}

export function isLoggedIn() {
    return !!getToken();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Download & Spotify Import (new in Phase 1)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Download a track as MP3 AND cache in IndexedDB for offline playback.
 * @param {string} videoId 
 * @param {string} title 
 * @param {object} track  - full track object for metadata (optional)
 */
export async function downloadTrack(videoId, title = 'audio', track = null) {
    const url = `${BASE_URL}/stream/${videoId}/download`;

    // Trigger browser download dialog
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.mp3`;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Also cache blob in IndexedDB for offline playback
    try {
        const resp = await fetch(url);
        if (resp.ok) {
            const blob = await resp.blob();
            // Dynamically import to avoid circular deps
            const { saveDownload } = await import('../components/DownloadsPage');
            await saveDownload(track || { video_id: videoId, title, artist: '', duration: 0, thumbnail: '' }, blob);
        }
    } catch (e) {
        console.warn('[Download] Could not cache for offline:', e.message);
    }
}


export async function importSpotifyTracks(playlistName, url) {
    return request('/playlists/import-spotify', {
        method: 'POST',
        body: JSON.stringify({ url }), // Backend handles parsing & renaming
    });
}


