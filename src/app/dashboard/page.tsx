"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { User, Settings, LogOut, DollarSign, Zap, LayoutGrid, Brain, CheckCircle2 } from 'lucide-react';
import VideoCard from '@/components/VideoCard';
import ProblemSolver from '@/components/ProblemSolver';
import { suggestVideo, getVerifiedVideos } from '@/app/actions/video-actions';

// Mock Data for V1
const MOCK_VIDEOS = [
    {
        id: "hJKe5P9y6V4",
        title: "How I Started A $100M Company (In 2024)",
        humanScore: 98,
        category: "Sales & Marketing",
        channel: "Alex Hormozi",
        takeaways: [
            "The 'Rule of 100' for initial outreach volume",
            "Why you should sell the implementation, not the information",
            "How to structure your first offer for maximum conversion"
        ]
    },
    {
        id: "pL5223_Cq1s",
        title: "The Ultimate Guide To Deep Work",
        humanScore: 92,
        category: "Productivity",
        channel: "Cal Newport",
        takeaways: [
            "Difference between 'Deep Work' and 'Shallow Work'",
            "The bimodal scheduling strategy for busy professionals",
            "Why social media is fragmented your attention span"
        ]
    },
    {
        id: "zN8Z_R2ZC0c",
        title: "Vibe Coding: The Future of Software",
        humanScore: 88,
        category: "VibeCoding",
        channel: "Andrej Karpathy",
        takeaways: [
            "How LLMs are changing the coding paradigm",
            "Why syntax memorization is becoming obsolete",
            "Focusing on system design over implementation details"
        ]
    },
    {
        id: "BSX8VjX3l00",
        title: "Mental Models for Founders",
        humanScore: 95,
        category: "Mindset",
        channel: "Naval Ravikant",
        takeaways: [
            "Inversion: Solving problems backwards",
            "Principal-Agent problem in hiring",
            "Why specific knowledge cannot be taught"
        ]
    },
    {
        id: "LhC59n8VvTc",
        title: "Testing Gemini 1.5 Pro vs GPT-4",
        humanScore: 85,
        category: "Tech",
        channel: "Matthew Berman",
        takeaways: [
            "Context window comparison (1M vs 128k)",
            "Coding performance benchmarks",
            "Cost efficiency analysis for startups"
        ]
    },
    {
        id: "fN5h1_N4Z4c",
        title: "Stoicism for Modern Life",
        humanScore: 99,
        category: "Mindset",
        channel: "Ryan Holiday",
        takeaways: [
            "Control what you can, accept what you can't",
            "The obstacle is the way",
            "Memento Mori: Remembering death to live better"
        ]
    }
];

const TABS = [
    { id: 'money', label: 'Make Money', icon: DollarSign },
    { id: 'productivity', label: 'Productivity', icon: Zap },
    { id: 'coding', label: 'VibeCoding', icon: LayoutGrid },
    { id: 'mindset', label: 'Mindset', icon: Brain },
];

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState('money');

    // Suggestion State
    const [suggestionUrl, setSuggestionUrl] = useState("");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [suggestionMessage, setSuggestionMessage] = useState("");

    // Video Feed State
    const [videos, setVideos] = useState<any[]>(MOCK_VIDEOS);

    React.useEffect(() => {
        const loadVideos = async () => {
            const verified = await getVerifiedVideos();
            if (verified && verified.length > 0) {
                // Merge verified videos with mocks (or replace, depending on preference. Here we prepend)
                // Mapping DB shape to UI shape (Takeaways might be null in DB, so providing defaults)
                const formattedVerified = verified.map(v => ({
                    id: v.id,
                    title: v.title,
                    humanScore: v.human_score || 0, // Default if not analyzed yet
                    category: v.category_tag || 'Community',
                    channel: v.channel_id || 'Unknown',
                    takeaways: v.summary_points || ["Analysis pending...", "Watch to find out."]
                }));
                // Combine: Real at top, Mocks below
                setVideos([...formattedVerified, ...MOCK_VIDEOS]);
            }
        };
        loadVideos();
    }, []);

    const handleSuggest = async () => {
        if (!suggestionUrl) return;
        setIsSuggesting(true);
        setSuggestionStatus('idle');

        const result = await suggestVideo(suggestionUrl);

        if (result.success) {
            setSuggestionStatus('success');
            // Check if it was a "vote" (duplicate message) or new
            if (result.message.includes("vote")) {
                console.log("Upvoted existing video");
            }
            setSuggestionUrl("");
            setTimeout(() => setSuggestionStatus('idle'), 3000); // Reset after 3s
        } else {
            // Only alert for actual errors (like Banned)
            alert(result.message);
            setSuggestionStatus('error');
        }

        setIsSuggesting(false);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-red-500/30 font-sans">
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-red-900 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                        <span className="font-bold text-xl tracking-tight">Veritas</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <Link href="/founder-meeting" className="hidden md:flex items-center gap-2 text-xs text-gray-400 font-medium px-4 py-2 bg-white/5 rounded-full border border-white/5 hover:bg-red-900/20 hover:text-red-300 hover:border-red-500/20 transition-all group">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Meeting with the founder...
                        </Link>

                        {/* Creator Dashboard Link (Mocked functionality) */}
                        <div className="hidden md:block">
                            <Link href="/creator-dashboard">
                                <button className="text-xs font-semibold text-gray-400 hover:text-white transition-colors px-4 py-2 hover:bg-white/5 rounded-lg">
                                    Claim Channel / Dashboard
                                </button>
                            </Link>
                        </div>

                        {/* Profile / Stats Area */}
                        <div className="flex items-center gap-4 pl-6 border-l border-white/10">
                            <div className="flex flex-col items-end mr-2">
                                <span className="text-sm font-semibold text-white">The Builder</span>
                                <Link href="/onboarding" className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                                    Update Goals
                                </Link>
                            </div>
                            <button className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors group">
                                <User className="w-5 h-5 text-gray-400 group-hover:text-white" />
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-32 pb-20 px-8 max-w-[1600px] mx-auto">

                {/* Header Section */}
                <div className="mb-16 text-center">
                    <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 mb-6 tracking-tight">
                        Solve Your Problem.
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Don't browse. <span className="text-red-500 font-medium">Search for the cure.</span>
                    </p>
                </div>

                {/* The Brain (Search) */}
                <ProblemSolver />

                {/* Separation Line */}
                <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-16" />

                <div className="mb-12 flex flex-col md:flex-row items-end md:items-center justify-between gap-6">
                    <h2 className="text-2xl font-semibold text-white whitespace-nowrap">Your Feed</h2>

                    {/* Suggestion Bar - Centered relative to available space roughly */}
                    <div className="flex-1 w-full max-w-lg mx-auto flex flex-col items-center">
                        <span className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Let's promote the good ones</span>
                        <div className="w-full relative group">
                            <div className="absolute inset-0 bg-red-900/20 rounded-full blur-md group-hover:bg-red-900/30 transition-all opacity-0 group-hover:opacity-100" />
                            <input
                                type="text"
                                value={suggestionStatus === 'success' ? "Success! Thank you!" : suggestionUrl}
                                onChange={(e) => {
                                    if (suggestionStatus !== 'success') setSuggestionUrl(e.target.value);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSuggest()}
                                placeholder="Paste your favorite video/creator..."
                                disabled={suggestionStatus === 'success'}
                                className={`w-full border rounded-full py-3 px-6 text-sm focus:outline-none transition-all relative z-10 shadow-lg ${suggestionStatus === 'success'
                                        ? 'bg-green-900/20 border-green-500/50 text-green-400 font-bold text-center tracking-wide'
                                        : 'bg-[#1a1a1a] border-white/10 text-gray-300 focus:border-red-500/50 focus:bg-[#202020] placeholder:text-gray-600'
                                    }`}
                            />
                            <div className="absolute right-2 top-1.5 z-20">
                                <button
                                    onClick={handleSuggest}
                                    disabled={isSuggesting || suggestionStatus === 'success'}
                                    className={`p-1.5 rounded-full transition-all duration-500 ease-out disabled:opacity-100 ${suggestionStatus === 'success'
                                            ? 'bg-green-500 text-white transform scale-125 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
                                            : 'bg-white/5 hover:bg-red-600 hover:text-white text-gray-500'
                                        }`}
                                >
                                    <span className="sr-only">Submit</span>
                                    {isSuggesting ? (
                                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                                    ) : suggestionStatus === 'success' ? (
                                        <CheckCircle2 className="w-4 h-4 animate-in zoom-in spin-in-90 duration-300" />
                                    ) : (
                                        <Zap className="w-4 h-4 fill-current" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>Filter by:</span>
                        {/* Tabs */}
                        <div className="flex items-center gap-2">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border
                                        ${activeTab === tab.id
                                            ? 'bg-red-950/30 text-red-200 border-red-900/50'
                                            : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'}
                                    `}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>


                {/* Video Grid - 3 Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {videos.map((video) => (
                        <VideoCard
                            key={video.id} // Ensure IDs are unique between mocks and real
                            videoId={video.id}
                            title={video.title}
                            humanScore={video.humanScore}
                            takeaways={video.takeaways}
                            onQuizStart={() => alert(`Starting quiz for: ${video.title}`)}
                        />
                    ))}
                </div>

            </main>
        </div>
    );
}
