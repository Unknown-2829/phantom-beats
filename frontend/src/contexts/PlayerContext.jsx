/**
 * Phantoms Music — Player Context
 * Global audio state, queue, playback controls, equalizer, and OS notifications.
 */

import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { getProxyStreamUrl, getRelatedTracks } from '../services/api';
import { shuffleArray } from '../utils/helpers';

const PlayerContext = createContext();

// ─── Equalizer Presets ───────────────────────────────────────────────────────
const EQ_PRESETS = {
    flat: { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    bass_boost: { name: 'Bass Boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
    treble: { name: 'Treble', gains: [0, 0, 0, 0, 0, 1, 2, 4, 5, 6] },
    vocal: { name: 'Vocal', gains: [-2, -1, 0, 2, 4, 4, 2, 0, -1, -2] },
    rock: { name: 'Rock', gains: [4, 3, 1, 0, -1, -1, 0, 2, 3, 4] },
    pop: { name: 'Pop', gains: [-1, 1, 3, 4, 3, 0, -1, -1, 0, 1] },
    jazz: { name: 'Jazz', gains: [3, 2, 0, 1, -1, -1, 0, 1, 2, 3] },
    electronic: { name: 'Electronic', gains: [4, 3, 1, 0, -1, 1, 0, 2, 4, 5] },
    classical: { name: 'Classical', gains: [4, 3, 2, 1, -1, -1, 0, 1, 2, 4] },
    hiphop: { name: 'Hip Hop', gains: [5, 4, 1, 2, -1, -1, 1, 0, 1, 3] },
};

const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// ─── OS Notification helper ──────────────────────────────────────────────────
async function showNowPlayingNotification(track) {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
        try {
            new Notification('Now Playing 🎵', {
                body: `${track.title} — ${track.artist}`,
                icon: track.thumbnail || `https://img.youtube.com/vi/${track.video_id}/hqdefault.jpg`,
                silent: true,
                tag: 'now-playing', // replaces previous notification
            });
        } catch (_) { /* some browsers block in certain contexts */ }
    }
}

export function PlayerProvider({ children }) {
    // ─── State ───────────────────────────────────────────────────────────────
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [volume, setVolumeState] = useState(() =>
        parseFloat(localStorage.getItem('phantoms_volume') || '0.8')
    );
    const [isMuted, setIsMuted] = useState(false);
    const [repeatMode, setRepeatMode] = useState('off'); // off, one, all
    const [isShuffled, setIsShuffled] = useState(false);
    const [queue, setQueue] = useState([]);
    const [queueIndex, setQueueIndex] = useState(-1);
    const [eqPreset, setEqPreset] = useState('flat');
    const [error, setError] = useState(null);

    // ─── Refs ────────────────────────────────────────────────────────────────
    const audioRef = useRef(null);
    const audioCtxRef = useRef(null);
    const eqFiltersRef = useRef([]);
    const sourceRef = useRef(null);
    const originalQueueRef = useRef([]);
    const queueRef = useRef([]);
    const queueIndexRef = useRef(-1);
    const repeatModeRef = useRef('off');

    // Keep refs in sync so callbacks don't have stale closures
    useEffect(() => { queueRef.current = queue; }, [queue]);
    useEffect(() => { queueIndexRef.current = queueIndex; }, [queueIndex]);
    useEffect(() => { repeatModeRef.current = repeatMode; }, [repeatMode]);

    // ─── Persist queue to localStorage (survive refresh) ─────────────────────
    useEffect(() => {
        if (queue.length > 0) {
            try {
                localStorage.setItem('phantom_queue', JSON.stringify({ queue, queueIndex }));
            } catch (_) { }
        }
    }, [queue, queueIndex]);

    // ─── Restore queue on mount ───────────────────────────────────────────────
    useEffect(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('phantom_queue') || 'null');
            if (saved?.queue?.length > 0) {
                setQueue(saved.queue);
                setQueueIndex(saved.queueIndex ?? 0);
                // Restore the currentTrack display without auto-playing
                setCurrentTrack(saved.queue[saved.queueIndex ?? 0]);
            }
        } catch (_) { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ─── Persist repeat/shuffle ───────────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem('phantom_repeat', repeatMode);
    }, [repeatMode]);

    // ─── Create audio element once ───────────────────────────────────────────
    if (!audioRef.current) {
        const audio = new Audio();
        audio.preload = 'auto';
        audioRef.current = audio;
    }

    // ─── Volume persistence ──────────────────────────────────────────────────
    useEffect(() => {
        localStorage.setItem('phantoms_volume', volume.toString());
        audioRef.current.volume = isMuted ? 0 : volume;
    }, [volume, isMuted]);

    // ─── Core Playback ──────────────────────────────────────────────────────
    const playTrack = useCallback(async (track) => {
        if (!track?.video_id) return;

        // Phase 3: Add to History
        try {
            const h = JSON.parse(localStorage.getItem('phantoms_history') || '[]');
            const newH = [track, ...h.filter(t => t.video_id !== track.video_id)].slice(0, 50);
            localStorage.setItem('phantoms_history', JSON.stringify(newH));
        } catch (_) { }

        setIsLoading(true);
        setError(null);
        setCurrentTrack(track);
        setCurrentTime(0);

        try {
            // Initialize EQ on first user interaction
            if (!audioCtxRef.current) {
                try {
                    const ctx = new (window.AudioContext || window.webkitAudioContext)();
                    audioCtxRef.current = ctx;
                    const source = ctx.createMediaElementSource(audioRef.current);
                    sourceRef.current = source;
                    const filters = EQ_FREQUENCIES.map((freq, i) => {
                        const f = ctx.createBiquadFilter();
                        f.type = i === 0 ? 'lowshelf' : i === EQ_FREQUENCIES.length - 1 ? 'highshelf' : 'peaking';
                        f.frequency.value = freq;
                        f.Q.value = 1.4;
                        f.gain.value = 0;
                        return f;
                    });
                    source.connect(filters[0]);
                    for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
                    filters[filters.length - 1].connect(ctx.destination);
                    eqFiltersRef.current = filters;
                } catch (e) { /* EQ not critical */ }
            }
            if (audioCtxRef.current?.state === 'suspended') {
                await audioCtxRef.current.resume();
            }

            const audio = audioRef.current;
            audio.pause();

            const proxyUrl = getProxyStreamUrl(track.video_id);

            // Start loading — use canplay (not canplaythrough) for fast start
            await new Promise((resolve, reject) => {
                const cleanup = () => {
                    audio.removeEventListener('canplay', onCanPlay);
                    audio.removeEventListener('error', onError);
                };
                const onCanPlay = () => { cleanup(); resolve(); };
                const onError = () => { cleanup(); reject(new Error('Audio failed to load')); };

                audio.addEventListener('canplay', onCanPlay, { once: true });
                audio.addEventListener('error', onError, { once: true });
                audio.src = proxyUrl;
                audio.load();
            });

            await audio.play();

            // Set duration from track metadata as fallback if audio duration is NaN
            if (track.duration && (!audio.duration || !isFinite(audio.duration))) {
                setDuration(track.duration);
            }

            // OS notifications
            showNowPlayingNotification(track);

            // Media Session API (OS-level media controls)
            if ('mediaSession' in navigator) {
                navigator.mediaSession.metadata = new MediaMetadata({
                    title: track.title,
                    artist: track.artist,
                    artwork: [
                        { src: track.thumbnail || `https://img.youtube.com/vi/${track.video_id}/hqdefault.jpg`, sizes: '512x512', type: 'image/jpeg' }
                    ],
                });
                navigator.mediaSession.playbackState = 'playing';
            }
        } catch (err) {
            console.error('Playback error:', err);
            setError(err.message || 'Failed to play track');
            setIsPlaying(false);
            setIsLoading(false);
        }
    }, []);

    // ─── Track End Handler (uses refs to avoid stale closures) ───────────────
    const handleTrackEnd = useCallback(() => {
        const rm = repeatModeRef.current;
        const qi = queueIndexRef.current;
        const q = queueRef.current;

        if (rm === 'one') {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => { });
        } else if (qi < q.length - 1) {
            const next = q[qi + 1];
            setQueueIndex(qi + 1);
            playTrack(next);
        } else if (rm === 'all' && q.length > 0) {
            setQueueIndex(0);
            playTrack(q[0]);
        } else {
            setIsPlaying(false);
        }
    }, [playTrack]);

    // ─── Audio element event listeners ──────────────────────────────────────
    useEffect(() => {
        const audio = audioRef.current;

        const onTimeUpdate = () => setCurrentTime(audio.currentTime);
        const onDurationChange = () => {
            if (audio.duration && isFinite(audio.duration)) setDuration(audio.duration);
        };
        const onWaiting = () => setIsLoading(true);
        const onCanPlay = () => setIsLoading(false);
        const onPlay = () => { setIsPlaying(true); setIsLoading(false); };
        const onPause = () => setIsPlaying(false);
        const onEnded = () => handleTrackEnd();
        const onError = () => {
            setError('Playback error — check your connection');
            setIsPlaying(false);
            setIsLoading(false);
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('durationchange', onDurationChange);
        audio.addEventListener('waiting', onWaiting);
        audio.addEventListener('canplay', onCanPlay);
        audio.addEventListener('play', onPlay);
        audio.addEventListener('pause', onPause);
        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('durationchange', onDurationChange);
            audio.removeEventListener('waiting', onWaiting);
            audio.removeEventListener('canplay', onCanPlay);
            audio.removeEventListener('play', onPlay);
            audio.removeEventListener('pause', onPause);
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
        };
    }, [handleTrackEnd]);

    const togglePlay = useCallback(() => {
        if (!currentTrack) return;
        if (!audioRef.current.src || audioRef.current.src === window.location.href) {
            playTrack(currentTrack);
            return;
        }
        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play().catch(() => { });
        }
    }, [currentTrack, isPlaying, playTrack]);

    const seek = useCallback((time) => {
        audioRef.current.currentTime = time;
        setCurrentTime(time);
    }, []);

    const setVolume = useCallback((val) => {
        setVolumeState(val);
        setIsMuted(false);
    }, []);

    const toggleMute = useCallback(() => setIsMuted(prev => !prev), []);

    // ─── Queue Management ───────────────────────────────────────────────────
    const playFromQueue = useCallback(async (index) => {
        const q = queueRef.current;
        if (index < 0 || index >= q.length) return;
        setQueueIndex(index);
        await playTrack(q[index]);
    }, [playTrack]);

    const addToQueue = useCallback((tracks) => {
        const newTracks = Array.isArray(tracks) ? tracks : [tracks];
        setQueue(prev => {
            const updated = [...prev, ...newTracks];
            originalQueueRef.current = [...originalQueueRef.current, ...newTracks];
            return updated;
        });
    }, []);

    const playAll = useCallback(async (tracks, startIndex = 0) => {
        if (!tracks || tracks.length === 0) return;
        originalQueueRef.current = [...tracks];
        const q = isShuffled ? shuffleArray([...tracks]) : tracks;
        setQueue(q);
        setQueueIndex(startIndex);
        await playTrack(q[startIndex]);
    }, [isShuffled, playTrack]);

    const playNext = useCallback(async () => {
        const qi = queueIndexRef.current;
        const q = queueRef.current;
        if (qi < q.length - 1) {
            setQueueIndex(qi + 1);
            playTrack(q[qi + 1]);
        } else if (repeatModeRef.current === 'all' && q.length > 0) {
            setQueueIndex(0);
            playTrack(q[0]);
        } else {
            // No queue — auto-fetch related tracks and continue
            const current = q[qi];
            if (current?.video_id) {
                try {
                    const data = await getRelatedTracks(current.video_id, 8);
                    const related = Array.isArray(data) ? data : (data?.results || []);
                    if (related.length > 0) {
                        const newQueue = [...q, ...related];
                        originalQueueRef.current = newQueue;
                        setQueue(newQueue);
                        setQueueIndex(qi + 1);
                        playTrack(related[0]);
                    }
                } catch (_) { }
            }
        }
    }, [playTrack]);

    const playPrev = useCallback(() => {
        const qi = queueIndexRef.current;
        const q = queueRef.current;
        if (audioRef.current.currentTime > 3) {
            seek(0); // restart current song if >3s played
        } else if (qi > 0) {
            setQueueIndex(qi - 1);
            playTrack(q[qi - 1]);
        } else {
            // At the start — just restart
            seek(0);
        }
    }, [seek, playTrack]);


    const toggleRepeat = useCallback(() => {
        setRepeatMode(prev => {
            if (prev === 'off') return 'all';
            if (prev === 'all') return 'one';
            return 'off';
        });
    }, []);

    const toggleShuffle = useCallback(() => {
        setIsShuffled(prev => {
            const next = !prev;
            const q = queueRef.current;
            const qi = queueIndexRef.current;
            if (next) {
                const current = q[qi];
                const rest = q.filter((_, i) => i !== qi);
                const shuffled = [current, ...shuffleArray(rest)];
                setQueue(shuffled);
                setQueueIndex(0);
            } else {
                const current = q[qi];
                setQueue(originalQueueRef.current);
                const newIdx = originalQueueRef.current.findIndex(t => t.video_id === current?.video_id);
                setQueueIndex(newIdx >= 0 ? newIdx : 0);
            }
            return next;
        });
    }, []);

    const applyEqPreset = useCallback((presetId) => {
        setEqPreset(presetId);
        const preset = EQ_PRESETS[presetId];
        if (!preset || eqFiltersRef.current.length === 0) return;
        eqFiltersRef.current.forEach((filter, i) => {
            filter.gain.value = preset.gains[i] || 0;
        });
    }, []);

    const clearError = useCallback(() => setError(null), []);

    // ─── Media Session Controls (OS headphones/keyboard buttons) ─────────────
    useEffect(() => {
        if (!('mediaSession' in navigator)) return;
        navigator.mediaSession.setActionHandler('play', () => audioRef.current.play().catch(() => { }));
        navigator.mediaSession.setActionHandler('pause', () => audioRef.current.pause());
        navigator.mediaSession.setActionHandler('previoustrack', playPrev);
        navigator.mediaSession.setActionHandler('nexttrack', playNext);
        navigator.mediaSession.setActionHandler('seekto', (e) => {
            if (e.seekTime !== undefined) seek(e.seekTime);
        });
    }, [playPrev, playNext, seek]);

    // ─── Keyboard shortcuts ──────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            switch (e.code) {
                case 'Space':
                    e.preventDefault();
                    togglePlay();
                    break;
                case 'ArrowRight':
                    if (e.altKey) { e.preventDefault(); playNext(); }
                    else if (e.shiftKey) { e.preventDefault(); seek(Math.min(audioRef.current.currentTime + 10, duration)); }
                    break;
                case 'ArrowLeft':
                    if (e.altKey) { e.preventDefault(); playPrev(); }
                    else if (e.shiftKey) { e.preventDefault(); seek(Math.max(audioRef.current.currentTime - 10, 0)); }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    setVolume(Math.min(volume + 0.1, 1));
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    setVolume(Math.max(volume - 0.1, 0));
                    break;
                case 'KeyM':
                    toggleMute();
                    break;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [togglePlay, playNext, playPrev, seek, setVolume, toggleMute, volume, duration]);

    // ─── Context Value ──────────────────────────────────────────────────────
    const value = {
        currentTrack, isPlaying, isLoading, duration, currentTime,
        volume, isMuted, repeatMode, isShuffled, queue, queueIndex,
        eqPreset, error, eqPresets: EQ_PRESETS, eqFrequencies: EQ_FREQUENCIES,
        eqFilters: eqFiltersRef.current,
        playTrack, togglePlay, seek, setVolume, toggleMute,
        playAll, addToQueue, playNext, playPrev,
        toggleRepeat, toggleShuffle,
        applyEqPreset, clearError,
        setQueue, setQueueIndex
    };

    return (
        <PlayerContext.Provider value={value}>
            {children}
        </PlayerContext.Provider>
    );
}

export function usePlayer() {
    const ctx = useContext(PlayerContext);
    if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
    return ctx;
}
