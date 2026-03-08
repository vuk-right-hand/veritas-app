"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Zap, CheckCircle2, Search, Sparkles, X, ArrowRight, Clock, Calendar, Flame, Infinity as InfinityIcon, Lightbulb, Youtube } from 'lucide-react';
import VideoCard from '@/components/VideoCard';
import ProblemSolver from '@/components/ProblemSolver';
import AuthChoiceModal from '@/components/AuthChoiceModal';
import BottomNav from '@/components/BottomNav';
import InstallPrompt from '@/components/InstallPrompt';
import { suggestVideo, getInitialFeedData, getVerifiedVideosWithCreators } from '@/app/actions/video-actions';
import { getCreatorsByChannelUrls, checkIsCreator } from '@/app/actions/creator-actions';
import { getAuthenticatedUserId } from '@/app/actions/auth-actions';
import ProfileRequiredModal from '@/components/ProfileRequiredModal';
import ZeroStateModal from '@/components/ZeroStateModal';
import { useUser } from '@/components/UserContext';


// Mock Data for V1
// MOCK_VIDEOS removed


const TABS = [
    { id: 'Last 14 days', label: 'Last 14 days', icon: Zap },
    { id: 'Last 28 days', label: 'Last 28 days', icon: Clock },
    { id: 'Last 69 days', label: 'Last 69 days', icon: Flame },
    { id: 'Evergreen', label: 'Evergreen', icon: InfinityIcon },
];

// Skeleton card shown while the initial feed loads — matches VideoCard collapsed height
function VideoCardSkeleton() {
    return (
        <div className="rounded-2xl bg-white/[0.04] border border-white/[0.08] overflow-hidden">
            <div className="aspect-video bg-white/[0.08] animate-pulse" />
            <div className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-5 rounded-full bg-white/10 animate-pulse" />
                    <div className="h-3 w-20 rounded bg-white/[0.07] animate-pulse" />
                </div>
                <div className="space-y-1.5">
                    <div className="h-4 bg-white/10 rounded animate-pulse" />
                    <div className="h-4 bg-white/10 rounded animate-pulse w-4/5" />
                </div>
                <div className="space-y-2 pt-1">
                    <div className="h-3 bg-white/[0.06] rounded animate-pulse" />
                    <div className="h-3 bg-white/[0.06] rounded animate-pulse w-5/6" />
                    <div className="h-3 bg-white/[0.06] rounded animate-pulse w-3/4" />
                </div>
            </div>
        </div>
    );
}

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
    const [authModalDefaultView, setAuthModalDefaultView] = useState<'choice' | 'login'>('choice');
    const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
    const [isCreator, setIsCreator] = useState<boolean | null>(null);
    const [showProfileModal, setShowProfileModal] = useState(false);

    // Suggestion State
    const [suggestionUrl, setSuggestionUrl] = useState("");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [suggestionMessage, setSuggestionMessage] = useState("");

    // Video Feed State
    const [videos, setVideos] = useState<any[]>([]);
    const [feedVideos, setFeedVideos] = useState<any[]>([]); // preserved regular feed for zero-state
    const [currentSearchQuery, setCurrentSearchQuery] = useState<string>(''); // Track active search
    const [isZeroState, setIsZeroState] = useState(false); // true when search returned 0 results
    const [priorityRequested, setPriorityRequested] = useState(false); // disable button after submission
    const [showPostZeroMessage, setShowPostZeroMessage] = useState(false);

    // Feed loading state — true until first batch of videos is ready
    const [isLoading, setIsLoading] = useState(true);

    // Increment to force-remount ProblemSolver (clears its internal input)
    const [searchClearKey, setSearchClearKey] = useState(0);

    // Pagination State
    const [standardVideoOffset, setStandardVideoOffset] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const loadMoreRef = useRef<HTMLDivElement>(null);

    // Mobile scroll state — tracks if user scrolled past the search bar
    const [isScrolled, setIsScrolled] = useState(false);
    const [showMobileSuggest, setShowMobileSuggest] = useState(false);
    const [showMobileFilters, setShowMobileFilters] = useState(false);
    const [showMobileSearch, setShowMobileSearch] = useState(false);
    const [mobileSearchQuery, setMobileSearchQuery] = useState('');
    const [mobileSearchLoading, setMobileSearchLoading] = useState(false);
    const [mobileSuggestions, setMobileSuggestions] = useState<string[]>([]);
    const [mobileSuggestionsLoading, setMobileSuggestionsLoading] = useState(false);
    const [showMobileSuggestionList, setShowMobileSuggestionList] = useState(false);
    const mobileSearchInputRef = useRef<HTMLInputElement>(null);
    const searchSectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            const threshold = searchSectionRef.current?.offsetTop ?? 200;
            const scrolledPast = window.scrollY > threshold + 100;
            setIsScrolled(scrolledPast);
        };
        window.addEventListener('scroll', handleScroll, { passive: true });

        // Listen for the custom event to open the AuthModal (from ProfileRequiredModal)
        const handleOpenLogin = (e: Event) => {
            const customEvent = e as CustomEvent<{ view?: 'choice' | 'login' }>;
            if (customEvent.detail?.view) {
                setAuthModalDefaultView(customEvent.detail.view);
            } else {
                setAuthModalDefaultView('choice');
            }
            setShowAuthModal(true);
        };
        window.addEventListener('open-login-modal', handleOpenLogin);

        checkIsCreator().then(res => setIsCreator(res.isCreator));

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('open-login-modal', handleOpenLogin);
        };
    }, []);

    // Track video views for install prompt trigger
    const [videoViewCount, setVideoViewCount] = useState(0);

    // User Profile State — name sourced from UserContext (populated by getCurrentUserProfile)
    // Gate on isLoggedIn so stale veritas_user cookies don't show avatar/name for guests
    const { userProfile } = useUser();
    const userName = isLoggedIn ? (userProfile?.name || '') : '';
    const avatarUrl = isLoggedIn ? (userProfile?.avatar_url || '') : '';

    // Load videos with temporal filter
    const loadVideos = React.useCallback(async (filterLabel: string) => {
        // Reset pagination on new load
        setStandardVideoOffset(0);
        setHasMore(true);
        setIsLoading(true);

        const temporalFilter = getTemporalFilterValue(filterLabel);

        // 🚀 ONE server-action call (replaces 3 serial calls).
        // Internally fires mission + verified queries in parallel, then batches creator lookup.
        const [feedData, userId] = await Promise.all([
            getInitialFeedData(temporalFilter),
            getAuthenticatedUserId(),
        ]);

        setIsLoggedIn(!!userId);

        const { mission, verified, creatorMap } = feedData;

        let finalVideos: any[] = [];

        // ── CURATED PATH: user has goals/obstacles → show their personalised feed ──
        if (mission && (mission.mission_curations?.length ?? 0) > 0) {
            let curations = mission.mission_curations.filter((c: any) => c.videos?.status === 'verified');

            if (temporalFilter !== 'evergreen') {
                const cutoff = new Date();
                cutoff.setDate(cutoff.getDate() - parseInt(temporalFilter));
                curations = curations.filter((c: any) => {
                    const dateStr = c.videos?.published_at || c.videos?.created_at;
                    return dateStr && new Date(dateStr) >= cutoff;
                });
            }

            finalVideos = curations.map((c: any) => {
                const creator = creatorMap[c.videos?.channel_url] || null;
                return {
                    id: c.videos.id,
                    title: c.videos.title,
                    humanScore: c.videos.human_score || 99,
                    category: c.videos.category_tag || 'Mission',
                    channelTitle: c.videos.channel_title || 'Human Expert',
                    channelUrl: c.videos.channel_url || '',
                    publishedAt: c.videos.published_at || c.videos.created_at,
                    takeaways: c.videos.summary_points || [`Selected for: ${mission.goal}`, `Reason: ${c.curation_reason}`],
                    customDescription: c.videos.custom_description || undefined,
                    customLinks: c.videos.custom_links || undefined,
                    channelDescription: creator?.description || undefined,
                    channelLinks: creator?.links?.length > 0 ? creator.links : undefined,
                    isChannelClaimed: !!creator,
                    isCurated: true,
                    slug: c.videos.slug || null,
                    creatorSlug: creator?.slug || null,
                };
            });
        }

        // ── GENERIC PATH: zero curations for this filter → use verified pool ──────
        // KEY FIX: Only backfill if we have NO curated videos.
        // Previously mixed curated + generic which caused the "reassembly" flash.
        if (finalVideos.length === 0) {
            const formatBatch = (vids: any[]) => vids.map(v => {
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
                    takeaways: v.summary_points || ['Analysis pending...', 'Watch to find out.'],
                    channelDescription: creator?.description || undefined,
                    channelLinks: creator?.links?.length > 0 ? creator.links : undefined,
                    isChannelClaimed: !!creator,
                    isCurated: false,
                    slug: v.slug || null,
                    creatorSlug: creator?.slug || null,
                };
            });

            finalVideos = formatBatch(verified);

            const initialOffset = verified.length;
            if (verified.length < 6) {
                setHasMore(false);
                setStandardVideoOffset(initialOffset);
            } else {
                // Reserve next 6 slots then silently prefetch them
                setStandardVideoOffset(initialOffset + 6);
                getVerifiedVideosWithCreators(temporalFilter, 6, initialOffset).then((bg) => {
                    if (!bg.length) { setHasMore(false); return; }
                    setVideos(prev => {
                        const seen = new Set(prev.map((v: any) => v.id));
                        return [...prev, ...bg.filter((v: any) => !seen.has(v.id))];
                    });
                    if (bg.length < 6) {
                        setHasMore(false);
                        setStandardVideoOffset(initialOffset + bg.length);
                    }
                });
            }
        } else {
            // Curated content present — scroll pagination will pull generic pool
            setStandardVideoOffset(0);
            setHasMore(true);
        }

        setVideos(finalVideos);
        setFeedVideos(finalVideos); // snapshot for zero-state fallback
        setIsLoading(false);
    }, []);

    // Listen for feed-reset event dispatched by the BottomNav Feed tab
    useEffect(() => {
        const onResetFeed = () => {
            setCurrentSearchQuery('');
            setIsZeroState(false);
            setPriorityRequested(false);
            setShowMobileSearch(false);
            setMobileSearchQuery('');
            loadVideos(activeTab);
        };
        window.addEventListener('veritas:reset-feed', onResetFeed);
        return () => window.removeEventListener('veritas:reset-feed', onResetFeed);
    }, [activeTab, loadVideos]);

    const loadMoreVideos = React.useCallback(async () => {
        if (isLoadingMore || !hasMore || currentSearchQuery) return;

        setIsLoadingMore(true);
        try {
            const temporalFilter = getTemporalFilterValue(activeTab);
            // Single server action — fetches videos + creators in one call
            const batch = await getVerifiedVideosWithCreators(temporalFilter, 3, standardVideoOffset);

            if (batch.length > 0) {
                setVideos(prev => {
                    const seen = new Set(prev.map((v: any) => v.id));
                    return [...prev, ...batch.filter((v: any) => !seen.has(v.id))];
                });
                setStandardVideoOffset(prev => prev + batch.length);
                if (batch.length < 3) setHasMore(false);
            } else {
                setHasMore(false);
            }
        } catch (error) {
            console.error('Error loading more videos:', error);
        } finally {
            setIsLoadingMore(false);
        }
    }, [isLoadingMore, hasMore, currentSearchQuery, activeTab, standardVideoOffset]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && hasMore && !isLoadingMore && !currentSearchQuery) {
                    loadMoreVideos();
                }
            },
            { rootMargin: '500px 0px', threshold: 0 }
        );

        if (loadMoreRef.current) observer.observe(loadMoreRef.current);
        return () => observer.disconnect();
    }, [loadMoreVideos, hasMore, isLoadingMore, currentSearchQuery]);

    // Load videos on mount and when filter changes
    // If there's an active search, reapply it after loading
    React.useEffect(() => {
        const loadAndReapplySearch = async () => {
            setShowPostZeroMessage(false);
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
                            slug: r.slug || null,
                            creatorSlug: creator?.slug || null,
                        };
                    });
                    setVideos(mapped);
                }
            }
        };

        loadAndReapplySearch();
    }, [activeTab, loadVideos]);



    const handleSearchResults = async (results: any[], searchQuery: string) => {
        setCurrentSearchQuery(searchQuery);
        setPriorityRequested(false);
        setShowPostZeroMessage(false);

        // Zero-state: no matches — show priority request block + keep regular feed
        if (results.length === 0) {
            setIsZeroState(true);
            setVideos(feedVideos);
            return;
        }

        setIsZeroState(false);

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
                slug: r.slug || null,
                creatorSlug: creator?.slug || null,
            };
        });
        setVideos(mapped);
    };

    // Called by ProblemSolver's own X — full reset + reload
    const handleClearSearch = () => {
        setCurrentSearchQuery('');
        setIsZeroState(false);
        setPriorityRequested(false);
        setShowPostZeroMessage(false);
        setSearchClearKey(k => k + 1);
        loadVideos(activeTab);
    };

    // Called when zero-state modal is dismissed (X or auto-close after request)
    // Fresh reload gives the "new feed" feeling; bridge message appears once load completes
    const handleModalDismiss = () => {
        setIsZeroState(false);
        setCurrentSearchQuery('');
        setPriorityRequested(false);
        setSearchClearKey(k => k + 1);
        setShowPostZeroMessage(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            setSuggestionMessage(result.message);
            setSuggestionStatus('error');
            setTimeout(() => setSuggestionStatus('idle'), 4000);
        }

        setIsSuggesting(false);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-red-500/30 font-sans">
            <AuthChoiceModal
                isOpen={showAuthModal}
                onClose={() => setShowAuthModal(false)}
                defaultView={authModalDefaultView}
            />

            {/* Zero-state search modal — viewport-centered overlay, preserves scroll position */}
            <AnimatePresence>
                {isZeroState && currentSearchQuery && !isLoading && (
                    <ZeroStateModal
                        searchQuery={currentSearchQuery}
                        isAuthenticated={isLoggedIn === true}
                        requested={priorityRequested}
                        onClose={handleModalDismiss}
                        onRequestClick={() => setShowProfileModal(true)}
                        onRequestSuccess={() => setPriorityRequested(true)}
                    />
                )}
            </AnimatePresence>
            <InstallPrompt videoViewCount={videoViewCount} />

            {/* ========== NAVBAR ========== */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                {/* Desktop Navbar (unchanged) */}
                <div className="hidden md:flex max-w-[1600px] mx-auto px-8 h-20 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/veritas-heart.svg" alt="Veritas Logo" className="w-11 h-11 object-contain animate-heartbeat fill-red-600" />
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-xl tracking-tight">HQ</span>
                            <span className="text-[10px] font-light text-gray-400 tracking-wide">Human Quality</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        <Link href="/founder-meeting" className="flex items-center gap-2 text-xs text-gray-400 font-medium px-4 py-2 bg-white/5 rounded-full border border-white/5 hover:bg-red-900/20 hover:text-red-300 hover:border-red-500/20 transition-all group">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                            Meeting with the founder...
                        </Link>

                        {/* Creator Dashboard Link */}
                        <div>
                            {isCreator === true ? (
                                <Link
                                    href="/creator-dashboard"
                                    className="flex items-center gap-2 text-xs font-semibold text-red-400 hover:text-red-300 transition-colors px-4 py-2 hover:bg-red-500/10 rounded-lg border border-red-500/20"
                                >
                                    <Youtube className="w-4 h-4" />
                                    Creator
                                </Link>
                            ) : (
                                <button
                                    onClick={() => setShowAuthModal(true)}
                                    className="text-xs font-semibold text-gray-400 hover:text-white transition-colors px-4 py-2 hover:bg-white/5 rounded-lg"
                                >
                                    Claim Channel / Dashboard
                                </button>
                            )}
                        </div>

                        {/* Profile / Stats Area */}
                        <div className="flex items-center gap-4 pl-6 border-l border-white/10">
                            <div className="flex flex-col items-end mr-2">
                                <span className="text-sm font-semibold text-white">{userName || 'The Builder'}</span>
                                {isLoggedIn === false ? (
                                    <button
                                        onClick={() => setShowProfileModal(true)}
                                        className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                                        Update Goals
                                    </button>
                                ) : (
                                    <Link href="/profile" className="text-[10px] text-red-400 hover:text-red-300 transition-colors flex items-center gap-1">
                                        Update Goals
                                    </Link>
                                )}
                            </div>
                            {isLoggedIn === false ? (
                                <button
                                    onClick={() => setShowProfileModal(true)}
                                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors group overflow-hidden">
                                    <User className="w-5 h-5 text-gray-400 group-hover:text-white" />
                                </button>
                            ) : (
                                <Link
                                    href="/profile"
                                    className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-colors group overflow-hidden">
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={userName} className="w-full h-full object-cover" loading="lazy" />
                                    ) : (
                                        <User className="w-5 h-5 text-gray-400 group-hover:text-white" />
                                    )}
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile Navbar */}
                <div className="flex md:hidden items-center justify-between px-4 h-14">
                    {/* Left: Logo + HQ / Human Quality */}
                    <div className="flex items-center gap-2">
                        <img src="/veritas-heart.svg" alt="Veritas" className="w-8 h-8 object-contain animate-heartbeat" />
                        <div className="flex items-baseline gap-1.5">
                            <span className="font-bold text-lg tracking-tight">HQ</span>
                            <span className="text-[10px] font-light text-gray-400 tracking-wide">Human Quality</span>
                        </div>
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

                    {/* Right: Founder Meeting pill (pre-scroll) + Compact icons (when scrolled) */}
                    <div className="flex items-center gap-2">
                        <AnimatePresence>
                            {!isScrolled && (
                                <motion.div
                                    key="founder-meeting-btn"
                                    initial={{ opacity: 0, scale: 0.85 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.85 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <button
                                        onClick={() => {
                                            if (!isLoggedIn) {
                                                setShowProfileModal(true);
                                            } else {
                                                window.location.href = '/founder-meeting';
                                            }
                                        }}
                                        className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 bg-red-600/15 border border-red-500/30 rounded-full text-red-300 shadow-[0_0_12px_rgba(220,38,38,0.25)] active:scale-95 transition-transform"
                                    >
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                        Meeting
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                        <AnimatePresence>
                            {isScrolled && (
                                <>
                                    <motion.button
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        onClick={() => {
                                            setShowMobileFilters(false);
                                            if (showMobileSearch) {
                                                // Blur FIRST so keyboard goes down cleanly before unmount
                                                mobileSearchInputRef.current?.blur();
                                                setShowMobileSuggestionList(false);
                                                setTimeout(() => setShowMobileSearch(false), 50);
                                            } else {
                                                setShowMobileSearch(true);
                                                setTimeout(() => mobileSearchInputRef.current?.focus(), 150);
                                            }
                                        }}
                                        className={`w-9 h-9 rounded-full border flex items-center justify-center active:bg-white/10 transition-colors ${showMobileSearch
                                            ? 'bg-red-950/40 border-red-900/50'
                                            : 'bg-white/5 border-white/10'
                                            }`}
                                    >
                                        <Search className={`w-4 h-4 ${showMobileSearch ? 'text-red-400' : 'text-gray-400'}`} />
                                    </motion.button>
                                    <motion.button
                                        initial={{ opacity: 0, x: 10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 10 }}
                                        transition={{ delay: 0.05 }}
                                        onClick={() => {
                                            setShowMobileSearch(false);
                                            setShowMobileFilters(!showMobileFilters);
                                        }}
                                        className={`w-9 h-9 rounded-full border flex items-center justify-center active:bg-white/10 transition-colors ${showMobileFilters
                                            ? 'bg-red-950/40 border-red-900/50'
                                            : 'bg-white/5 border-white/10'
                                            }`}
                                    >
                                        <Clock className={`w-4 h-4 ${showMobileFilters ? 'text-red-400' : 'text-gray-400'}`} />
                                    </motion.button>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Mobile Search Dropdown (when magnifying glass tapped) */}
                <AnimatePresence>
                    {showMobileSearch && isScrolled && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="md:hidden overflow-hidden border-t border-white/5 bg-black/90"
                        >
                            <div className="px-4 py-3">
                                <form
                                    className="flex items-center gap-2"
                                    onSubmit={async (e) => {
                                        e.preventDefault();
                                        if (!mobileSearchQuery.trim()) return;
                                        setMobileSearchLoading(true);
                                        setShowMobileSuggestionList(false);
                                        try {
                                            const temporalFilter = getTemporalFilterValue(activeTab);
                                            const res = await fetch('/api/search', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ query: mobileSearchQuery, temporalFilter }),
                                            });
                                            const data = await res.json();
                                            if (data.success) {
                                                await handleSearchResults(data.matches || [], mobileSearchQuery);
                                            }
                                        } catch (err) {
                                            console.error('Mobile search failed', err);
                                        } finally {
                                            setMobileSearchLoading(false);
                                            mobileSearchInputRef.current?.blur();
                                            setTimeout(() => setShowMobileSearch(false), 50);
                                        }
                                    }}
                                >
                                    {/* Pulsating Lightbulb Button */}
                                    <button
                                        type="button"
                                        className="flex-shrink-0"
                                        title="Get suggestions"
                                        onClick={async () => {
                                            if (showMobileSuggestionList) {
                                                setShowMobileSuggestionList(false);
                                                return;
                                            }
                                            if (mobileSuggestions.length === 0) {
                                                setMobileSuggestionsLoading(true);
                                                try {
                                                    const res = await fetch('/api/search/suggest', { method: 'POST' });
                                                    const data = await res.json();
                                                    if (data.success) setMobileSuggestions(data.suggestions || []);
                                                } catch { }
                                                setMobileSuggestionsLoading(false);
                                            }
                                            setShowMobileSuggestionList(true);
                                        }}
                                    >
                                        {mobileSuggestionsLoading ? (
                                            <Sparkles className="w-5 h-5 animate-spin text-yellow-400" />
                                        ) : (
                                            <motion.div
                                                animate={{
                                                    scale: [1, 1.2, 1],
                                                    filter: [
                                                        'drop-shadow(0 0 0px rgba(250,204,21,0))',
                                                        'drop-shadow(0 0 6px rgba(250,204,21,0.9))',
                                                        'drop-shadow(0 0 0px rgba(250,204,21,0))',
                                                    ],
                                                }}
                                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                            >
                                                <Lightbulb className={`w-5 h-5 transition-colors ${showMobileSuggestionList ? 'text-yellow-400' : 'text-gray-500'}`} />
                                            </motion.div>
                                        )}
                                    </button>

                                    <div className="flex-1 relative">
                                        <input
                                            ref={mobileSearchInputRef}
                                            type="search"
                                            enterKeyHint="search"
                                            value={mobileSearchQuery}
                                            onChange={(e) => { setMobileSearchQuery(e.target.value); setShowMobileSuggestionList(false); }}
                                            placeholder="Describe your struggle..."
                                            className="w-full bg-white/5 border border-white/10 rounded-full px-4 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30 caret-red-500"
                                            autoComplete="off"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={mobileSearchLoading || !mobileSearchQuery.trim()}
                                        className="px-4 py-2 bg-red-700 hover:bg-red-600 disabled:opacity-40 text-white text-xs font-semibold rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap"
                                    >
                                        {mobileSearchLoading ? (
                                            <span className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                                        ) : (
                                            <ArrowRight className="w-3.5 h-3.5" />
                                        )}
                                        Solve
                                    </button>
                                </form>

                                {/* Mobile Suggestions List */}
                                <AnimatePresence>
                                    {showMobileSuggestionList && mobileSuggestions.length > 0 && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            transition={{ duration: 0.15 }}
                                            className="mt-2 overflow-hidden"
                                        >
                                            <div className="flex items-center gap-1.5 mb-1 px-1">
                                                <Lightbulb className="w-3 h-3 text-yellow-400" />
                                                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">Suggested for you</span>
                                            </div>
                                            {mobileSuggestions.map((s, i) => (
                                                <button
                                                    key={i}
                                                    type="button"
                                                    onClick={async () => {
                                                        setMobileSearchQuery(s);
                                                        setShowMobileSuggestionList(false);
                                                        setMobileSearchLoading(true);
                                                        try {
                                                            const temporalFilter = getTemporalFilterValue(activeTab);
                                                            const res = await fetch('/api/search', {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ query: s, temporalFilter }),
                                                            });
                                                            const data = await res.json();
                                                            if (data.success) await handleSearchResults(data.matches || [], s);
                                                        } catch { }
                                                        setMobileSearchLoading(false);
                                                        mobileSearchInputRef.current?.blur();
                                                        setTimeout(() => setShowMobileSearch(false), 50);
                                                    }}
                                                    className="w-full text-left flex items-center gap-2 px-2 py-2.5 text-sm text-gray-300 active:bg-white/5 rounded-lg"
                                                >
                                                    <ArrowRight className="w-3 h-3 text-red-500/60 flex-shrink-0" />
                                                    {s}
                                                </button>
                                            ))}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

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
            </nav >

            {/* Mobile Suggest Full-Screen Overlay */}
            <AnimatePresence>
                {
                    showMobileSuggest && (
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
                                <AnimatePresence>
                                    {suggestionStatus === 'success' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: -64, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute left-0 right-0 flex justify-center z-50 pointer-events-auto"
                                            onClick={() => setSuggestionStatus('idle')}
                                        >
                                            <div className="bg-[#1a1a1a] border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)] rounded-2xl px-5 py-3 text-center cursor-pointer max-w-[280px]">
                                                <p className="text-[15px] font-bold text-white mb-0.5">Thank you!🙏</p>
                                                <p className="text-xs text-green-100/80">We'll email you when your video is reviewed.</p>
                                            </div>
                                        </motion.div>
                                    )}
                                    {suggestionStatus === 'error' && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: -64, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            className="absolute left-0 right-0 flex justify-center z-50 pointer-events-auto"
                                            onClick={() => setSuggestionStatus('idle')}
                                        >
                                            <div className="bg-[#1a1a1a] border border-red-500/60 shadow-[0_0_30px_rgba(220,38,38,0.4)] rounded-2xl px-5 py-3 text-center cursor-pointer max-w-[280px]">
                                                <p className="text-xs text-red-300">{suggestionMessage}</p>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div className="absolute inset-0 bg-red-600/20 rounded-full blur-xl" />
                                <input
                                    type="text"
                                    value={suggestionUrl}
                                    onChange={(e) => { if (suggestionStatus !== 'success') setSuggestionUrl(e.target.value); }}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSuggest()}
                                    placeholder={suggestionStatus === 'success' ? '' : 'Paste video or channel link...'}
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
                    )
                }
            </AnimatePresence >

            {/* Main Content */}
            < main className="pt-20 md:pt-32 pb-24 md:pb-20 px-4 md:px-8 max-w-[1600px] mx-auto pb-safe" >

                {/* Header Section */}
                < div ref={searchSectionRef} className="mb-6 md:mb-8 text-center" >
                    <h1 className="text-3xl md:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50 mb-4 md:mb-6 tracking-tight">
                        Solve Your Problem.
                    </h1>
                    <p className="text-base md:text-xl text-gray-400 max-w-2xl mx-auto">
                        Don't browse. <span className="text-red-500 font-medium">Search for the cure.</span>
                    </p>
                </div >

                {/* The Brain (Search) */}
                < ProblemSolver key={searchClearKey} onSearchResults={handleSearchResults} onClear={handleClearSearch} activeFilter={activeTab} />

                {/* Filters - Centered below Search */}
                < div className="mt-6 md:mt-8 mb-10 md:mb-16 flex justify-center w-full" >
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
                </div >


                {/* Controls Row: Spacer | Suggestion | Relevancy — DESKTOP ONLY */}
                < div className="hidden md:grid mb-12 grid-cols-1 lg:grid-cols-3 gap-6 items-end" >

                    {/* Left: Spacer (Empty for balance) */}
                    < div className="hidden lg:block" ></div >

                    {/* Center: Suggestion Bar - Demands Attention */}
                    < div className="w-full max-w-lg mx-auto flex flex-col items-center" >
                        <span className="text-[10px] text-red-500 uppercase tracking-widest mb-2 font-bold animate-pulse">Let's promote the good ones</span>
                        <div className="w-full relative group">
                            <AnimatePresence>
                                {suggestionStatus === 'success' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: -72, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute left-0 right-0 flex justify-center z-50 pointer-events-auto"
                                        onClick={() => setSuggestionStatus('idle')}
                                    >
                                        <div className="bg-[#1a1a1a] border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)] rounded-2xl px-6 py-3.5 text-center cursor-pointer">
                                            <p className="text-[15px] font-bold text-white mb-0.5">Thank you!🙏</p>
                                            <p className="text-sm text-green-100/80">We'll email you when your video is reviewed.</p>
                                        </div>
                                    </motion.div>
                                )}
                                {suggestionStatus === 'error' && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: -72, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        className="absolute left-0 right-0 flex justify-center z-50 pointer-events-auto"
                                        onClick={() => setSuggestionStatus('idle')}
                                    >
                                        <div className="bg-[#1a1a1a] border border-red-500/60 shadow-[0_0_30px_rgba(220,38,38,0.4)] rounded-2xl px-6 py-3.5 text-center cursor-pointer">
                                            <p className="text-sm text-red-300">{suggestionMessage}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            {/* Pulsating Glow Background */}
                            <div className="absolute inset-0 bg-red-600/30 rounded-full blur-xl animate-pulse" />

                            <input
                                type="text"
                                suppressHydrationWarning
                                value={suggestionUrl}
                                onChange={(e) => {
                                    if (suggestionStatus !== 'success') setSuggestionUrl(e.target.value);
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && handleSuggest()}
                                placeholder={suggestionStatus === 'success' ? '' : 'Paste your favorite video/creator...'}
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
                    </div >

                    {/* Right: Spacer (Dropdown Removed) */}
                    < div className="hidden lg:block" ></div >
                </div >

                {/* Mobile Suggest Button (inline, non-scrolled state) */}
                <div className="md:hidden mb-12 flex flex-col items-center">
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setShowMobileSuggest(true)}
                        className="px-6 py-2.5 bg-red-600/20 border border-red-500/40 rounded-full text-sm font-bold text-red-300 shadow-[0_0_15px_rgba(220,38,38,0.3)] flex items-center gap-2"
                    >
                        <Zap className="w-4 h-4" />
                        Suggest
                    </motion.button>
                    <span className="text-[10px] text-red-500 uppercase tracking-widest mt-4 font-bold animate-pulse text-center px-4">
                        Promote your favorite creator or video
                    </span>
                </div>


                {/* Bridge message after zero-state modal dismissal */}
                <AnimatePresence>
                    {showPostZeroMessage && !isLoading && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="flex items-center gap-4 mb-10"
                        >
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                            <span className="text-xs font-light text-gray-600 tracking-wide text-center max-w-[260px] leading-relaxed">
                                While we hunt for it, here are the latest videos matching your goals &amp; obstacles
                            </span>
                            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Video Grid - 3 Columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
                    {isLoading ? (
                        // Show 3 skeleton cards above the fold while data loads
                        Array.from({ length: 3 }).map((_, i) => <VideoCardSkeleton key={i} />)
                    ) : (
                        videos.map((video, index) => (
                            <motion.div
                                key={video.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    // First 3 cards cascade in instantly; cards 4-6 follow quickly;
                                    // any subsequent scroll-loaded cards just fade in with no delay.
                                    delay: index < 6 ? index * 0.05 : 0,
                                    duration: 0.2,
                                    ease: 'easeOut',
                                }}
                            >
                                <VideoCard
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
                                    slug={video.slug}
                                    creatorSlug={video.creatorSlug}
                                    onQuizStart={() => { }}
                                    onVideoView={() => setVideoViewCount(c => c + 1)}
                                />
                            </motion.div>
                        ))
                    )}
                </div>

                {/* Infinite Scroll Loader */}
                {!currentSearchQuery && hasMore && (
                    <div ref={loadMoreRef} className="w-full flex justify-center py-12 mt-8">
                        {isLoadingMore && (
                            <div className="flex flex-col items-center gap-3">
                                <span className="w-8 h-8 rounded-full border-2 border-red-500/30 border-t-red-500 animate-spin block shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                                <span className="text-[10px] text-red-500 uppercase tracking-widest font-bold animate-pulse">Loading more</span>
                            </div>
                        )}
                    </div>
                )}

            </main >

            {/* Mobile Bottom Navigation */}
            <ProfileRequiredModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
            />
            < BottomNav />
        </div >
    );
}
