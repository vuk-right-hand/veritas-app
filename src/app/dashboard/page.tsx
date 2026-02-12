"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { User, DollarSign, Zap, LayoutGrid, Brain, CheckCircle2, ChevronDown } from 'lucide-react';
import VideoCard from '@/components/VideoCard';
import ProblemSolver from '@/components/ProblemSolver';
import { suggestVideo, getVerifiedVideos, getMyMission } from '@/app/actions/video-actions';

// Mock Data for V1
const MOCK_VIDEOS = [
    {
        id: "hJKe5P9y6V4",
        title: "How I Started A $100M Company (In 2024)",
        humanScore: 98,
        category: "Sales & Marketing",
        channelTitle: "Alex Hormozi",
        channelUrl: "https://www.youtube.com/@AlexHormozi",
        publishedAt: "2024-01-15T12:00:00Z",
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
        channelTitle: "Cal Newport",
        channelUrl: "https://www.youtube.com/@CalNewportMedia",
        publishedAt: "2023-11-20T14:30:00Z",
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
        channelTitle: "Andrej Karpathy",
        channelUrl: "https://www.youtube.com/@AndrejKarpathy",
        publishedAt: "2024-02-01T09:00:00Z",
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
        channelTitle: "Naval Ravikant",
        channelUrl: "https://www.youtube.com/@naval",
        publishedAt: "2023-12-10T16:45:00Z",
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
        channelTitle: "Matthew Berman",
        channelUrl: "https://www.youtube.com/@MatthewBerman",
        publishedAt: "2024-02-10T10:15:00Z",
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
        channelTitle: "Ryan Holiday",
        channelUrl: "https://www.youtube.com/@DailyStoic",
        publishedAt: "2024-01-05T08:20:00Z",
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

const RELEVANCY_OPTIONS = [
    "Last 14 days",
    "Last 28 days",
    "Last 60 days",
    "Evergreen"
];

// Convert UI filter labels to API parameter values
function getTemporalFilterValue(label: string): '14' | '28' | '60' | 'evergreen' {
    if (label === "Last 14 days") return '14';
    if (label === "Last 28 days") return '28';
    if (label === "Last 60 days") return '60';
    return 'evergreen';
}

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState('money');
    const [relevancy, setRelevancy] = useState('Evergreen');
    const [isRelevancyOpen, setIsRelevancyOpen] = useState(false);

    // Suggestion State
    const [suggestionUrl, setSuggestionUrl] = useState("");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Video Feed State
    const [videos, setVideos] = useState<any[]>(MOCK_VIDEOS);

    // Load videos with temporal filter
    const loadVideos = React.useCallback(async (filterLabel: string) => {
        // 1. Check for Active Mission (Zero Distraction Rule)
        const mission = await getMyMission();

        if (mission && mission.mission_curations && mission.mission_curations.length > 0) {
            console.log("Found Active Mission:", mission.goal);
            const curated = mission.mission_curations.map((c: any) => ({
                id: c.videos.id,
                title: c.videos.title,
                humanScore: c.videos.human_score || 99,
                category: c.videos.category_tag || 'Mission',
                channelTitle: c.videos.channel_title || 'Human Expert',
                channelUrl: c.videos.channel_url || '',
                publishedAt: c.videos.published_at || c.videos.created_at, // Fallback to created_at
                takeaways: c.videos.summary_points || [`Selected for: ${mission.goal}`, `Reason: ${c.curation_reason}`]
            }));

            // STRICT MODE: Only show curated videos (no temporal filter for missions)
            setVideos(curated);
            return;
        }

        // 2. Fallback: Generic Feed with Temporal Filter
        const temporalFilter = getTemporalFilterValue(filterLabel);
        const verified = await getVerifiedVideos(temporalFilter);
        if (verified && verified.length > 0) {
            const formattedVerified = verified.map(v => ({
                id: v.id,
                title: v.title,
                humanScore: v.human_score || 0,
                category: v.category_tag || 'Community',
                description: v.description || '', // Pass description
                channelTitle: v.channel_title || 'Community Creator',
                channelUrl: v.channel_url || '',
                publishedAt: v.published_at || v.created_at, // Fallback to created_at if published_at missing
                takeaways: v.summary_points || ["Analysis pending...", "Watch to find out."]
            }));

            const verifiedIds = new Set(formattedVerified.map(v => v.id));
            const uniqueMocks = MOCK_VIDEOS.filter(mock => !verifiedIds.has(mock.id));
            setVideos([...formattedVerified, ...uniqueMocks]);
        } else {
            setVideos(MOCK_VIDEOS); // Ensure mocks are loaded if no verified videos
        }
    }, []);

    // Load videos on mount and when filter changes
    React.useEffect(() => {
        loadVideos(relevancy);
    }, [relevancy, loadVideos]);



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
                <div className="mb-8 text-center">
                    <h1 className="text-4xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 mb-6 tracking-tight">
                        Solve Your Problem.
                    </h1>
                    <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                        Don't browse. <span className="text-red-500 font-medium">Search for the cure.</span>
                    </p>
                </div>

                {/* The Brain (Search) */}
                <ProblemSolver />

                {/* Filters - Centered below Search */}
                <div className="mt-8 mb-16 flex justify-center w-full">
                    <div className="flex items-center gap-2 text-sm text-gray-500 bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/5">
                        <span className="pl-3 pr-2 text-xs font-semibold uppercase tracking-wider opacity-60">Filter by:</span>
                        {/* Tabs */}
                        <div className="flex items-center gap-1">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 border
                                        ${activeTab === tab.id
                                            ? 'bg-red-950/30 text-red-200 border-red-900/50 shadow-[0_0_10px_rgba(220,38,38,0.2)]'
                                            : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'}
                                    `}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>


                {/* Controls Row: Spacer | Suggestion | Relevancy */}
                <div className="mb-12 grid grid-cols-1 lg:grid-cols-3 gap-6 items-end">

                    {/* Left: Spacer (Empty for balance) */}
                    <div className="hidden lg:block"></div>

                    {/* Center: Suggestion Bar - Demands Attention */}
                    <div className="w-full max-w-lg mx-auto flex flex-col items-center">
                        <span className="text-[10px] text-red-500 uppercase tracking-widest mb-2 font-bold animate-pulse">Let's promote the good ones</span>
                        <div className="w-full relative group">
                            {/* Pulsating Glow Background */}
                            <div className="absolute inset-0 bg-red-600/30 rounded-full blur-xl animate-pulse" />

                            <input
                                type="text"
                                suppressHydrationWarning
                                value={suggestionStatus === 'success' ? "Success! Thank you!" : suggestionUrl}
                                onChange={(e) => {
                                    if (suggestionStatus !== 'success') setSuggestionUrl(e.target.value);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSuggest()}
                                placeholder="Paste your favorite video/creator..."
                                disabled={suggestionStatus === 'success'}
                                className={`w-full border-2 rounded-full py-3 px-6 text-sm focus:outline-none transition-all relative z-10 shadow-[0_0_20px_rgba(220,38,38,0.4)] ${suggestionStatus === 'success'
                                    ? 'bg-green-900/20 border-green-500/50 text-green-400 font-bold text-center tracking-wide'
                                    : 'bg-[#1a1a1a] border-red-600/60 text-white placeholder:text-red-300/50 focus:border-red-500 focus:bg-[#202020] animate-pulse focus:animate-none'
                                    }`}
                            />
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
                                <button
                                    onClick={handleSuggest}
                                    disabled={isSuggesting || suggestionStatus === 'success'}
                                    className={`p-1.5 rounded-full transition-all duration-500 ease-out disabled:opacity-100 ${suggestionStatus === 'success'
                                        ? 'bg-green-500 text-white transform scale-125 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
                                        : 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_10px_rgba(220,38,38,0.8)]'
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

                    {/* Right: Relevancy Dropdown */}
                    <div className="flex justify-center lg:justify-end">
                        <div className="relative">
                            <button
                                onClick={() => setIsRelevancyOpen(!isRelevancyOpen)}
                                className="flex items-center gap-2 px-4 py-2 bg-[#1a1a1a] border border-white/10 rounded-lg text-xs font-medium text-gray-400 hover:text-white hover:border-white/20 transition-all min-w-[140px] justify-between"
                            >
                                <span className="opacity-50">Filter:</span>
                                <span className="text-gray-200">{relevancy}</span>
                                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${isRelevancyOpen ? 'rotate-180' : ''}`} />
                            </button>

                            <AnimatePresence>
                                {isRelevancyOpen && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 10 }}
                                        className="absolute right-0 top-full mt-2 w-48 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 p-1"
                                    >
                                        {RELEVANCY_OPTIONS.map((option) => (
                                            <button
                                                key={option}
                                                onClick={() => {
                                                    setRelevancy(option);
                                                    setIsRelevancyOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 text-xs rounded-lg transition-colors ${relevancy === option
                                                    ? 'bg-red-900/20 text-red-200'
                                                    : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                                    }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
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
                            channelTitle={video.channelTitle}
                            channelUrl={video.channelUrl}
                            description={video.description}
                            publishedAt={video.publishedAt}
                            onQuizStart={() => alert(`Starting quiz for: ${video.title}`)}
                        />
                    ))}
                </div>

            </main>
        </div>
    );
}
