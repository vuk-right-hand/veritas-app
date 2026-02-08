"use client";

import React, { useState } from 'react';
import { Search, Sparkles, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VideoCard from './VideoCard';

export default function ProblemSolver() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setHasSearched(true);
        try {
            const res = await fetch('/api/search', {
                method: 'POST',
                body: JSON.stringify({ query }),
            });
            const data = await res.json();
            if (data.success) {
                setResults(data.matches || []);
            }
        } catch (err) {
            console.error("Search failed", err);
        } finally {
            setLoading(false);
        }
    };

    const clearSearch = () => {
        setQuery('');
        setResults([]);
        setHasSearched(false);
    };

    return (
        <div className="w-full max-w-4xl mx-auto mb-16">
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

            {/* Results Area */}
            <AnimatePresence>
                {hasSearched && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="mt-8 space-y-6"
                    >
                        <div className="flex items-center justify-between text-sm text-gray-400">
                            <span>Analysis for: <span className="text-white">"{query}"</span></span>
                            <span>{results.length} Matches Found</span>
                        </div>

                        {results.length === 0 && !loading ? (
                            <div className="text-center py-20 text-gray-500 bg-white/5 rounded-xl border border-dashed border-white/10">
                                No direct cures found in the library strictly matching that. <br /> Try being more specific or scan more videos.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {results.map((video, idx) => (
                                    <motion.div
                                        key={video.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.1 }}
                                    >
                                        <VideoCard
                                            videoId={video.id} // Note: This might need to accommodate full YT URL if VideoCard requires it, or logic update
                                            title={video.title}
                                            humanScore={video.human_score}
                                            takeaways={[]} // Search result might not return full takeaways unless we select them.
                                            onQuizStart={() => { }}
                                        />
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
