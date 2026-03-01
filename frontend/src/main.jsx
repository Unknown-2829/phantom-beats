/**
 * Phantoms Music — Entry Point
 * Mounts the React app with all context providers.
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import { PlayerProvider } from './contexts/PlayerContext';

// ─── Error Boundary to catch white-screen crashes ───────────────────────────
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, info) {
        console.error('💥 App crashed:', error, info);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    fontFamily: 'sans-serif', background: '#0f0f1a', color: '#fff',
                    padding: 40, minHeight: '100vh', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 16,
                }}>
                    <div style={{ fontSize: '3rem' }}>💥</div>
                    <h2 style={{ color: '#ef4444' }}>Something crashed</h2>
                    <pre style={{
                        background: '#1a1a2e', padding: 20, borderRadius: 8,
                        color: '#f87171', fontSize: '0.8rem', maxWidth: 800,
                        overflow: 'auto', whiteSpace: 'pre-wrap',
                    }}>
                        {this.state.error?.message}
                        {'\n\n'}
                        {this.state.error?.stack?.slice(0, 600)}
                    </pre>
                    <button
                        onClick={() => { localStorage.clear(); window.location.reload(); }}
                        style={{
                            background: '#8b5cf6', color: '#fff', border: 'none',
                            padding: '12px 24px', borderRadius: 8, cursor: 'pointer',
                            fontSize: '1rem',
                        }}
                    >
                        Clear & Reload
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// Register service worker for offline caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(
            (reg) => console.log('✅ Service Worker registered:', reg.scope),
            (err) => console.log('⚠️ Service Worker registration failed:', err)
        );
    });
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ErrorBoundary>
            <ThemeProvider>
                <AuthProvider>
                    <PlayerProvider>
                        <App />
                    </PlayerProvider>
                </AuthProvider>
            </ThemeProvider>
        </ErrorBoundary>
    </React.StrictMode>
);
