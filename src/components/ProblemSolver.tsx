"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Lightbulb, Sparkles, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { recordSearch } from '@/app/actions/video-actions';

export default function ProblemSolver({ onSearchResults, onClear, activeFilter }: {
    onSearchResults: (results: any[], searchQuery: string) => void,
    onClear: () => void,
    activeFilter?: string
}) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Convert filter label to API value
    const getTemporalFilterValue = (label?: string): string | undefined => {
        if (!label) return undefined;
        if (label === "Last 14 days") return '14';
        if (label === "Last 28 days") return '28';
        if (label === "Last 69 days") return '60';
        return 'evergreen';
    };

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setShowSuggestions(false);

        // Log the search
        recordSearch(query);

        setLoading(true);
        setHasSearched(true);
        try {
            const temporalFilter = getTemporalFilterValue(activeFilter);
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, temporalFilter }),
            });
            const data = await res.json();
            if (data.success) {
                // Pass results AND query up to parent (Dashboard)
                onSearchResults(data.matches || [], query);
            }
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
    };

    const clearSearch = () => {
        setQuery('');
        setHasSearched(false);
        setShowSuggestions(false);
        inputRef.current?.blur(); // dismiss keyboard on mobile
        onClear(); // Reset parent to default feed
    };

    const fetchSuggestions = useCallback(async () => {
        if (loadingSuggestions) return;
        setLoadingSuggestions(true);
        try {
            const res = await fetch('/api/search/suggest', { method: 'POST' });
            const data = await res.json();
            if (data.success && data.suggestions?.length > 0) {
                setSuggestions(data.suggestions);
            }
        } catch (err) {
            console.error("Failed to fetch suggestions", err);
        } finally {
            setLoadingSuggestions(false);
        }
    }, [loadingSuggestions]);

    const handleLightbulbClick = async () => {
        if (showSuggestions) {
            setShowSuggestions(false);
            return;
        }
        // Fetch suggestions if not already loaded
        if (suggestions.length === 0) {
            await fetchSuggestions();
        }
        setShowSuggestions(true);
        inputRef.current?.focus();
    };

    const handleSuggestionClick = async (suggestion: string) => {
        setQuery(suggestion);
        setShowSuggestions(false);
        recordSearch(suggestion);
        setLoading(true);
        setHasSearched(true);
        try {
            const temporalFilter = getTemporalFilterValue(activeFilter);
            const res = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: suggestion, temporalFilter }),
            });
            const data = await res.json();
            if (data.success) {
                onSearchResults(data.matches || [], suggestion);
            }
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
    };

    // Close suggestions on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="w-full max-w-4xl mx-auto mb-8" ref={containerRef}>
            <div className="relative z-20">
                {/* Input Container */}
                <form onSubmit={handleSearch} className="relative group">
                    <div className={`
                        absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-600 via-red-900 to-red-600 opacity-20 group-hover:opacity-40 transition duration-500 blur-lg
                        ${hasSearched ? 'opacity-0' : ''} 
                    `} />

                    <div className="relative flex items-center bg-[#0F0F0F] border border-white/10 rounded-xl overflow-hidden shadow-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-red-500/50">
                        {/* Pulsating Lightbulb Button */}
                        <button
                            type="button"
                            onClick={handleLightbulbClick}
                            className="pl-4 md:pl-6 text-gray-400 flex-shrink-0 group/bulb"
                            title="Get personalized suggestions"
                        >
                            {loading ? (
                                <Sparkles className="w-6 h-6 animate-pulse text-red-500" />
                            ) : loadingSuggestions ? (
                                <Sparkles className="w-6 h-6 animate-spin text-yellow-400" />
                            ) : (
                                <motion.div
                                    animate={{
                                        scale: [1, 1.15, 1],
                                        filter: [
                                            'drop-shadow(0 0 0px rgba(250,204,21,0))',
                                            'drop-shadow(0 0 6px rgba(250,204,21,0.8))',
                                            'drop-shadow(0 0 0px rgba(250,204,21,0))',
                                        ],
                                    }}
                                    transition={{
                                        duration: 2,
                                        repeat: Infinity,
                                        ease: 'easeInOut',
                                    }}
                                >
                                    <Lightbulb
                                        className={`w-6 h-6 transition-colors duration-200 ${showSuggestions ? 'text-yellow-400' : 'text-gray-400 group-hover/bulb:text-yellow-400'}`}
                                    />
                                </motion.div>
                            )}
                        </button>

                        <input
                            ref={inputRef}
                            type="text"
                            suppressHydrationWarning
                            className="w-full bg-transparent text-white p-4 md:p-6 text-base md:text-lg placeholder:text-gray-500 focus:outline-none"
                            placeholder="Describe your struggle..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        {hasSearched && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="mr-6 p-2 rounded-full hover:bg-white/10 text-gray-400 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                        {!hasSearched && query && (
                            <button type="submit" className="mr-4 px-6 py-2 bg-red-700 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors flex items-center gap-2">
                                Solve <ArrowRight className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </form>

                {/* Suggestions Dropdown */}
                <AnimatePresence>
                    {showSuggestions && suggestions.length > 0 && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.18 }}
                            className="absolute top-full mt-2 w-full bg-[#141414] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30"
                        >
                            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5">
                                <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                                <span className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">
                                    Suggested for you
                                </span>
                            </div>
                            {suggestions.map((suggestion, i) => (
                                <motion.button
                                    key={i}
                                    initial={{ opacity: 0, x: -6 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.06 }}
                                    type="button"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="w-full text-left px-5 py-3.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-colors duration-150 flex items-center gap-3 group/item"
                                >
                                    <ArrowRight className="w-3.5 h-3.5 text-red-500/60 group-hover/item:text-red-500 transition-colors flex-shrink-0" />
                                    {suggestion}
                                </motion.button>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            {/* No internal results rendering anymore */}
        </div>
    );
}
