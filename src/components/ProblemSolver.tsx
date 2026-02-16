"use client";

import React, { useState } from 'react';
import { Search, Sparkles, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VideoCard from './VideoCard';
import { recordSearch } from '@/app/actions/video-actions';

export default function ProblemSolver({ onSearchResults, onClear, activeFilter }: {
    onSearchResults: (results: any[], searchQuery: string) => void,
    onClear: () => void,
    activeFilter?: string
}) {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

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
        onClear(); // Reset parent to default feed
    };

    return (
        <div className="w-full max-w-4xl mx-auto mb-8">
            <div className="relative z-20">
                {/* Input Container */}
                <form onSubmit={handleSearch} className="relative group">
                    <div className={`
                        absolute -inset-1 rounded-2xl bg-gradient-to-r from-red-600 via-red-900 to-red-600 opacity-20 group-hover:opacity-40 transition duration-500 blur-lg
                        ${hasSearched ? 'opacity-0' : ''} 
                    `} />

                    <div className="relative flex items-center bg-[#0F0F0F] border border-white/10 rounded-xl overflow-hidden shadow-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-red-500/50">
                        <div className="pl-6 text-gray-400">
                            {loading ? <Sparkles className="w-6 h-6 animate-pulse text-red-500" /> : <Search className="w-6 h-6" />}
                        </div>
                        <input
                            type="text"
                            suppressHydrationWarning
                            className="w-full bg-transparent text-white p-6 text-lg placeholder:text-gray-500 focus:outline-none"
                            placeholder="Describe your current struggle (e.g., 'I'm lazy but I want to make $10k')..."
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
            </div>
            {/* No internal results rendering anymore */}
        </div>
    );
}
