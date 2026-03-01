/**
 * Phantoms Music — SearchBar Component
 * Real-time search with autocomplete dropdown and debounced input.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getAutocomplete } from '../services/api';
import { debounce } from '../utils/helpers';

export default function SearchBar({ onSearch }) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const inputRef = useRef(null);
    const dropdownRef = useRef(null);

    // Debounced autocomplete fetcher
    const fetchSuggestions = useCallback(
        debounce(async (q) => {
            if (q.length < 2) { setSuggestions([]); return; }
            try {
                const data = await getAutocomplete(q);
                setSuggestions(data.suggestions || []);
                setShowDropdown(true);
            } catch { setSuggestions([]); }
        }, 300),
        []
    );

    const handleChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        fetchSuggestions(val);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query.trim());
            setShowDropdown(false);
            setSuggestions([]); // Clear suggestions to prevent reopening on focus
            document.activeElement?.blur(); // Dismiss mobile keyboard
        }
    };

    const handleSuggestionClick = (suggestion) => {
        setQuery(suggestion);
        setShowDropdown(false);
        setSuggestions([]); // Clear suggestions
        onSearch(suggestion);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target) &&
                inputRef.current && !inputRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <form className="search-container" onSubmit={handleSubmit}>
            <span className="search-icon">🔍</span>
            <input
                ref={inputRef}
                type="text"
                className="search-bar"
                placeholder="Search songs, artists, albums..."
                value={query}
                onChange={handleChange}
                onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
                autoComplete="off"
                id="search-input"
            />
            {showDropdown && suggestions.length > 0 && (
                <div className="search-dropdown" ref={dropdownRef}>
                    {suggestions.map((s, i) => (
                        <div
                            key={i}
                            className="search-dropdown__item"
                            onClick={() => handleSuggestionClick(s)}
                        >
                            <span style={{ opacity: 0.5 }}>🔍</span>
                            {s}
                        </div>
                    ))}
                </div>
            )}
        </form>
    );
}
