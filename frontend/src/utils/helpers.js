/**
 * Phantoms Music — Utility Helpers
 */

/** Format seconds to mm:ss */
export function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Debounce a function call */
export function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
    };
}

/** Generate a unique ID */
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

/** Sanitize HTML to prevent XSS */
export function sanitize(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/** Truncate text with ellipsis */
export function truncate(str, len = 40) {
    if (!str) return '';
    return str.length > len ? str.slice(0, len) + '…' : str;
}

/** Format large numbers (e.g., view counts) */
export function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
    return num.toString();
}

/** Shuffle an array (Fisher-Yates) */
export function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}
