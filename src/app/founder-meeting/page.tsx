"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageSquare, Send, Sparkles, Calendar, Lightbulb, Loader2, ChevronDown, ChevronLeft, ChevronRight, X, Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import SmartVideoPlayer, { SmartVideoPlayerRef } from '@/components/SmartVideoPlayer';
import FeatureRequestModal from '@/components/FeatureRequestModal';
import ProfileRequiredModal from '@/components/ProfileRequiredModal';
import BottomNav from '@/components/BottomNav';
import { getComments } from '@/app/actions/video-actions';
import { postPlatformComment } from '@/app/actions/platform-update-actions';
import { useUser } from '@/components/UserContext';
import { getPlatformUpdatesByStatus } from '@/app/actions/platform-update-actions';

export default function FounderMeeting() {
    const { userProfile, isLoading: isUserLoading } = useUser();
    const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);
    const [showProfileRequiredModal, setShowProfileRequiredModal] = useState(false);

    // Data State
    const [activeUpdate, setActiveUpdate] = useState<any | null>(null);
    const [previousUpdates, setPreviousUpdates] = useState<any[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Modal State (for mobile video tap)
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalUpdate, setModalUpdate] = useState<any | null>(null);

    // Swipe-to-close state
    const swipeTouchStartYRef = useRef<number>(-1);
    const swipeTouchStartXRef = useRef<number>(0);
    const [swipeDragY, setSwipeDragY] = useState(0);
    const swipeActiveRef = useRef(false);

    // Modal video player state (custom controls)
    const playerRef = useRef<SmartVideoPlayerRef>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(false);
    const [showMobileControls, setShowMobileControls] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [seekFeedback, setSeekFeedback] = useState<{ side: 'left' | 'right'; key: number } | null>(null);
    const mobileControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const lastTapTimeRef = useRef<number>(0);
    const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const seekFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Comments State (used inside MODAL on mobile)
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [commentPage, setCommentPage] = useState(0);
    const [hasMoreComments, setHasMoreComments] = useState(true);
    const COMMENTS_PER_PAGE = 10;

    // Comments State (used on DESKTOP page)
    const [desktopComments, setDesktopComments] = useState<any[]>([]);
    const [desktopNewComment, setDesktopNewComment] = useState("");
    const [isLoadingDesktopComments, setIsLoadingDesktopComments] = useState(false);
    const [isPostingDesktopComment, setIsPostingDesktopComment] = useState(false);
    const [desktopCommentPage, setDesktopCommentPage] = useState(0);
    const [hasMoreDesktopComments, setHasMoreDesktopComments] = useState(true);


    useEffect(() => {
        loadPlatformUpdates();
    }, []);

    // Load desktop comments when active update changes
    useEffect(() => {
        if (activeUpdate?.video_id) {
            loadDesktopComments(activeUpdate.video_id);
        } else {
            setDesktopComments([]);
        }
    }, [activeUpdate?.video_id]);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (isModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isModalOpen]);

    // Load comments when modal opens
    useEffect(() => {
        if (isModalOpen && modalUpdate?.video_id) {
            loadInitialComments(modalUpdate.video_id);
        } else {
            setComments([]);
            setCommentPage(0);
            setHasMoreComments(true);
        }
    }, [isModalOpen, modalUpdate?.video_id]);

    const loadPlatformUpdates = async () => {
        setIsLoadingData(true);
        try {
            const [currentData, previousData] = await Promise.all([
                getPlatformUpdatesByStatus('current'),
                getPlatformUpdatesByStatus('previous')
            ]);
            if (currentData && currentData.length > 0) {
                setActiveUpdate(currentData[0]);
            } else {
                setActiveUpdate(null);
            }
            setPreviousUpdates(previousData || []);
        } catch (e) {
            console.error("Failed to load platform updates", e);
        }
        setIsLoadingData(false);
    };

    const openModal = (update: any) => {
        setModalUpdate(update);
        setIsModalOpen(true);
        // Reset player state for new video
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setShowMobileControls(false);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSwipeDragY(0);
        swipeTouchStartYRef.current = -1;
        swipeActiveRef.current = false;
        // Pause + reset player state
        playerRef.current?.pauseVideo();
        setIsPlaying(false);
        setProgress(0);
        setShowVolumeSlider(false);
        if (mobileControlsTimeoutRef.current) clearTimeout(mobileControlsTimeoutRef.current);
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
    };

    const switchModalVideo = (update: any) => {
        setModalUpdate(update);
        // Reload comments for new video
        loadInitialComments(update.video_id);
        // Reset player state
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setShowMobileControls(false);
    };

    const loadInitialComments = async (videoId: string) => {
        setIsLoadingComments(true);
        const initialLimit = 2;
        const data = await getComments(videoId, initialLimit, 0);
        setComments(data || []);
        setCommentPage(1);
        setHasMoreComments((data?.length || 0) === initialLimit);
        setIsLoadingComments(false);
    };

    const loadDesktopComments = async (videoId: string) => {
        setIsLoadingDesktopComments(true);
        const data = await getComments(videoId, 2, 0);
        setDesktopComments(data || []);
        setDesktopCommentPage(1);
        setHasMoreDesktopComments((data?.length || 0) === 2);
        setIsLoadingDesktopComments(false);
    };

    const handleLoadMoreDesktopComments = async () => {
        if (!activeUpdate?.video_id) return;
        setIsLoadingDesktopComments(true);
        const offset = 2 + (desktopCommentPage - 1) * COMMENTS_PER_PAGE;
        const data = await getComments(activeUpdate.video_id, COMMENTS_PER_PAGE, offset);
        if (data && data.length > 0) {
            setDesktopComments(prev => [...prev, ...data]);
            setDesktopCommentPage(prev => prev + 1);
            if (data.length < COMMENTS_PER_PAGE) setHasMoreDesktopComments(false);
        } else {
            setHasMoreDesktopComments(false);
        }
        setIsLoadingDesktopComments(false);
    };

    const handlePostDesktopComment = async () => {
        if (!userProfile) {
            setShowProfileRequiredModal(true);
            return;
        }
        if (!desktopNewComment.trim() || !activeUpdate) return;
        setIsPostingDesktopComment(true);
        const optimisticComment = {
            id: `temp-${Date.now()}`,
            user_name: userProfile.name,
            text: desktopNewComment,
            created_at: new Date().toISOString()
        };
        setDesktopComments(prev => [optimisticComment, ...prev]);
        setDesktopNewComment("");
        const result = await postPlatformComment(
            activeUpdate.video_id,
            activeUpdate.title || 'Platform Update',
            optimisticComment.text,
            userProfile.name,
            userProfile.id
        );
        if (result.success && result.comment) {
            setDesktopComments(prev => prev.map(c => c.id === optimisticComment.id ? result.comment : c));
        } else {
            setDesktopComments(prev => prev.filter(c => c.id !== optimisticComment.id));
            alert(`Failed to post comment: ${result.message}`);
        }
        setIsPostingDesktopComment(false);
    };

    const handleLoadMoreComments = async () => {
        if (!modalUpdate?.video_id) return;
        setIsLoadingComments(true);
        const offset = 2 + (commentPage - 1) * COMMENTS_PER_PAGE;
        const data = await getComments(modalUpdate.video_id, COMMENTS_PER_PAGE, offset);
        if (data && data.length > 0) {
            setComments(prev => [...prev, ...data]);
            setCommentPage(prev => prev + 1);
            if (data.length < COMMENTS_PER_PAGE) setHasMoreComments(false);
        } else {
            setHasMoreComments(false);
        }
        setIsLoadingComments(false);
    };

    const handlePostComment = async () => {
        if (!userProfile) {
            setShowProfileRequiredModal(true);
            return;
        }
        if (!newComment.trim() || !modalUpdate) return;
        setIsPostingComment(true);

        const optimisticComment = {
            id: `temp-${Date.now()}`,
            user_name: userProfile.name,
            text: newComment,
            created_at: new Date().toISOString()
        };
        setComments(prev => [optimisticComment, ...prev]);
        setNewComment("");

        const result = await postPlatformComment(
            modalUpdate.video_id,
            modalUpdate.title || 'Platform Update',
            optimisticComment.text,
            userProfile.name,
            userProfile.id
        );

        if (result.success && result.comment) {
            setComments(prev => prev.map(c => c.id === optimisticComment.id ? result.comment : c));
        } else {
            setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
            alert(`Failed to post comment: ${result.message}`);
        }
        setIsPostingComment(false);
    };

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Modal player helpers
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

    useEffect(() => {
        if (isModalOpen && isPlaying) {
            progressIntervalRef.current = setInterval(() => {
                if (playerRef.current) {
                    const curr = playerRef.current.getCurrentTime();
                    const dur = playerRef.current.getDuration();
                    setCurrentTime(curr);
                    setDuration(dur);
                    if (dur > 0) setProgress((curr / dur) * 100);
                }
            }, 500);
        }
        return () => { if (progressIntervalRef.current) clearInterval(progressIntervalRef.current); };
    }, [isModalOpen, isPlaying]);

    const togglePlay = () => {
        if (playerRef.current) {
            if (isPlaying) { playerRef.current.pauseVideo(); }
            else { playerRef.current.playVideo(); }
            setIsPlaying(!isPlaying);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = parseFloat(e.target.value);
        setProgress(val);
        if (playerRef.current) {
            const dur = duration || playerRef.current.getDuration();
            if (dur > 0) { playerRef.current.seekTo((val / 100) * dur); setCurrentTime((val / 100) * dur); }
        }
    };

    const toggleSpeed = () => {
        const rate = playbackRate === 1 ? 1.5 : 1;
        setPlaybackRate(rate);
        playerRef.current?.setPlaybackRate(rate);
    };

    const toggleMute = () => {
        if (isMuted) { playerRef.current?.unMute(); setIsMuted(false); }
        else { playerRef.current?.mute(); setIsMuted(true); }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = parseInt(e.target.value);
        setVolume(v);
        playerRef.current?.setVolume(v);
        setIsMuted(v === 0);
    };

    const handleVolumeEnter = () => {
        if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
        setShowVolumeSlider(true);
    };

    const handleVolumeLeave = () => {
        volumeTimeoutRef.current = setTimeout(() => setShowVolumeSlider(false), 300);
    };

    const handleVolumeTap = () => {
        const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        if (isTouch) {
            if (showVolumeSlider) {
                setShowVolumeSlider(false);
                if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
            } else {
                setShowVolumeSlider(true);
                if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
                volumeTimeoutRef.current = setTimeout(() => setShowVolumeSlider(false), 3000);
            }
        } else {
            toggleMute();
        }
    };

    const formatTime = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec < 10 ? '0' : ''}${sec}`;
    };

    const handleFullscreen = async () => {
        if (!videoContainerRef.current) return;
        try {
            if (!document.fullscreenElement) { await videoContainerRef.current.requestFullscreen(); }
            else { await document.exitFullscreen(); }
        } catch (err) { console.error('Fullscreen error:', err); }
    };

    const showMobileControlsTemporarily = () => {
        setShowMobileControls(true);
        if (mobileControlsTimeoutRef.current) clearTimeout(mobileControlsTimeoutRef.current);
        mobileControlsTimeoutRef.current = setTimeout(() => setShowMobileControls(false), 3000);
    };

    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    // Shared video thumbnail card (clickable)
    // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    const VideoThumbnailCard = ({ update, large = false }: { update: any; large?: boolean }) => (
        <button
            onClick={() => openModal(update)}
            className={`group w-full text-left rounded-2xl overflow-hidden border border-white/5 hover:border-red-500/20 transition-all duration-300 bg-[#111] ${large ? '' : ''}`}
        >
            <div className="relative aspect-video bg-black overflow-hidden">
                <img
                    src={`https://img.youtube.com/vi/${update.video_id}/maxresdefault.jpg`}
                    alt={update.title || 'Founder Update'}
                    className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500"
                />
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-black/60 border border-white/20 flex items-center justify-center backdrop-blur-sm group-hover:bg-red-600/70 group-hover:border-red-500/50 transition-all duration-300">
                        <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                </div>
                {/* Red bar at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500/60" />
                {/* Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
            {large && (
                <div className="p-4 md:p-5">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-900/20 border border-red-500/20 text-red-400 text-xs font-medium mb-3">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                        </span>
                        Founder Update
                    </div>
                    <h2 className="text-lg md:text-xl font-bold text-white leading-tight mb-1">
                        {update.title || 'Untitled Update'}
                    </h2>
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(update.created_at).toLocaleDateString()}
                    </p>
                </div>
            )}
        </button>
    );


    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30 flex flex-col">
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-[1600px] mx-auto px-4 md:px-6 h-14 md:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link href="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <img src="/veritas-heart.svg" alt="Veritas Logo" className="w-9 h-9 md:w-11 md:h-11 object-contain animate-heartbeat fill-red-600" />
                            <div className="flex items-baseline gap-1.5">
                                <span className="font-bold text-lg md:text-xl tracking-tight">HQ</span>
                                <span className="text-[10px] font-light text-gray-400 tracking-wide">Human Quality</span>
                            </div>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-16 md:pt-24 pb-8 px-4 md:px-6 max-w-[1600px] mx-auto w-full flex-1 flex flex-col">

                {/* â”€â”€ MOBILE LAYOUT (single column) â”€â”€ */}
                <div className="lg:hidden space-y-5">

                    {/* 1. Request a Feature pill */}
                    <div className="flex justify-center pt-2">
                        <button
                            onClick={() => {
                                if (!userProfile) {
                                    setShowProfileRequiredModal(true);
                                } else {
                                    setIsFeatureModalOpen(true);
                                }
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#1a1a1a] to-[#222] border border-white/10 rounded-full text-sm font-semibold text-white hover:border-yellow-500/30 hover:bg-yellow-500/5 active:scale-95 transition-all shadow-lg"
                        >
                            <Sparkles className="w-4 h-4 text-yellow-400" />
                            Request a Feature
                        </button>
                    </div>

                    {/* 2. Current update video (tap to open modal) */}
                    {isLoadingData ? (
                        <div className="flex items-center justify-center h-48 bg-[#111] rounded-2xl border border-white/5">
                            <Loader2 className="w-7 h-7 text-red-500 animate-spin" />
                        </div>
                    ) : !activeUpdate ? (
                        <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                            <div className="aspect-video flex flex-col items-center justify-center text-center p-6">
                                <div className="w-14 h-14 rounded-full bg-red-900/20 border border-red-500/20 flex items-center justify-center mb-4">
                                    <MessageSquare className="w-7 h-7 text-red-400" />
                                </div>
                                <h2 className="text-lg font-bold text-white mb-1">Next meeting coming soon</h2>
                                <p className="text-sm text-gray-400">Check back for the latest from the Veritas team.</p>
                            </div>
                        </div>
                    ) : (
                        <VideoThumbnailCard update={activeUpdate} large />
                    )}

                    {/* 3. Founder message (inline on page, always visible) */}
                    {activeUpdate && !isLoadingData && (
                        <div className="p-4 bg-[#111] rounded-2xl border border-white/5">
                            <h3 className="text-sm font-bold text-white mb-2">Message from the Founder</h3>
                            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                                {activeUpdate.message || "No message provided for this update."}
                            </p>
                        </div>
                    )}

                    {/* 4. Previous updates (max 2, tap to open modal) */}
                    {previousUpdates.slice(0, 2).length > 0 && !isLoadingData && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">Previous Meetings</h3>
                            <div className="space-y-3">
                                {previousUpdates.slice(0, 2).map((update) => (
                                    <VideoThumbnailCard key={update.id} update={update} large />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* â”€â”€ DESKTOP LAYOUT (two-column grid, unchanged) â”€â”€ */}
                <div className="hidden lg:grid grid-cols-1 lg:grid-cols-3 gap-12 mt-4">
                    {/* LEFT COLUMN: Main Video + Comments */}
                    <div className="lg:col-span-2 space-y-8">
                        {isLoadingData ? (
                            <div className="flex flex-col items-center justify-center h-64 bg-[#111] rounded-2xl border border-white/5">
                                <Loader2 className="w-8 h-8 text-red-500 animate-spin mb-4" />
                                <p className="text-gray-400">Loading platform updates...</p>
                            </div>
                        ) : !activeUpdate ? (
                            <>
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-900/20 border border-red-500/20 text-red-400 text-xs font-medium mb-4">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                        </span>
                                        Next Meeting Incoming
                                    </div>
                                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">No active updates</h1>
                                    <p className="text-gray-400 text-sm flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> Coming soon
                                    </p>
                                </div>

                                <div className="relative w-full aspect-video bg-[#111] rounded-2xl border border-white/5 shadow-2xl flex flex-col items-center justify-center text-center p-8">
                                    <div className="w-16 h-16 rounded-full bg-red-900/20 border border-red-500/20 flex items-center justify-center mb-6">
                                        <MessageSquare className="w-8 h-8 text-red-400" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Our next founder meeting is currently being prepared.</h2>
                                    <p className="text-gray-400">Check back soon for the latest updates from the Veritas team.</p>
                                </div>

                                <div className="p-6 bg-[#111] rounded-2xl border border-white/5">
                                    <h3 className="text-lg font-bold text-white mb-2">Message from the Founder</h3>
                                    <p className="text-gray-600 italic leading-relaxed whitespace-pre-wrap">There is no active message to display at this time.</p>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-900/20 border border-red-500/20 text-red-400 text-xs font-medium mb-4">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                        </span>
                                        Founder Update
                                    </div>
                                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
                                        {activeUpdate.title || 'Untitled Update'}
                                    </h1>
                                    <p className="text-gray-400 text-sm flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> {new Date(activeUpdate.created_at).toLocaleDateString()}
                                    </p>
                                </div>

                                <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                    <SmartVideoPlayer
                                        videoId={activeUpdate.video_id}
                                        title={activeUpdate.title || 'Untitled Update'}
                                    />
                                </div>

                                <div className="p-6 bg-[#111] rounded-2xl border border-white/5">
                                    <h3 className="text-lg font-bold text-white mb-2">Message from the Founder</h3>
                                    <p className="text-gray-400 leading-relaxed whitespace-pre-wrap">
                                        {activeUpdate.message || "No message provided for this update."}
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Desktop Comments Section */}
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold flex items-center gap-2">
                                    <MessageSquare className="w-5 h-5 text-red-500" />
                                    Your feedback is ALL that matters
                                </h3>
                                <span className="text-sm text-gray-400 bg-white/5 px-3 py-1 rounded-full">
                                    {desktopComments.length} insight{desktopComments.length !== 1 && 's'}
                                </span>
                            </div>

                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                </div>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={desktopNewComment}
                                        onChange={(e) => setDesktopNewComment(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !isPostingDesktopComment) handlePostDesktopComment();
                                        }}
                                        placeholder="Share your thoughts directly with the team..."
                                        className="w-full bg-[#111] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-red-500/50 pr-12 placeholder:text-gray-600"
                                    />
                                    <button
                                        onClick={handlePostDesktopComment}
                                        disabled={!desktopNewComment.trim() || isPostingDesktopComment}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-red-600 text-white transition-colors disabled:opacity-30 disabled:hover:bg-white/10"
                                    >
                                        {isPostingDesktopComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            <div className="space-y-4 pl-14">
                                {activeUpdate ? (
                                    <div className="space-y-4">
                                        {desktopComments.map((comment) => (
                                            <div key={comment.id} className="flex gap-3 group">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-xs font-bold text-gray-400 border border-white/5 flex-shrink-0">
                                                    {(comment.user_name || '?').charAt(0).toUpperCase()}
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-baseline gap-2 mb-1">
                                                        <span className={`text-sm font-semibold ${comment.user_name === 'You' ? 'text-red-400' : 'text-gray-200'}`}>
                                                            {comment.user_name || 'Community Member'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-600">{new Date(comment.created_at).toLocaleDateString()}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-400 leading-relaxed font-light">{comment.text}</p>
                                                </div>
                                            </div>
                                        ))}

                                        {desktopComments.length === 0 && !isLoadingDesktopComments && (
                                            <div className="text-center py-4">
                                                <p className="text-xs text-gray-600 italic">No comments yet. Be the first to share your thoughts.</p>
                                            </div>
                                        )}

                                        {hasMoreDesktopComments && (
                                            <button
                                                onClick={handleLoadMoreDesktopComments}
                                                disabled={isLoadingDesktopComments}
                                                className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                            >
                                                {isLoadingDesktopComments ? <Loader2 className="w-3 h-3 animate-spin" /> : <><span>Show more comments</span><ChevronDown className="w-3 h-3" /></>}
                                            </button>
                                        )}
                                    </div>
                                ) : (
                                    <div className="space-y-4 opacity-50 pointer-events-none">
                                        <div className="text-center py-4">
                                            <p className="text-xs text-gray-600 italic">Comments will be available when a meeting is active.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Previous Updates + Feature Request */}
                    <div className="space-y-8">
                        <div className="space-y-6">
                            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Previous Meetings</h3>
                            <div className="space-y-4">
                                {previousUpdates.length === 0 && !isLoadingData && (
                                    <div className="text-gray-500 text-sm italic py-4 bg-[#111] rounded-xl border border-white/5 text-center">
                                        No previous meetings available.
                                    </div>
                                )}
                                {previousUpdates.map((update) => (
                                    <button
                                        key={update.id}
                                        onClick={() => setActiveUpdate(update)}
                                        className={`w-full group text-left p-4 rounded-xl border transition-all duration-300 ${activeUpdate?.id === update.id
                                            ? 'bg-red-900/10 border-red-500/30'
                                            : 'bg-[#111] border-white/5 hover:border-white/20 hover:bg-white/5'
                                            }`}
                                    >
                                        <div className="relative aspect-video rounded-lg overflow-hidden bg-black mb-3 grayscale group-hover:grayscale-0 transition-all">
                                            <img
                                                src={`https://img.youtube.com/vi/${update.video_id}/mqdefault.jpg`}
                                                alt={update.title || 'Untitled Update'}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <h4 className={`font-bold text-sm leading-snug mb-1 ${activeUpdate?.id === update.id ? 'text-red-400' : 'text-gray-300 group-hover:text-white'}`}>
                                            {update.title || 'Untitled Update'}
                                        </h4>
                                        <p className="text-[10px] text-gray-500">{new Date(update.created_at).toLocaleDateString()}</p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Request a Feature Widget (desktop only) */}
                        <div className="p-6 bg-gradient-to-br from-[#111] to-[#1a1a1a] rounded-2xl border border-white/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <Lightbulb className="w-24 h-24 text-yellow-500" />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-yellow-500" />
                                Request a Feature
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">
                                Have an idea that would make Veritas better? Let us know directly.
                            </p>
                            <button
                                onClick={() => {
                                    if (!userProfile) {
                                        setShowProfileRequiredModal(true);
                                    } else {
                                        setIsFeatureModalOpen(true);
                                    }
                                }}
                                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors"
                            >
                                Submit Request
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Glass modal (mobile video tap) â€” inlined directly, NOT as a sub-component,
                 to prevent React from remounting the YouTube player on every state update */}
            <AnimatePresence>
                {isModalOpen && modalUpdate && (
                    <motion.div
                        key="founder-modal"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8"
                    >
                        {/* Backdrop */}
                        <div
                            onClick={closeModal}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />

                        {/* Modal Box */}
                        <div
                            className="relative flex flex-col overflow-hidden shadow-[0_0_150px_rgba(0,0,0,0.8)] w-full max-w-4xl rounded-none md:rounded-[32px] bg-[#1a1a1a] border-0 md:border md:border-white/10 h-[100dvh] md:h-auto md:max-h-[90vh]"
                            style={{
                                transform: swipeDragY > 0 ? `translateY(${swipeDragY}px)` : undefined,
                                transition: swipeDragY > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94), opacity 0.3s ease',
                                opacity: swipeDragY > 0 ? Math.max(0.4, 1 - swipeDragY / 300) : 1,
                            }}
                            onClick={(e) => e.stopPropagation()}
                            onTouchStart={(e) => {
                                const touch = e.touches[0];
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                const relY = touch.clientY - rect.top;
                                const isTopZone = relY < 120;
                                const isVideoZone = videoContainerRef.current?.contains(e.target as Node);
                                if (isTopZone || isVideoZone) {
                                    swipeTouchStartYRef.current = touch.clientY;
                                    swipeTouchStartXRef.current = touch.clientX;
                                    swipeActiveRef.current = false;
                                } else { swipeTouchStartYRef.current = -1; }
                            }}
                            onTouchMove={(e) => {
                                if (swipeTouchStartYRef.current < 0) return;
                                const touch = e.touches[0];
                                const dy = touch.clientY - swipeTouchStartYRef.current;
                                const dx = Math.abs(touch.clientX - swipeTouchStartXRef.current);
                                if (!swipeActiveRef.current) {
                                    if (Math.abs(dy) < 8 && dx < 8) return;
                                    if (dx > Math.abs(dy)) { swipeTouchStartYRef.current = -1; return; }
                                    swipeActiveRef.current = true;
                                }
                                if (dy > 0) { e.preventDefault(); setSwipeDragY(dy); }
                            }}
                            onTouchEnd={() => {
                                if (swipeDragY > 120) closeModal();
                                else setSwipeDragY(0);
                                swipeTouchStartYRef.current = -1;
                                swipeActiveRef.current = false;
                            }}
                        >
                            {/* Swipe pill */}
                            <div className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0" style={{ touchAction: 'none' }}>
                                <div className="w-10 h-1 rounded-full bg-white/25" />
                            </div>
                            {/* Close button */}
                            <button onClick={closeModal}
                                className="absolute top-5 right-5 z-50 p-2 rounded-full bg-black/40 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>

                            {/* Scrollable content */}
                            <div className="flex flex-col gap-4 md:gap-6 p-4 md:p-8 overflow-y-auto no-scrollbar">
                                <div>

                                    {/* Video + message + comments */}
                                    <div className="space-y-5">

                                        {/* Custom video player */}
                                        <div
                                            ref={videoContainerRef}
                                            className="relative group aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
                                            style={{ touchAction: 'pan-x' }}
                                        >
                                            <SmartVideoPlayer
                                                key={modalUpdate.video_id}
                                                ref={playerRef}
                                                videoId={modalUpdate.video_id}
                                                title={modalUpdate.title || 'Founder Update'}
                                                autoplay={true}
                                                controls={false}
                                                className="w-full h-full"
                                                onPlay={() => setIsPlaying(true)}
                                                onPause={() => setIsPlaying(false)}
                                                onEnded={() => setIsPlaying(false)}
                                            />
                                            {/* Touch intercept layer */}
                                            <div className="absolute inset-0 z-10"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
                                                    if (isTouch) {
                                                        const now = Date.now();
                                                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                        const x = e.clientX - rect.left;
                                                        const side = x < rect.width / 2 ? 'left' : 'right';

                                                        if (now - lastTapTimeRef.current < 300) {
                                                            if (singleTapTimeoutRef.current) clearTimeout(singleTapTimeoutRef.current);
                                                            const curr = playerRef.current?.getCurrentTime() || 0;
                                                            const dur = playerRef.current?.getDuration() || 0;
                                                            const newTime = side === 'right'
                                                                ? Math.min(curr + 10, dur || curr + 10)
                                                                : Math.max(curr - 5, 0);
                                                            playerRef.current?.seekTo(newTime);
                                                            setCurrentTime(newTime);
                                                            if (dur > 0) setProgress((newTime / dur) * 100);
                                                            if (seekFeedbackTimeoutRef.current) clearTimeout(seekFeedbackTimeoutRef.current);
                                                            setSeekFeedback({ side, key: Date.now() });
                                                            seekFeedbackTimeoutRef.current = setTimeout(() => setSeekFeedback(null), 700);
                                                            lastTapTimeRef.current = 0;
                                                        } else {
                                                            lastTapTimeRef.current = now;
                                                            singleTapTimeoutRef.current = setTimeout(() => {
                                                                showMobileControls ? setShowMobileControls(false) : showMobileControlsTemporarily();
                                                            }, 250);
                                                        }
                                                        return;
                                                    }
                                                    togglePlay();
                                                }}
                                                onDoubleClick={(e) => { const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0; if (isTouch) return; e.preventDefault(); handleFullscreen(); }}
                                            />
                                            {/* Centre play/pause (mobile) */}
                                            <div className={`absolute inset-0 pointer-events-none flex items-center justify-center z-20 transition-opacity duration-300 ${showMobileControls ? 'opacity-100' : 'opacity-0'}`}>
                                                <button onClick={(e) => { e.stopPropagation(); togglePlay(); showMobileControlsTemporarily(); }}
                                                    className={`w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-2xl ${showMobileControls ? 'pointer-events-auto' : 'pointer-events-none'}`}>
                                                    {isPlaying ? <Pause className="w-8 h-8 text-white fill-white" /> : <Play className="w-8 h-8 text-white fill-white ml-1" />}
                                                </button>
                                            </div>
                                            {/* Double-tap seek feedback */}
                                            <AnimatePresence>
                                                {seekFeedback && (
                                                    <motion.div
                                                        key={seekFeedback.key}
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={{ duration: 0.15 }}
                                                        className={`absolute inset-y-0 z-30 pointer-events-none flex items-center justify-center ${seekFeedback.side === 'right' ? 'left-1/2 right-0' : 'left-0 right-1/2'}`}
                                                    >
                                                        <div className="flex flex-col items-center gap-0.5">
                                                            <div className="flex">
                                                                {seekFeedback.side === 'right' ? (
                                                                    <><ChevronRight className="w-7 h-7 text-white drop-shadow-lg" /><ChevronRight className="w-7 h-7 text-white drop-shadow-lg -ml-3" /></>
                                                                ) : (
                                                                    <><ChevronLeft className="w-7 h-7 text-white drop-shadow-lg -mr-3" /><ChevronLeft className="w-7 h-7 text-white drop-shadow-lg" /></>
                                                                )}
                                                            </div>
                                                            <span className="text-white text-xs font-bold drop-shadow-lg tabular-nums">
                                                                {seekFeedback.side === 'right' ? '+10s' : '-5s'}
                                                            </span>
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Controls overlay */}
                                            <div className={`absolute inset-0 pointer-events-none flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300 ${showMobileControls ? 'opacity-100' : 'opacity-0 md:opacity-0 md:group-hover:opacity-100'}`}>
                                                <div className="w-full flex flex-col gap-2 pb-4 px-4 pointer-events-auto z-20">
                                                    <div className="group/progress relative w-full h-4 flex items-center cursor-pointer touch-none">
                                                        <div className="absolute left-0 right-0 h-1 bg-white/20 rounded-full overflow-hidden group-hover/progress:h-1.5 transition-all">
                                                            <div className="absolute left-0 top-0 bottom-0 bg-red-600" style={{ width: `${progress}%` }} />
                                                        </div>
                                                        <input type="range" min="0" max="100" step="0.01" value={progress} onChange={handleSeek}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40" />
                                                        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-red-600 rounded-full border-2 border-white scale-0 group-hover/progress:scale-100 transition-transform pointer-events-none z-50"
                                                            style={{ left: `${progress}%` }} />
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <button onClick={togglePlay} className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/10">
                                                                {isPlaying ? <Pause className="w-4 h-4 text-white fill-white" /> : <Play className="w-4 h-4 text-white fill-white ml-0.5" />}
                                                            </button>
                                                            <div
                                                                className="relative flex items-center"
                                                                onMouseEnter={handleVolumeEnter}
                                                                onMouseLeave={handleVolumeLeave}
                                                            >
                                                                <button onClick={handleVolumeTap} className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/10">
                                                                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-white" /> : <Volume2 className="w-4 h-4 text-white" />}
                                                                </button>
                                                                <AnimatePresence>
                                                                    {showVolumeSlider && (
                                                                        <div
                                                                            className="absolute bottom-full left-0 mb-2 px-3 py-3 bg-black/90 border border-white/10 rounded-full backdrop-blur-md flex flex-col items-center shadow-xl"
                                                                            onTouchStart={(e) => e.stopPropagation()}
                                                                            onTouchMove={(e) => e.stopPropagation()}
                                                                        >
                                                                            <input
                                                                                type="range"
                                                                                min="0"
                                                                                max="100"
                                                                                value={isMuted ? 0 : volume}
                                                                                onChange={handleVolumeChange}
                                                                                className="h-28 w-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg"
                                                                                style={{ writingMode: 'vertical-lr', direction: 'rtl', touchAction: 'none' } as any}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </div>
                                                            <span className="text-[10px] text-white/70 font-mono tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={toggleSpeed}
                                                                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all shadow-lg ${playbackRate === 1.5
                                                                    ? 'bg-red-600 border-red-500 text-white'
                                                                    : 'bg-white/20 border-white/10 text-white hover:bg-white/30'
                                                                }`}
                                                            >
                                                                1.5x
                                                            </button>
                                                            <button onClick={handleFullscreen} className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/10">
                                                                <Maximize2 className="w-4 h-4 text-white" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Title + date */}
                                        <div>
                                            <h2 className="text-xl font-bold text-white leading-tight mb-1">{modalUpdate.title || 'Untitled Update'}</h2>
                                            <p className="text-xs text-gray-500 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(modalUpdate.created_at).toLocaleDateString()}
                                            </p>
                                        </div>

                                        {/* Founder Message */}
                                        <div className="p-4 bg-[#111] rounded-2xl border border-white/5">
                                            <h3 className="text-sm font-bold text-white mb-2">Message from the Founder</h3>
                                            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">
                                                {modalUpdate.message || 'No message provided for this update.'}
                                            </p>
                                        </div>

                                        {/* Comments */}
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-base font-bold flex items-center gap-2">
                                                    <MessageSquare className="w-4 h-4 text-red-500" />
                                                    Your feedback matters
                                                </h3>
                                                <span className="text-xs text-gray-400 bg-white/5 px-3 py-1 rounded-full">
                                                    {comments.length} insight{comments.length !== 1 && 's'}
                                                </span>
                                            </div>
                                            <div className="flex gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-800 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                                    <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                                                </div>
                                                <div className="flex-1 relative">
                                                    <input type="text" value={newComment}
                                                        onChange={(e) => setNewComment(e.target.value)}
                                                        enterKeyHint="send"
                                                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); if (!isPostingComment && newComment.trim()) handlePostComment(); } }}
                                                        placeholder="Share your thoughts directly with the team..."
                                                        className="w-full bg-[#0f0f0f] border border-white/10 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-red-500/50 pr-12 placeholder:text-gray-600"
                                                    />
                                                    <button onClick={handlePostComment} disabled={!newComment.trim() || isPostingComment}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/10 hover:bg-red-600 text-white transition-colors disabled:opacity-30 disabled:hover:bg-white/10">
                                                        {isPostingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-3 pl-11">
                                                {comments.map((comment) => (
                                                    <div key={comment.id} className="flex gap-3">
                                                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-xs font-bold text-gray-400 border border-white/5 flex-shrink-0">
                                                            {(comment.user_name || '?').charAt(0).toUpperCase()}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-baseline gap-2 mb-0.5">
                                                                <span className="text-xs font-semibold text-gray-200">{comment.user_name || 'Community Member'}</span>
                                                                <span className="text-[10px] text-gray-600">{new Date(comment.created_at).toLocaleDateString()}</span>
                                                            </div>
                                                            <p className="text-xs text-gray-400 leading-relaxed">{comment.text}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                                {comments.length === 0 && !isLoadingComments && (
                                                    <p className="text-xs text-gray-600 italic text-center py-2">No comments yet. Be the first.</p>
                                                )}
                                                {hasMoreComments && (
                                                    <button onClick={handleLoadMoreComments} disabled={isLoadingComments}
                                                        className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all">
                                                        {isLoadingComments ? <Loader2 className="w-3 h-3 animate-spin" /> : <><span>Show more</span><ChevronDown className="w-3 h-3" /></>}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <FeatureRequestModal
                isOpen={isFeatureModalOpen}
                onClose={() => setIsFeatureModalOpen(false)}
                userProfile={userProfile}
            />

            {/* Profile Required Modal */}
            <ProfileRequiredModal
                isOpen={showProfileRequiredModal}
                onClose={() => setShowProfileRequiredModal(false)}
            />

            <BottomNav />
        </div>
    );
}
