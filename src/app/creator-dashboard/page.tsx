"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Youtube, BarChart3, Users, Zap, Search } from 'lucide-react';

// Mock Data for Dashboard
const MOCK_CHANNEL_STATS = {
    subscribers: "1.2M",
    videosPromoted: 12,
    totalVeritasViews: "450K",
    humanScoreAvg: 96
};

const MOCK_PROMOTED_VIDEOS = [
    { id: "hJKe5P9y6V4", title: "How I Started A $100M Company (In 2024)", views: "125K", humanScore: 98, status: "Active" },
    { id: "BSX8VjX3l00", title: "Mental Models for Founders", views: "89K", humanScore: 95, status: "Active" },
    { id: "pL5223_Cq1s", title: "The Ultimate Guide To Deep Work", views: "236K", humanScore: 92, status: "Trending" },
];

export default function CreatorDashboard() {
    // For demo purposes, we can toggle this state
    const [isClaimed, setIsClaimed] = useState(false);
    const [channelUrl, setChannelUrl] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);

    const handleClaim = (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        // Simulate API call
        setTimeout(() => {
            setIsVerifying(false);
            setIsClaimed(true);
        }, 2000);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30">

            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-red-900 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                            <span className="font-bold text-xl tracking-tight">Veritas <span className="text-gray-500 font-normal text-sm ml-2">for Creators</span></span>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-8 max-w-[1200px] mx-auto min-h-[80vh] flex flex-col justify-center">

                <AnimatePresence mode='wait'>
                    {!isClaimed ? (
                        /* STATE 1: UNCLAIMED (Claim Flow) */
                        <motion.div
                            key="unclaimed"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full max-w-2xl mx-auto text-center"
                        >
                            <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-900/10 border border-red-500/20 shadow-[0_0_40px_rgba(220,38,38,0.1)]">
                                <Youtube className="w-10 h-10 text-red-500" />
                            </div>

                            <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 mb-6">
                                Claim Your Authority.
                            </h1>

                            <p className="text-lg text-gray-400 mb-12 leading-relaxed">
                                Veritas aggregates only the highest quality, human-verified content.
                                <br />Claim your channel to manage your presence and see who's watching.
                            </p>

                            <form onSubmit={handleClaim} className="relative max-w-lg mx-auto">
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-red-600/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <input
                                        type="text"
                                        value={channelUrl}
                                        onChange={(e) => setChannelUrl(e.target.value)}
                                        placeholder="Paste your YouTube Channel URL..."
                                        className="w-full bg-[#151515] border border-white/10 rounded-full py-4 px-8 text-white focus:outline-none focus:border-red-500/50 focus:bg-[#1a1a1a] transition-all relative z-10 placeholder:text-gray-600 text-center shadow-2xl"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isVerifying}
                                    className="mt-8 px-12 py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
                                >
                                    {isVerifying ? (
                                        <>
                                            <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                                            Verifying...
                                        </>
                                    ) : (
                                        <>
                                            <span>Verify & Claim</span>
                                            <CheckCircle2 className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </form>

                            <p className="mt-8 text-xs text-gray-600">
                                By claiming, you agree to our anti-AI content policy.
                            </p>
                        </motion.div>
                    ) : (
                        /* STATE 2: CLAIMED (Dashboard View) */
                        <motion.div
                            key="claimed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full"
                        >
                            {/* Header Info */}
                            <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12 border-b border-white/5 pb-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-700 to-black border-2 border-white/10 shadow-2xl flex items-center justify-center text-3xl font-bold">
                                        AH
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h1 className="text-3xl font-bold text-white">Alex Hormozi</h1>
                                            <CheckCircle2 className="w-5 h-5 text-blue-400 fill-blue-400/10" />
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span>@AlexHormozi</span>
                                            <span className="text-gray-600">•</span>
                                            <span className="text-green-400 font-medium">Verified Human Creator</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium">
                                        Manage Links
                                    </button>
                                    <button className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-sm font-bold text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                                        Submit New Video
                                    </button>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                                {[
                                    { label: 'Total Veritas Views', value: MOCK_CHANNEL_STATS.totalVeritasViews, icon: Users, color: 'text-blue-400' },
                                    { label: 'Human Score Avg', value: `${MOCK_CHANNEL_STATS.humanScoreAvg}%`, icon: Zap, color: 'text-yellow-400' },
                                    { label: 'Videos Promoted', value: MOCK_CHANNEL_STATS.videosPromoted, icon: Youtube, color: 'text-red-400' },
                                    { label: 'Engagement Rate', value: '18.5%', icon: BarChart3, color: 'text-green-400' },
                                ].map((stat, i) => (
                                    <div key={i} className="p-6 rounded-2xl bg-[#111] border border-white/5 hover:border-white/10 transition-colors group">
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-sm text-gray-500 font-medium">{stat.label}</span>
                                            <stat.icon className={`w-5 h-5 ${stat.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                                        </div>
                                        <div className="text-3xl font-bold text-white tracking-tight">{stat.value}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Promoted Videos List */}
                            <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-white">Active Promotions</h2>
                                    <div className="bg-black/50 border border-white/5 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs text-gray-400">
                                        <Search className="w-3.5 h-3.5" />
                                        <span>Search videos...</span>
                                    </div>
                                </div>

                                <div className="divide-y divide-white/5">
                                    {MOCK_PROMOTED_VIDEOS.map((video) => (
                                        <div key={video.id} className="p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                                            {/* Thumbnail Preview */}
                                            <div className="w-24 aspect-video bg-gray-800 rounded-md overflow-hidden relative">
                                                <img
                                                    src={`https://img.youtube.com/vi/${video.id}/default.jpg`}
                                                    alt={video.title}
                                                    className="w-full h-full object-cover opacity-80"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-medium text-white truncate group-hover:text-red-400 transition-colors">{video.title}</h3>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    <span>Published: 2 days ago</span>
                                                    <span>•</span>
                                                    <span className={video.status === 'Trending' ? 'text-green-400 font-bold' : ''}>{video.status}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-8 px-4">
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500">Human Score</div>
                                                    <div className="text-sm font-bold text-green-400">{video.humanScore}%</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500">Views</div>
                                                    <div className="text-sm font-bold text-white">{video.views}</div>
                                                </div>
                                            </div>

                                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                                <div className="w-1 h-1 bg-current rounded-full mb-0.5" />
                                                <div className="w-1 h-1 bg-current rounded-full mb-0.5" />
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </motion.div>
                    )}
                </AnimatePresence>

            </main>
        </div>
    );
}
