/**
 * Phantoms Music — AuthModal Component
 * Login / Register modal with tabs and JWT authentication.
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function AuthModal({ onClose }) {
    const [tab, setTab] = useState('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { loginUser, registerUser } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (tab === 'login') {
                await loginUser(username, password);
            } else {
                if (!email) { setError('Email is required'); setLoading(false); return; }
                if (password.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
                await registerUser(username, email, password);
            }
            onClose();
        } catch (err) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="modal">
                <div className="modal__title">
                    {tab === 'login' ? 'Welcome Back' : 'Create Account'}
                </div>

                <div className="auth-tabs">
                    <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
                        Sign In
                    </button>
                    <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
                        Sign Up
                    </button>
                </div>

                {error && <div className="auth-error">⚠️ {error}</div>}

                <form onSubmit={handleSubmit}>
                    <input
                        className="modal__input"
                        type="text"
                        placeholder="Username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoFocus
                        id="auth-username"
                    />

                    {tab === 'register' && (
                        <input
                            className="modal__input"
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            id="auth-email"
                        />
                    )}

                    <input
                        className="modal__input"
                        type="password"
                        placeholder="Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        id="auth-password"
                    />

                    <div className="modal__actions">
                        <button type="button" className="btn btn--ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn--primary" disabled={loading}>
                            {loading ? 'Loading...' : tab === 'login' ? 'Sign In' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
