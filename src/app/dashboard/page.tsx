"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Zap, CheckCircle2, Search, Sparkles, X, ArrowRight, Clock, Calendar, Flame, Infinity } from 'lucide-react';
import VideoCard from '@/components/VideoCard';
import ProblemSolver from '@/components/ProblemSolver';
import AuthChoiceModal from '@/components/AuthChoiceModal';
import BottomNav from '@/components/BottomNav';
import InstallPrompt from '@/components/InstallPrompt';
import { suggestVideo, getVerifiedVideos, getMyMission } from '@/app/actions/video-actions';
import { getCreatorsByChannelUrls } from '@/app/actions/creator-actions';


// Mock Data for V1
// MOCK_VIDEOS removed


const TABS = [
    { id: 'Last 14 days', label: 'Last 14 days', icon: Zap },
    { id: 'Last 28 days', label: 'Last 28 days', icon: Clock },
    { id: 'Last 69 days', label: 'Last 69 days', icon: Flame },
    { id: 'Evergreen', label: 'Evergreen', icon: Infinity },
];

// Convert UI filter labels to API parameter values
function getTemporalFilterValue(label: string): '14' | '28' | '60' | 'evergreen' {
    if (label === "Last 14 days") return '14';
    if (label === "Last 28 days") return '28';
    if (label === "Last 69 days") return '60'; // Handled as 60 for now
    return 'evergreen';
}

export default function Dashboard() {
    const [activeTab, setActiveTab] = useState('Evergreen');
    const [showAuthModal, setShowAuthModal] = useState(false);

    // Suggestion State
    const [suggestionUrl, setSuggestionUrl] = useState("");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Video Feed State
    const [videos, setVideos] = useState<any[]>([]);
    const [currentSearchQuery, setCurrentSearchQuery] = useState<string>(''); // Track active search

    // Mobile scroll state — tracks if user scrolled past the search bar
    const [isScrolled, setIsScrolled] = useState(false);
    const [showMobileSuggest, setShowMobileSuggest] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const searchSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            const threshold = searchSectionRef.current?.offsetTop ?? 200;
            const scrolledPast = window.scrollY > threshold + 100;
            setIsScrolled(scrolledPast);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Track video views for install prompt trigger
    const [videoViewCount, setVideoViewCount] = useState(0);

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
            // Fetch channel-level data (descriptions + links) from creators table
            const channelUrls = verified.map(v => v.channel_url).filter(Boolean);
            const creatorMap = await getCreatorsByChannelUrls(channelUrls);

            const formattedVerified = verified.map(v => {
                const creator = creatorMap[v.channel_url] || null;
                return {
                    id: v.id,
                    title: v.title,
                    humanScore: v.human_score || 0,
                    category: v.category_tag || 'Community',
                    customDescription: v.custom_description || undefined,
                    customLinks: v.custom_links || undefined,
                    channelTitle: v.channel_title || 'Community Creator',
                    channelUrl: v.channel_url || '',
                    publishedAt: v.published_at || v.created_at,
                    takeaways: v.summary_points || ["Analysis pending...", "Watch to find out."],
                    // Channel-level data from creators table
                    channelDescription: creator?.description || undefined,
                    channelLinks: creator?.links?.length > 0 ? creator.links : undefined,
                    isChannelClaimed: !!creator,
                };
            });

            setVideos(formattedVerified);
        } else {
            setVideos([]);
        }
    }, []);

    // Load videos on mount and when filter changes
    // If there's an active search, reapply it after loading
    React.useEffect(() => {
        const loadAndReapplySearch = async () => {
            await loadVideos(activeTab);

            // If there's an active search query, reapply it
            if (currentSearchQuery) {
                // Trigger a new search with the current filter
                const temporalFilter = getTemporalFilterValue(activeTab);
                const response = await fetch('/api/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query: currentSearchQuery, temporalFilter })
                });

                if (response.ok) {
                    const data = await response.json();
                    // Handle API response structure: { success: true, matches: [...] }
                    const results = data.matches || data || [];
                    // Fetch channel data for search results
                    const searchChannelUrls = results.map((r: any) => r.channel_url).filter(Boolean);
                    const searchCreatorMap = await getCreatorsByChannelUrls(searchChannelUrls);
                    const mapped = results.map((r: any) => {
                        const creator = searchCreatorMap[r.channel_url] || null;
                        return {
                            id: r.id,
                            title: r.title,
                            humanScore: r.human_score,
                            takeaways: r.summary_points || [],
                            channelTitle: r.channel_title,
                            channelUrl: r.channel_url,
                            publishedAt: r.published_at,
                            customDescription: r.custom_description,
                            customLinks: r.custom_links,
                            channelDescription: creator?.description || undefined,
                            channelLinks: creator?.links?.length > 0 ? creator.links : undefined,
                            isChannelClaimed: !!creator,
                        };
                    });
                    setVideos(mapped);
                }
            }
        };

        loadAndReapplySearch();
    }, [activeTab, loadVideos]);



    const handleSearchResults = async (results: any[], searchQuery: string) => {
        // Track the search query
        setCurrentSearchQuery(searchQuery);

        // Map API search results to VideoCard props
        // Fetch channel data for search results
        const searchChannelUrls = results.map(r => r.channel_url).filter(Boolean);
        const searchCreatorMap = await getCreatorsByChannelUrls(searchChannelUrls);
        const mapped = results.map(r => {
            const creator = searchCreatorMap[r.channel_url] || null;
            return {
                id: r.id,
                title: r.title,
                humanScore: r.human_score,
                takeaways: r.summary_points || [],
                channelTitle: r.channel_title,
                channelUrl: r.channel_url,
                publishedAt: r.published_at,
                customDescription: r.custom_description,
                customLinks: r.custom_links,
                channelDescription: creator?.description || undefined,
                channelLinks: creator?.links?.length > 0 ? creator.links : undefined,
                isChannelClaimed: !!creator,
            };
        });
        setVideos(mapped);
    };

    const handleClearSearch = () => {
        // Clear search query
        setCurrentSearchQuery('');
        // Reset to current feed based on active tab/filter
        loadVideos(activeTab);
    };

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
            <AuthChoiceModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            <InstallPrompt videoViewCount={videoViewCount} />

            {/* ========== NAVBAR ========== */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                {/* Desktop Navbar (unchanged) */}
                <div className="hidden md:flex max-w-[1600px] mx-auto px-8 h-20 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/veritas-heart.svg" alt="Veritas Logo" className="w-11 h-11 object-contain animate-heartbeat fill-red-600" />
                        <span className="font-bold text-xl tracking-tight">Veritas</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <Link href="/founder-meeting" className="flex items-center gap-2 text-xs text-gray-400 font-medium px-4 py-2 bg-white/5 rounded-full border border-white/5 hover:bg-red-900/20 hover:text-red-300 hover:border-red-500/20 transition-all group">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Meeting with the founder...
                        </Link>

                        {/* Creator Dashboard Link */}
                        <div>
                            <button
                                onClick={() => setShowAuthModal(true)}
                                className="text-xs font-semibold text-gray-400 hover:text-white transition-colors px-4 py-2 hover:bg-white/5 rounded-lg"
                            >
                                Claim Channel / Dashboard
                            </button>
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

                {/* Mobile Navbar */}
                <div className="flex md:hidden items-center justify-between px-4 h-14">
                    {/* Left: Logo + Name */}
                    <div className="flex items-center gap-2">
                        <img src="/veritas-heart.svg" alt="Veritas" className="w-8 h-8 object-contain animate-heartbeat" />
                        <span className="font-bold text-lg tracking-tight">Veritas</span>
                    </div>

                    {/* Center: Glowing Suggest Bar (visible when scrolled) */}
                    <AnimatePresence>
                        {isScrolled && (
                            <motion.button
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                onClick={() => setShowMobileSuggest(true)}
                                className="absolute left-1/2 -translate-x-1/2 px-5 py-1.5 bg-red-600/20 border border-red-500/40 rounded-full text-[11px] font-bold text-red-300 shadow-[0_0_15px_rgba(220,38,38,0.3)] active:scale-95 transition-transform"
                            >
                                <Zap className="w-3 h-3 inline mr-1" />
                                Suggest
                            </motion.button>
                        )}
                    </AnimatePresence>

                    {/* Right: Compact icons (visible when scrolled) */}
                    <div className="flex items-center gap-2">
                        <AnimatePresence>
                            {isScrolled && (
                                <>
                                    <motion.button
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                                        className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:bg-white/10"
                                    >
                                        <Search className="w-4 h-4 text-gray-400" />
                                    </motion.button>
                                    <motion.button
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ delay: 0.05 }}
                                        onClick={() => setShowMobileFilters(!showMobileFilters)}
                                        className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center active:bg-white/10"
                                    >
                                        <Clock className="w-4 h-4 text-gray-400" />
                                    </motion.button>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Mobile Filters Dropdown (when clock icon tapped) */}
                <AnimatePresence>
                    {showMobileFilters && isScrolled && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="md:hidden overflow-hidden border-t border-white/5 bg-black/90"
                        >
                            <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto no-scrollbar">
                                {TABS.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => { setActiveTab(tab.id); setShowMobileFilters(false); }}
                                        className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-1.5 ${activeTab === tab.id
                                            ? 'bg-red-950/30 text-red-200 border-red-900/50'
                                            : 'bg-transparent text-gray-500 border-transparent active:bg-white/5'}`}
                                    >
                                        <tab.icon className={`w-3 h-3 ${activeTab === tab.id ? 'text-red-400' : 'opacity-70'}`} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </nav>

            {/* Mobile Suggest Full-Screen Overlay */}
            <AnimatePresence>
                {showMobileSuggest && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center px-6 md:hidden"
                    >
                        <button
                            onClick={() => setShowMobileSuggest(false)}
                            className="absolute top-4 right-4 p-2 rounded-full bg-white/5 text-gray-400 active:bg-white/10"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <Zap className="w-12 h-12 text-red-500 mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2 text-center">Suggest a Creator</h2>
                        <p className="text-sm text-gray-400 mb-8 text-center max-w-xs">
                            Give us your favorite human creator/video so we can promote them.
                        </p>

                        <div className="w-full max-w-sm relative">
                            <div className="absolute inset-0 bg-red-600/20 rounded-full blur-xl" />
                            <input
                                type="text"
                                value={suggestionStatus === 'success' ? 'Thank you! ❤️' : suggestionUrl}
                                onChange={(e) => { if (suggestionStatus !== 'success') setSuggestionUrl(e.target.value); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSuggest()}
                                placeholder="Paste video or channel link..."
                                disabled={suggestionStatus === 'success'}
                                className={`w-full border-2 rounded-full py-4 px-6 text-sm focus:outline-none relative z-10 ${suggestionStatus === 'success'
                                    ? 'bg-green-900/20 border-green-500/50 text-green-400 font-bold text-center'
                                    : 'bg-[#1a1a1a] border-red-600/60 text-white placeholder:text-red-300/50 focus:border-red-500'}`}
                                autoFocus
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20">
                                <button
                                    onClick={() => { handleSuggest(); }}
                                    disabled={isSuggesting || suggestionStatus === 'success'}
                                    className={`p-2 rounded-full transition-all ${suggestionStatus === 'success'
                                        ? 'bg-green-500 text-white'
                                        : 'bg-red-600 text-white active:bg-red-500'}`}
                                >
                                    {isSuggesting ? (
                                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                                    ) : suggestionStatus === 'success' ? (
                                        <CheckCircle2 className="w-4 h-4" />
                                    ) : (
                                        <Zap className="w-4 h-4 fill-current" />
                                    )}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Main Content */}
            <main className="pt-20 md:pt-32 pb-24 md:pb-20 px-4 md:px-8 max-w-[1600px] mx-auto pb-safe">

                {/* Header Section */}
                <div ref={searchSectionRef} className="mb-6 md:mb-8 text-center">
                    <h1 className="text-3xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 mb-4 md:mb-6 tracking-tight">
                        Solve Your Problem.
                    </h1>
                    <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto">
                        Don't browse. <span className="text-red-500 font-medium">Search for the cure.</span>
                    </p>
                </div>

                {/* The Brain (Search) */}
                <ProblemSolver onSearchResults={handleSearchResults} onClear={handleClearSearch} activeFilter={activeTab} />

                {/* Filters - Centered below Search */}
                <div className="mt-6 md:mt-8 mb-10 md:mb-16 flex justify-center w-full">
                    <div className="flex items-center gap-1 md:gap-2 text-sm text-gray-500 bg-black/40 backdrop-blur-md p-1.5 rounded-full border border-white/5 overflow-x-auto no-scrollbar max-w-full">
                        <span className="hidden md:inline pl-3 pr-2 text-xs font-semibold uppercase tracking-wider opacity-60">Filter by:</span>
                        {/* Tabs */}
                        <div className="flex items-center gap-1">
                            {TABS.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`
                                        whitespace-nowrap pl-2.5 md:pl-3 pr-3 md:pr-4 py-1.5 rounded-full text-[11px] md:text-xs font-medium transition-all duration-300 border flex items-center gap-1.5 md:gap-2
                                        ${activeTab === tab.id
                                            ? 'bg-red-950/30 text-red-200 border-red-900/50 shadow-[0_0_10px_rgba(220,38,38,0.2)]'
                                            : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/5'}
                                    `}
                                >
                                    <tab.icon className={`w-3 h-3 ${activeTab === tab.id ? 'text-red-400' : 'opacity-70'}`} />
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>


                {/* Controls Row: Spacer | Suggestion | Relevancy — DESKTOP ONLY */}
                <div className="hidden md:grid mb-12 grid-cols-1 lg:grid-cols-3 gap-6 items-end">

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

                    {/* Right: Spacer (Dropdown Removed) */}
                    <div className="hidden lg:block"></div>
                </div>

                {/* Mobile Suggest Bar (inline, non-scrolled state) — shows nicely below filters */}
                <div className="md:hidden mb-8">
                    <div className="w-full relative">
                        <div className="absolute inset-0 bg-red-600/20 rounded-full blur-lg" />
                        <input
                            type="text"
                            suppressHydrationWarning
                            value={suggestionStatus === 'success' ? 'Thank you! ❤️' : suggestionUrl}
                            onChange={(e) => { if (suggestionStatus !== 'success') setSuggestionUrl(e.target.value); }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSuggest()}
                            placeholder="Suggest a creator/video..."
                            disabled={suggestionStatus === 'success'}
                            className={`w-full border rounded-full py-3 px-5 text-sm focus:outline-none relative z-10 ${suggestionStatus === 'success'
                                ? 'bg-green-900/20 border-green-500/50 text-green-400 font-bold text-center'
                                : 'bg-[#1a1a1a] border-red-600/40 text-white placeholder:text-red-300/40 focus:border-red-500'}`}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
                            <button
                                onClick={handleSuggest}
                                disabled={isSuggesting || suggestionStatus === 'success'}
                                className={`p-2 rounded-full transition-all ${suggestionStatus === 'success' ? 'bg-green-500 text-white' : 'bg-red-600 text-white active:bg-red-500'}`}
                            >
                                {isSuggesting ? (
                                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                                ) : suggestionStatus === 'success' ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <Zap className="w-4 h-4 fill-current" />
                                )}
                            </button>
                        </div>
                    </div>
                </div>


                {/* Video Grid - 3 Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                    {videos.map((video) => (
                        <VideoCard
                            key={video.id}
                            videoId={video.id}
                            title={video.title}
                            humanScore={video.humanScore}
                            takeaways={video.takeaways}
                            channelTitle={video.channelTitle}
                            channelUrl={video.channelUrl}
                            customDescription={video.customDescription}
                            customLinks={video.customLinks}
                            channelDescription={video.channelDescription}
                            channelLinks={video.channelLinks}
                            isChannelClaimed={video.isChannelClaimed}
                            publishedAt={video.publishedAt}
                            onQuizStart={() => alert(`Starting quiz for: ${video.title}`)}
                            onVideoView={() => setVideoViewCount(c => c + 1)}
                        />
                    ))}
                </div>

            </main>

            {/* Mobile Bottom Navigation */}
            <BottomNav />
        </div>
    );
}
