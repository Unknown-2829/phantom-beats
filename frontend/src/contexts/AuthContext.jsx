/**
 * Phantom Beats — Auth Context
 * JWT token management and user state.
 * ⚡ FAST STARTUP: loads user from localStorage cache instantly,
 *    then silently re-validates with the server in the background.
 *    Sign-out is purely local — zero network calls, instant.
 */

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as api from '../services/api';

const AUTH_CACHE_KEY = 'phantom_user_cache';

const AuthContext = createContext();

export function AuthProvider({ children }) {
    // ⚡ Load from cache FIRST — UI is never blocked on a network call
    const [user, setUser] = useState(() => {
        try {
            const cached = localStorage.getItem(AUTH_CACHE_KEY);
            return cached ? JSON.parse(cached) : null;
        } catch (_) { return null; }
    });
    // loading=false immediately so the app renders right away
    const [loading, setLoading] = useState(false);

    // Silent background re-validation (doesn't block UI)
    useEffect(() => {
        if (!api.isLoggedIn()) {
            // No token — ensure cache is cleared
            localStorage.removeItem(AUTH_CACHE_KEY);
            setUser(null);
            return;
        }

        // Token exists — validate silently in background
        let cancelled = false;
        api.getProfile()
            .then(data => {
                if (cancelled) return;
                setUser(data.user);
                localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data.user));
            })
            .catch(err => {
                if (cancelled) return;
                // Only clear on real auth errors (expired/invalid token), not network issues
                if (err.message?.includes('401') || err.message?.includes('Invalid token') || err.message?.includes('expired')) {
                    api.logout();
                    localStorage.removeItem(AUTH_CACHE_KEY);
                    setUser(null);
                }
                // On network error: keep the cached user — server may be restarting
            });

        return () => { cancelled = true; };
    }, []); // runs once on mount, doesn't block render

    const loginUser = useCallback(async (username, password) => {
        const data = await api.login(username, password);
        setUser(data.user);
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data.user));
        return data;
    }, []);

    const registerUser = useCallback(async (username, email, password) => {
        const data = await api.register(username, email, password);
        setUser(data.user);
        localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(data.user));
        return data;
    }, []);

    // ⚡ Sign-out: purely local, zero network calls, instant
    const logoutUser = useCallback(() => {
        api.logout();
        localStorage.removeItem(AUTH_CACHE_KEY);
        setUser(null);
    }, []);

    return (
        <AuthContext.Provider value={{ user, loading, loginUser, registerUser, logoutUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
