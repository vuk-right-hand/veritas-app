"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Brain, CheckCircle2, Volume2, Maximize2, Pause, VolumeX, Send, Loader2, ChevronDown, ExternalLink, Zap, Trophy, ArrowRight, Sparkles } from 'lucide-react';
import SmartVideoPlayer, { SmartVideoPlayerRef } from './SmartVideoPlayer';
import { getComments, postComment, recordVideoView } from '@/app/actions/video-actions';
import { getQuizQuestions, getUserIdFromMission, getCurrentUserId } from '@/app/actions/quiz-actions';

interface VideoCardProps {
    videoId: string;
    title: string;
    humanScore: number;
    takeaways: string[];
    customDescription?: string; // Video-specific description (from creator dashboard per-video edit)
    channelTitle?: string;
    channelUrl?: string;
    publishedAt?: string;
    customLinks?: { title: string; url: string; }[]; // Video-specific links
    channelDescription?: string; // Channel-level description (from "Manage Links" modal)
    channelLinks?: { title: string; url: string; }[]; // Channel-level links (from "Manage Links" modal)
    isChannelClaimed?: boolean; // Whether the creator has claimed this channel
    onQuizStart?: () => void;
    onVideoView?: () => void;
}

export default function VideoCard({ videoId, title, humanScore, takeaways, customDescription, channelTitle, channelUrl, publishedAt, customLinks, channelDescription, channelLinks, isChannelClaimed, onQuizStart, onVideoView }: VideoCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const [isVideoEnded, setIsVideoEnded] = useState(false);
    const [showQuizOverlay, setShowQuizOverlay] = useState(false);
    const [mobileStartSignal, setMobileStartSignal] = useState(0);
    const quizPanelRef = useRef<HTMLDivElement>(null);

    // === DISPLAY PRIORITY LOGIC ===
    // First line: video description (priority) OR channel description (fallback)
    // On expand, show in order:
    //   1. Full first-line description (if it was truncated)
    //   2. Video-specific links
    //   3. Channel description (if video desc was shown first)
    //   4. Channel links
    //   5. If nothing at all & channel not claimed: prompt to claim

    const firstLineText = customDescription || channelDescription || '';
    const hasVideoDesc = !!customDescription;
    const hasChannelDesc = !!channelDescription;
    const hasVideoLinks = customLinks && customLinks.length > 0;
    const hasChannelLinks = channelLinks && channelLinks.length > 0;
    const hasAnything = hasVideoDesc || hasChannelDesc || hasVideoLinks || hasChannelLinks;
    const hasExpandableContent = hasVideoLinks || hasChannelLinks ||
        (hasVideoDesc && hasChannelDesc) || // Both descs = show channel desc on expand
        firstLineText.length > 100; // Long text truncated

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 100
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);
    const [showMobileControls, setShowMobileControls] = useState(false);
    const mobileControlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Swipe-down-to-close gesture state
    const swipeTouchStartYRef = useRef<number>(0);
    const swipeTouchStartXRef = useRef<number>(0);
    const [swipeDragY, setSwipeDragY] = useState(0);
    const swipeActiveRef = useRef(false); // true once we've committed to a vertical drag

    // Watch Progress Tracking (Interest Scoring)
    const watchReportIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastKnownTimeRef = useRef<number>(0); // Video position (for interest scoring)
    const lastKnownDurationRef = useRef<number>(0);

    // Wall-clock tracking — seek-proof
    const playStartTimeRef = useRef<number>(0);       // Date.now() when play started/resumed
    const accumulatedWatchRef = useRef<number>(0);     // Seconds from COMPLETED play segments
    const lastSentWatchRef = useRef<number>(0);        // Last accumulated value we sent to API

    /**
     * NON-DESTRUCTIVE read: total real seconds watched including any live segment.
     * Does NOT modify any refs — safe to call anytime.
     */
    const getRealWatchSeconds = useCallback((): number => {
        let total = accumulatedWatchRef.current;
        if (playStartTimeRef.current > 0) {
            total += (Date.now() - playStartTimeRef.current) / 1000;
        }
        return total;
    }, []);

    /**
     * Send watch progress to the scoring API.
     * Uses wall-clock accumulated time (seek-proof).
     * Only sends if user watched > 30 real seconds.
     */
    const sendWatchProgress = useCallback(async () => {
        const realWatched = getRealWatchSeconds();
        const ct = lastKnownTimeRef.current;
        const d = lastKnownDurationRef.current;
        const newSeconds = realWatched - lastSentWatchRef.current;

        console.log(`[WatchProgress] Triggered — realWatched:${realWatched.toFixed(1)}s videoPos:${ct.toFixed(1)}s dur:${d.toFixed(1)}s newDelta:${newSeconds.toFixed(1)}s`);

        if (!videoId || d <= 0) {
            console.log('[WatchProgress] Skipped — missing videoId or zero duration');
            return;
        }
        if (realWatched < 30) {
            console.log(`[WatchProgress] Skipped — under 30s threshold (${realWatched.toFixed(1)}s real)`);
            return;
        }
        if (newSeconds < 5) {
            console.log(`[WatchProgress] Skipped — only ${newSeconds.toFixed(1)}s new since last report`);
            return;
        }

        const payload = {
            videoId,
            currentTime: ct,
            duration: d,
            realWatchSeconds: Math.round(newSeconds)
        };

        lastSentWatchRef.current = realWatched;
        console.log(`[WatchProgress] Sending — video:${videoId} realDelta:${Math.round(newSeconds)}s videoPos:${ct.toFixed(1)}s`);

        try {
            const res = await fetch('/api/watch-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            console.log('[WatchProgress] Response:', data);
        } catch (err) {
            console.error('[WatchProgress] Error:', err);
        }
    }, [videoId, getRealWatchSeconds]); // STABLE identity

    // Volume Hover Timeout Logic
    const volumeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleVolumeEnter = () => {
        if (volumeTimeoutRef.current) clearTimeout(volumeTimeoutRef.current);
        setShowVolumeSlider(true);
    };

    const handleVolumeLeave = () => {
        volumeTimeoutRef.current = setTimeout(() => {
            setShowVolumeSlider(false);
        }, 300); // 300ms grace period
    };

    const decodeText = (html: string) => {
        if (typeof document === 'undefined') return html; // Server-side safety
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    };

    // Comments State
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [commentPage, setCommentPage] = useState(0);
    const [hasMoreComments, setHasMoreComments] = useState(true);
    const COMMENTS_PER_PAGE = 10;

    const videoContainerRef = useRef<HTMLDivElement>(null);
    const playerRef = useRef<SmartVideoPlayerRef>(null);

    // Close on Escape key & Listen for fullscreen changes
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isFullscreen) {
                    if (document.fullscreenElement) {
                        document.exitFullscreen();
                    }
                    setIsFullscreen(false);
                } else {
                    setIsOpen(false);
                }
            }
        };

        const handleFullscreenChange = () => {
            // Sync state with actual fullscreen status
            if (document.fullscreenElement) {
                setIsFullscreen(true);
            } else {
                setIsFullscreen(false);
            }
        };

        window.addEventListener('keydown', handleEsc);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        return () => {
            window.removeEventListener('keydown', handleEsc);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
        };
    }, [isFullscreen]);

    // Lock Body Scroll when Open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Progress Loop — updates both state (for UI) and refs (for reliable watch tracking)
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isOpen && isPlaying) {
            interval = setInterval(() => {
                if (playerRef.current) {
                    const curr = playerRef.current.getCurrentTime();
                    const dur = playerRef.current.getDuration();
                    setCurrentTime(curr);
                    setDuration(dur);
                    // Keep refs in sync — these survive player unmount
                    lastKnownTimeRef.current = curr;
                    lastKnownDurationRef.current = dur;
                    if (dur > 0) {
                        setProgress((curr / dur) * 100);
                    }
                }
            }, 500); // Update every 500ms
        }
        return () => clearInterval(interval);
    }, [isOpen, isPlaying]);

    // Periodic watch progress reporter (every 30s while playing)
    // NOTE: sendWatchProgress is now stable (only depends on videoId),
    // so this interval won't be reset every render
    useEffect(() => {
        if (isOpen && isPlaying) {
            watchReportIntervalRef.current = setInterval(() => {
                sendWatchProgress();
            }, 30000); // Every 30 seconds
        }
        return () => {
            if (watchReportIntervalRef.current) {
                clearInterval(watchReportIntervalRef.current);
                watchReportIntervalRef.current = null;
            }
        };
    }, [isOpen, isPlaying, sendWatchProgress]);

    // Report watch progress when modal closes
    useEffect(() => {
        if (!isOpen && (accumulatedWatchRef.current > 0 || playStartTimeRef.current > 0)) {
            // Close any live play segment before sending
            if (playStartTimeRef.current > 0) {
                accumulatedWatchRef.current += (Date.now() - playStartTimeRef.current) / 1000;
                playStartTimeRef.current = 0;
            }
            sendWatchProgress();
            // Reset ALL tracking for next session
            lastKnownTimeRef.current = 0;
            lastKnownDurationRef.current = 0;
            accumulatedWatchRef.current = 0;
            lastSentWatchRef.current = 0;
        }
    }, [isOpen, sendWatchProgress]);

    // Load Initial Comments
    useEffect(() => {
        if (isOpen) {
            // Record view with context
            let source_context = 'direct';
            if (typeof window !== 'undefined') {
                const params = new URLSearchParams(window.location.search);
                const filter = params.get('filter');
                if (filter) source_context = `filter:${filter}`;
            }
            recordVideoView(videoId, { source_context, timestamp: new Date().toISOString() });

            loadInitialComments();
        }
    }, [isOpen]);

    const loadInitialComments = async () => {
        setIsLoadingComments(true);
        // Initial load: fetch 2 comments as requested
        const initialLimit = 2;
        const data = await getComments(videoId, initialLimit, 0);
        setComments(data || []);
        setCommentPage(1); // Next page starts after these
        setHasMoreComments((data?.length || 0) === initialLimit); // If we got full limit, likely more
        setIsLoadingComments(false);
    };

    const handleLoadMoreComments = async () => {
        setIsLoadingComments(true);
        const offset = 2 + (commentPage - 1) * COMMENTS_PER_PAGE; // 2 initial + pages * 10
        const data = await getComments(videoId, COMMENTS_PER_PAGE, offset);

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
        if (!newComment.trim()) return;
        setIsPostingComment(true);

        // Optimistic Update
        const optimisticComment = {
            id: `temp-${Date.now()}`,
            user_name: 'You',
            text: newComment,
            created_at: new Date().toISOString()
        };
        setComments(prev => [optimisticComment, ...prev]);
        setNewComment("");

        const result = await postComment(videoId, optimisticComment.text);

        if (result.success && result.comment) {
            // Replace temp with real
            setComments(prev => prev.map(c => c.id === optimisticComment.id ? result.comment : c));
        } else {
            // Revert on error
            setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
            alert(`Failed to post comment: ${result.message}`);
        }
        setIsPostingComment(false);
    };

    const handleFullscreen = async () => {
        if (!videoContainerRef.current) return;

        try {
            if (!isFullscreen) {
                // Enter fullscreen
                await videoContainerRef.current.requestFullscreen();
                setIsFullscreen(true);
            } else {
                // Exit fullscreen
                if (document.fullscreenElement) {
                    await document.exitFullscreen();
                }
                setIsFullscreen(false);
            }
        } catch (err) {
            console.error('Fullscreen error:', err);
        }
    };

    const togglePlay = () => {
        if (playerRef.current) {
            if (isPlaying) {
                playerRef.current.pauseVideo();
            } else {
                playerRef.current.playVideo();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newProgress = parseFloat(e.target.value);
        setProgress(newProgress);
        if (playerRef.current) {
            const effectiveDuration = duration || playerRef.current.getDuration();
            if (effectiveDuration > 0) {
                playerRef.current.seekTo((newProgress / 100) * effectiveDuration);
                setCurrentTime((newProgress / 100) * effectiveDuration);
            }
        }
    };

    const toggleSpeed = () => {
        const newRate = playbackRate === 1 ? 1.5 : 1;
        setPlaybackRate(newRate);
        playerRef.current?.setPlaybackRate(newRate);
    };

    const toggleMute = () => {
        if (isMuted) {
            playerRef.current?.unMute();
            setIsMuted(false);
        } else {
            playerRef.current?.mute();
            setIsMuted(true);
        }
    };

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVol = parseInt(e.target.value);
        setVolume(newVol);
        playerRef.current?.setVolume(newVol);
        if (newVol === 0) setIsMuted(true);
        else setIsMuted(false);
    };

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    return (
        <>
            {/* Card State (Collapsed) */}
            <motion.div
                layoutId={`card-${videoId}`}
                onClick={() => { setIsOpen(true); onVideoView?.(); }}
                className="group relative bg-[#0F0F0F] rounded-2xl overflow-hidden cursor-pointer border border-white/5 hover:border-red-500/30 transition-colors duration-500"
                whileHover={{ y: -5 }}
            >
                {/* Thumbnail Layer */}
                <div className="relative aspect-video">
                    <img
                        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                        alt={title}
                        className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                    {/* Human Score Line - Animated on Mount (Feed View) */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                        <motion.div
                            initial={{ width: "0%" }}
                            animate={{ width: `${humanScore}%` }}
                            transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
                            className={`h-full ${humanScore > 90 ? 'bg-green-500' : 'bg-yellow-500'}`}
                        />
                    </div>
                </div>

                {/* Content Layer (Feed View) */}
                <div className="p-4 md:p-5">
                    {/* Score Label above Headline */}
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold tracking-wider uppercase ${humanScore > 90 ? 'text-green-500' : 'text-yellow-500'}`}>
                            {humanScore}% Human Verified
                        </span>
                    </div>

                    <h3 className="text-base md:text-lg font-bold text-gray-100 line-clamp-2 leading-tight mb-3 md:mb-4 group-hover:text-red-400 transition-colors">
                        {title}
                    </h3>

                    {/* Channel & Date - Feed View */}
                    <div className="flex items-center gap-2 mb-4 text-[10px] text-gray-500 font-medium">
                        {channelUrl ? (
                            <a
                                href={channelUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="hover:text-red-400 transition-colors uppercase tracking-wider"
                            >
                                {channelTitle || 'Unknown Channel'}
                            </a>
                        ) : (
                            <span className="uppercase tracking-wider">{channelTitle || 'Unknown Channel'}</span>
                        )}
                        {publishedAt && (
                            <>
                                <span>•</span>
                                <span>{new Date(publishedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>
                            </>
                        )}
                    </div>

                    {/* Prominent Takeaways (Feed View) */}
                    <div className="space-y-2.5">
                        {takeaways.slice(0, 3).map((t, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className="flex-none w-4 h-4 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[9px] text-gray-500 font-mono mt-0.5">
                                    {i + 1}
                                </div>
                                <span className="text-xs text-gray-400 leading-snug line-clamp-2 group-hover:text-gray-300 transition-colors">
                                    {t}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </motion.div >


            {/* Expanded State (The Glass Modal) */}
            <AnimatePresence>
                {
                    isOpen && (<>
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 md:p-8">

                            {/* Backdrop with Blur */}
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setIsOpen(false)}
                                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                            />

                            {/* "ONE BOX" Container */}
                            <motion.div
                                layoutId={`card-${videoId}`}
                                className={`
                                relative flex flex-col overflow-hidden shadow-[0_0_150px_rgba(0,0,0,0.8)]
                                ${isFullscreen
                                        ? 'fixed inset-0 z-[200] w-screen h-screen rounded-none bg-black'
                                        : 'w-full max-w-6xl rounded-none md:rounded-[32px] bg-[#1a1a1a]/60 backdrop-blur-3xl border-0 md:border md:border-white/10 h-[100dvh] md:h-auto md:max-h-[95vh]'
                                    }
                            `}
                                style={{
                                    transform: swipeDragY > 0 ? `translateY(${swipeDragY}px)` : undefined,
                                    transition: swipeDragY === 0 ? 'transform 0.3s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
                                    opacity: swipeDragY > 0 ? Math.max(0.4, 1 - swipeDragY / 300) : undefined,
                                }}
                                onClick={(e) => e.stopPropagation()}
                                onTouchStart={(e) => {
                                    const touch = e.touches[0];
                                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                    const relY = touch.clientY - rect.top;

                                    // Allow swipe from the top 120px OR if touching the video player itself
                                    const isTopZone = relY < 120;
                                    const isVideoContainer = videoContainerRef.current?.contains(e.target as Node);

                                    if (isTopZone || isVideoContainer) {
                                        swipeTouchStartYRef.current = touch.clientY;
                                        swipeTouchStartXRef.current = touch.clientX;
                                        swipeActiveRef.current = false; // not yet committed
                                    } else {
                                        swipeTouchStartYRef.current = -1; // sentinel = inactive
                                    }
                                }}
                                onTouchMove={(e) => {
                                    if (swipeTouchStartYRef.current < 0) return;
                                    const touch = e.touches[0];
                                    const dy = touch.clientY - swipeTouchStartYRef.current;
                                    const dx = Math.abs(touch.clientX - swipeTouchStartXRef.current);
                                    // Commit to vertical swipe only if more vertical than horizontal
                                    if (!swipeActiveRef.current) {
                                        if (Math.abs(dy) < 8 && dx < 8) return; // not moved enough yet
                                        if (dx > Math.abs(dy)) {
                                            swipeTouchStartYRef.current = -1; // horizontal — cancel
                                            return;
                                        }
                                        swipeActiveRef.current = true;
                                    }
                                    if (dy > 0) {
                                        e.preventDefault(); // prevent scroll while swiping down
                                        setSwipeDragY(dy);
                                    }
                                }}
                                onTouchEnd={() => {
                                    if (swipeDragY > 120) {
                                        setIsOpen(false);
                                    }
                                    setSwipeDragY(0);
                                    swipeTouchStartYRef.current = -1;
                                    swipeActiveRef.current = false;
                                }}
                            >
                                {/* Swipe pill handle — mobile-only, top of modal */}
                                {!isFullscreen && (
                                    <div
                                        className="md:hidden flex justify-center pt-3 pb-1 flex-shrink-0"
                                        style={{ touchAction: 'none' }}
                                    >
                                        <div className="w-10 h-1 rounded-full bg-white/25" />
                                    </div>
                                )}

                                {/* Close Button - Internal Top Right (Hidden in Fullscreen) */}
                                {!isFullscreen && (
                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="absolute top-6 right-6 z-50 p-2 rounded-full bg-black/40 hover:bg-white/10 border border-white/5 text-gray-300 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                )}

                                {/* MAIN SCROLLABLE CONTENT */}
                                <div className={`flex flex-col gap-4 md:gap-6 ${isFullscreen ? 'h-full' : 'p-4 md:p-8 overflow-y-auto no-scrollbar'}`}>

                                    {/* --- TOP ROW: Video + Quiz --- */}
                                    {/* Grid Layout for strict alignment */}
                                    <div className={`grid grid-cols-1 md:grid-cols-4 gap-6 ${isFullscreen ? 'h-full w-full flex flex-col md:grid' : ''}`}>

                                        <div className="col-span-1 md:col-span-3 flex flex-col gap-6">
                                            {/* LEFT: Video Player (Browser Fullscreen API handles fullscreen) */}
                                            <div
                                                ref={videoContainerRef}
                                                className="relative group bg-black shadow-2xl flex flex-col justify-center overflow-hidden transition-all duration-300 w-full rounded-2xl border border-white/10 aspect-video"
                                                style={{ touchAction: 'pan-x' }}
                                                onDoubleClick={(e) => {
                                                    e.preventDefault();
                                                    handleFullscreen();
                                                }}
                                            >
                                                <div className="relative w-full h-full">
                                                    <SmartVideoPlayer
                                                        ref={playerRef}
                                                        videoId={videoId}
                                                        title={title}
                                                        autoplay={true}
                                                        controls={false}
                                                        className="w-full h-full object-cover"
                                                        onEnded={() => {
                                                            console.log("Main Feed Video Ended");
                                                            // Close the play segment: accumulate elapsed time
                                                            if (playStartTimeRef.current > 0) {
                                                                accumulatedWatchRef.current += (Date.now() - playStartTimeRef.current) / 1000;
                                                                playStartTimeRef.current = 0;
                                                            }
                                                            setIsPlaying(false);
                                                            setIsVideoEnded(true);
                                                            sendWatchProgress();
                                                        }}
                                                        onPlay={() => {
                                                            playStartTimeRef.current = Date.now();
                                                            setIsPlaying(true);
                                                        }}
                                                        onPause={() => {
                                                            // Close the play segment: accumulate elapsed time
                                                            if (playStartTimeRef.current > 0) {
                                                                accumulatedWatchRef.current += (Date.now() - playStartTimeRef.current) / 1000;
                                                                playStartTimeRef.current = 0;
                                                            }
                                                            setIsPlaying(false);
                                                            sendWatchProgress();
                                                        }}
                                                    />

                                                    {/* VIDEO END SCREEN OVERLAY */}
                                                    <AnimatePresence>
                                                        {isVideoEnded && (
                                                            <motion.div
                                                                key="end-screen"
                                                                initial={{ opacity: 0 }}
                                                                animate={{ opacity: 1 }}
                                                                exit={{ opacity: 0 }}
                                                                className="absolute inset-0 z-30 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-5 p-6"
                                                            >
                                                                {/* Dismiss */}
                                                                <button
                                                                    onClick={() => setIsVideoEnded(false)}
                                                                    className="absolute top-3 right-3 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>

                                                                {/* Creator Links Section */}
                                                                {(customLinks?.length || channelLinks?.length) ? (
                                                                    <div className="w-full max-w-xs space-y-2">
                                                                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold text-center mb-3">From the Creator</p>
                                                                        {(customLinks?.length ? customLinks : channelLinks!).slice(0, 3).map((link, i) => (
                                                                            <a
                                                                                key={i}
                                                                                href={link.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="flex items-center gap-3 w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all group"
                                                                            >
                                                                                <ExternalLink className="w-3.5 h-3.5 text-gray-500 group-hover:text-red-400 transition-colors flex-shrink-0" />
                                                                                <span className="text-sm text-gray-200 font-medium truncate">{link.title}</span>
                                                                            </a>
                                                                        ))}
                                                                    </div>
                                                                ) : (
                                                                    <div className="text-center">
                                                                        <p className="text-sm font-bold text-white mb-1">Great watch!</p>
                                                                        <p className="text-xs text-gray-500">Now prove you got something from it.</p>
                                                                    </div>
                                                                )}

                                                                {/* Divider */}
                                                                <div className="w-full max-w-xs border-t border-white/10" />

                                                                {/* Proof of Work CTA */}
                                                                <div className="text-center space-y-3">
                                                                    <p className="text-[11px] text-gray-400 italic">{`Don't make this a "brain-porn"!`}</p>
                                                                    <button
                                                                        onClick={() => {
                                                                            setIsVideoEnded(false);
                                                                            const isMobile = window.innerWidth < 768;
                                                                            if (isMobile) {
                                                                                // Mobile: scroll to quiz panel and trigger start
                                                                                setMobileStartSignal(s => s + 1);
                                                                                setTimeout(() => {
                                                                                    quizPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                                                                }, 50);
                                                                            } else {
                                                                                setShowQuizOverlay(true);
                                                                            }
                                                                        }}
                                                                        className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] flex items-center gap-2 mx-auto"
                                                                    >
                                                                        <Zap className="w-4 h-4 fill-current" />
                                                                        Proof of Work
                                                                    </button>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>

                                                    {/* DESKTOP QUIZ OVERLAY (animates across the video on desktop) */}
                                                    <AnimatePresence>
                                                        {showQuizOverlay && (
                                                            <motion.div
                                                                key="quiz-overlay"
                                                                initial={{ opacity: 0, x: '100%' }}
                                                                animate={{ opacity: 1, x: 0 }}
                                                                exit={{ opacity: 0, x: '100%' }}
                                                                transition={{ type: 'spring', damping: 28, stiffness: 240 }}
                                                                className="absolute inset-0 z-30 bg-[#0f0f0f]/95 backdrop-blur-md hidden md:flex"
                                                                onDoubleClick={(e) => e.stopPropagation()}
                                                            >
                                                                <button
                                                                    onClick={() => setShowQuizOverlay(false)}
                                                                    className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-gray-400 hover:text-white transition-colors"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </button>
                                                                <div className="w-full h-full overflow-y-auto no-scrollbar">
                                                                    <QuizPanel videoId={videoId} takeaways={takeaways} autoStart={true} onClose={() => setShowQuizOverlay(false)} />
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>

                                                    {/* Transparent Double-Click Capture Layer */}
                                                    <div
                                                        className="absolute inset-0 z-10"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);

                                                            if (isTouch) {
                                                                if (showMobileControls) {
                                                                    setShowMobileControls(false);
                                                                    if (mobileControlsTimeoutRef.current) clearTimeout(mobileControlsTimeoutRef.current);
                                                                } else {
                                                                    setShowMobileControls(true);
                                                                    if (mobileControlsTimeoutRef.current) clearTimeout(mobileControlsTimeoutRef.current);
                                                                    mobileControlsTimeoutRef.current = setTimeout(() => {
                                                                        setShowMobileControls(false);
                                                                    }, 3000);
                                                                }
                                                                return;
                                                            }

                                                            // Use timeout to avoid conflict with double-click
                                                            const clickTimer = setTimeout(() => {
                                                                togglePlay();
                                                            }, 200);
                                                            (e.currentTarget as any).clickTimer = clickTimer;
                                                        }}
                                                        onDoubleClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            if ((e.currentTarget as any).clickTimer) {
                                                                clearTimeout((e.currentTarget as any).clickTimer);
                                                            }
                                                            handleFullscreen();
                                                        }}
                                                    />

                                                    {/* Big Play/Pause Button in the middle (Visible only when mobile controls are active) */}
                                                    <div className={`absolute inset-0 pointer-events-none flex items-center justify-center z-20 transition-opacity duration-300 ${showMobileControls ? 'opacity-100' : 'opacity-0'}`}>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                togglePlay();
                                                                if (mobileControlsTimeoutRef.current) clearTimeout(mobileControlsTimeoutRef.current);
                                                                mobileControlsTimeoutRef.current = setTimeout(() => {
                                                                    setShowMobileControls(false);
                                                                }, 3000);
                                                            }}
                                                            className={`w-16 h-16 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/70 transition-colors border border-white/20 shadow-2xl ${showMobileControls ? 'pointer-events-auto' : 'pointer-events-none'}`}
                                                        >
                                                            {isPlaying ? <Pause className="w-8 h-8 text-white fill-white" /> : <Play className="w-8 h-8 text-white fill-white ml-1" />}
                                                        </button>
                                                    </div>

                                                    {/* Custom Controls Overlay */}
                                                    <div
                                                        className={`absolute inset-0 pointer-events-none flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent transition-opacity duration-300 ${showMobileControls ? 'opacity-100' : 'opacity-0 md:opacity-0 md:group-hover:opacity-100'}`}
                                                    >

                                                        {/* Bottom Controls Container */}
                                                        <div className="w-full flex flex-col gap-2 pb-6 px-6 pointer-events-auto z-20">

                                                            {/* Progress Bar - Above Buttons */}
                                                            <div className="group/progress relative w-full h-4 flex items-center cursor-pointer touch-none">
                                                                {/* Background Track */}
                                                                <div className="absolute left-0 right-0 h-1 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm group-hover/progress:h-1.5 transition-all">
                                                                    {/* Buffered/Red Progress */}
                                                                    <div
                                                                        className="absolute left-0 top-0 bottom-0 bg-red-600"
                                                                        style={{ width: `${progress}%` }}
                                                                    />
                                                                </div>

                                                                {/* Interactive Input (Invisible but handles drag) */}
                                                                <input
                                                                    type="range"
                                                                    min="0"
                                                                    max="100"
                                                                    step="0.01"
                                                                    value={progress}
                                                                    onChange={handleSeek}
                                                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-40"
                                                                />

                                                                {/* Visible Thumb (Follows Progress) */}
                                                                <div
                                                                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.6)] border-2 border-white scale-0 group-hover/progress:scale-100 transition-transform duration-200 ease-out pointer-events-none z-50 origin-center"
                                                                    style={{ left: `${progress}%` }}
                                                                />
                                                            </div>

                                                            {/* Buttons Row */}
                                                            <div className="flex items-center justify-between">

                                                                {/* Left Side: Play | Volume | Time Pill */}
                                                                <div className="flex items-center gap-4">

                                                                    {/* Play Button - Circle */}
                                                                    <button
                                                                        onClick={togglePlay}
                                                                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/10 shadow-lg"
                                                                    >
                                                                        {isPlaying ? <Pause className="w-5 h-5 text-white fill-white" /> : <Play className="w-5 h-5 text-white fill-white ml-0.5" />}
                                                                    </button>

                                                                    {/* Volume Button - Circle */}
                                                                    <div
                                                                        className="relative flex items-center"
                                                                        onMouseEnter={handleVolumeEnter}
                                                                        onMouseLeave={handleVolumeLeave}
                                                                    >
                                                                        <button
                                                                            onClick={toggleMute}
                                                                            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/10 shadow-lg"
                                                                        >
                                                                            {isMuted || volume === 0 ? <VolumeX className="w-5 h-5 text-white" /> : <Volume2 className="w-5 h-5 text-white" />}
                                                                        </button>

                                                                        {/* Vertical Slider Popover */}
                                                                        <AnimatePresence>
                                                                            {showVolumeSlider && (
                                                                                <div
                                                                                    className="absolute bottom-full left-0 mb-2 p-2 bg-black/90 border border-white/10 rounded-full backdrop-blur-md flex flex-col items-center shadow-xl"
                                                                                >
                                                                                    <input
                                                                                        type="range"
                                                                                        min="0"
                                                                                        max="100"
                                                                                        value={isMuted ? 0 : volume}
                                                                                        onChange={handleVolumeChange}
                                                                                        className="h-24 w-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white writing-mode-vertical"
                                                                                        style={{ writingMode: 'vertical-lr', direction: 'rtl' } as any}
                                                                                    />
                                                                                </div>
                                                                            )}
                                                                        </AnimatePresence>
                                                                    </div>

                                                                    {/* Time Pill: 0:05 / 9:50 */}
                                                                    <div className="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-xs font-medium text-white font-mono flex items-center gap-1 shadow-lg">
                                                                        <span className="text-white/90">{formatTime(currentTime)}</span>
                                                                        <span className="text-white/40">/</span>
                                                                        <span className="text-white/60">{formatTime(duration)}</span>
                                                                    </div>
                                                                </div>

                                                                {/* Right Side: Speed | Fullscreen */}
                                                                <div className="flex items-center gap-3">
                                                                    <button
                                                                        onClick={toggleSpeed}
                                                                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all shadow-lg ${playbackRate === 1.5
                                                                            ? 'bg-red-600 border-red-500 text-white'
                                                                            : 'bg-white/20 border-white/10 text-white hover:bg-white/30'
                                                                            }`}
                                                                    >
                                                                        1.5x
                                                                    </button>

                                                                    <button
                                                                        onClick={handleFullscreen}
                                                                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center hover:bg-white/30 transition-colors border border-white/10 shadow-lg"
                                                                    >
                                                                        {isFullscreen ? <X className="w-5 h-5 text-white" /> : <Maximize2 className="w-5 h-5 text-white" />}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Description & Links (Moved OUT of Video Container) */}
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="text-2xl font-bold text-white leading-tight">{title}</h3>
                                                </div>

                                                <div className="flex items-center gap-2 text-sm text-gray-500 font-medium mb-2">
                                                    {channelUrl ? (
                                                        <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="hover:text-red-400 transition-colors uppercase tracking-wider">
                                                            {channelTitle || 'Unknown Channel'}
                                                        </a>
                                                    ) : (
                                                        <span className="uppercase tracking-wider">{channelTitle || 'Unknown Channel'}</span>
                                                    )}
                                                    {publishedAt && (
                                                        <>
                                                            <span>•</span>
                                                            <span>{new Date(publishedAt).toLocaleDateString()}</span>
                                                        </>
                                                    )}
                                                </div>

                                                {/* Description & Links - Priority Display */}
                                                <div className="text-sm text-gray-300 leading-relaxed">
                                                    {/* First line: video desc OR channel desc (truncated) */}
                                                    {firstLineText ? (
                                                        <>
                                                            <span>
                                                                {isDescriptionOpen
                                                                    ? decodeText(firstLineText)
                                                                    : decodeText(firstLineText.substring(0, 100) + (firstLineText.length > 100 ? '...' : ''))
                                                                }
                                                            </span>
                                                            {' '}
                                                        </>
                                                    ) : null}
                                                    {/* More/Less button */}
                                                    {(hasExpandableContent || !hasAnything) && (
                                                        <button
                                                            onClick={() => setIsDescriptionOpen(!isDescriptionOpen)}
                                                            className="text-red-400 hover:text-red-300 inline-flex items-center gap-1 transition-colors text-sm font-medium"
                                                        >
                                                            {isDescriptionOpen ? "Less" : "More"}
                                                            <ChevronDown className={`w-3 h-3 transition-transform ${isDescriptionOpen ? 'rotate-180' : ''}`} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* Expanded Content */}
                                                <AnimatePresence>
                                                    {isDescriptionOpen && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="space-y-4 mt-3"
                                                        >
                                                            {/* 1. Video-specific links */}
                                                            {hasVideoLinks && (
                                                                <div className="space-y-2">
                                                                    {customLinks!.map((link, i) => (
                                                                        <div key={`vl-${i}`} className="space-y-1">
                                                                            <div className="text-sm font-semibold text-white flex items-center gap-2">
                                                                                <ExternalLink className="w-3.5 h-3.5 text-red-500" />
                                                                                {link.title}
                                                                            </div>
                                                                            <a
                                                                                href={link.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-xs text-blue-400 hover:text-blue-300 hover:underline break-all block pl-6"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                {link.url}
                                                                            </a>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* 2. Channel description (only shown on expand if video desc was the first line) */}
                                                            {hasVideoDesc && hasChannelDesc && (
                                                                <div className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap border-t border-white/5 pt-3">
                                                                    <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold block mb-1">About this channel</span>
                                                                    {decodeText(channelDescription!)}
                                                                </div>
                                                            )}

                                                            {/* 3. Channel links */}
                                                            {hasChannelLinks && (
                                                                <div className="space-y-2 border-t border-white/5 pt-3">
                                                                    {channelLinks!.map((link, i) => (
                                                                        <div key={`cl-${i}`} className="space-y-1">
                                                                            <div className="text-sm font-semibold text-white flex items-center gap-2">
                                                                                <ExternalLink className="w-3.5 h-3.5 text-red-500" />
                                                                                {link.title}
                                                                            </div>
                                                                            <a
                                                                                href={link.url}
                                                                                target="_blank"
                                                                                rel="noopener noreferrer"
                                                                                className="text-xs text-blue-400 hover:text-blue-300 hover:underline break-all block pl-6"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                            >
                                                                                {link.url}
                                                                            </a>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* 4. Unclaimed channel prompt */}
                                                            {!hasAnything && !isChannelClaimed && (
                                                                <div className="text-sm text-gray-500 italic">
                                                                    This creator hasn&apos;t claimed their channel yet. Help us by prompting them to join Veritas!
                                                                    {channelUrl && (
                                                                        <a
                                                                            href={channelUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="text-red-400 hover:text-red-300 hover:underline ml-1"
                                                                            onClick={(e) => e.stopPropagation()}
                                                                        >
                                                                            Visit their YouTube channel →
                                                                        </a>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Divider */}
                                            <div className="h-px w-full bg-white/5" />

                                            {/* Comments Section - ALWAYS VISIBLE */}
                                            <div className="space-y-6">
                                                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Comments</h3>

                                                <div className="space-y-6">
                                                    {/* 1. Add Comment Input (Top) */}
                                                    <div className="flex gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-red-900/20 border border-red-500/20 flex items-center justify-center">
                                                            <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                                        </div>
                                                        <div className="flex-1 relative">
                                                            <input
                                                                type="text"
                                                                value={newComment}
                                                                onChange={(e) => setNewComment(e.target.value)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter' && !isPostingComment) handlePostComment();
                                                                }}
                                                                placeholder="Add a comment..."
                                                                className="w-full bg-transparent border-b border-white/10 pb-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-700 pr-8"
                                                            />
                                                            <button
                                                                onClick={handlePostComment}
                                                                disabled={!newComment.trim() || isPostingComment}
                                                                className="absolute right-0 bottom-2 text-gray-500 hover:text-white disabled:opacity-30 transition-colors"
                                                            >
                                                                {isPostingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* 2. Comments List */}
                                                    <div className="space-y-4">
                                                        {comments.map((comment) => (
                                                            <div key={comment.id} className="flex gap-3 group">
                                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-xs font-bold text-gray-400 border border-white/5">
                                                                    {(comment.user_name || '?').charAt(0).toUpperCase()}
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-baseline gap-2 mb-1">
                                                                        <span className={`text-sm font-semibold ${comment.user_name === 'You' ? 'text-red-400' : 'text-gray-200'}`}>
                                                                            {comment.user_name || 'Community Member'}
                                                                        </span>
                                                                        <span className="text-[10px] text-gray-600">
                                                                            {new Date(comment.created_at).toLocaleDateString()}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-sm text-gray-400 leading-relaxed font-light">
                                                                        {comment.text}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {/* Empty State */}
                                                        {comments.length === 0 && !isLoadingComments && (
                                                            <div className="text-center py-4">
                                                                <p className="text-xs text-gray-600 italic">No comments yet. Be the first to share your thoughts.</p>
                                                            </div>
                                                        )}

                                                        {/* Load More Button */}
                                                        {hasMoreComments && (
                                                            <button
                                                                onClick={handleLoadMoreComments}
                                                                disabled={isLoadingComments}
                                                                className="w-full py-2 flex items-center justify-center gap-2 text-xs font-bold text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                                                            >
                                                                {isLoadingComments ? (
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                ) : (
                                                                    <>
                                                                        <span>Show more comments</span>
                                                                        <ChevronDown className="w-3 h-3" />
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div > {/* End col-span-3 Wrapper */}

                                        {/* RIGHT: Proof of Work Quiz Box (mobile: full width below video; desktop: right column; NOT shown when overlay is active) */}
                                        {!isFullscreen && !showQuizOverlay && (
                                            <div ref={quizPanelRef} className="col-span-1">
                                                <QuizPanel
                                                    videoId={videoId}
                                                    takeaways={takeaways}
                                                    onOpenOverlay={() => setShowQuizOverlay(true)}
                                                    mobileStartSignal={mobileStartSignal}
                                                />
                                            </div>
                                        )}

                                    </div> {/* End Grid */}
                                </div> {/* End Scrollable */}
                            </motion.div> {/* End Card */}
                        </div> {/* End Modal Wrapper */}
                    </>)}
            </AnimatePresence>
        </>
    );
}

// ==========================================
// QuizPanel — "Proof of Work" Quiz Component
// ==========================================
type QuizQuestion = {
    id: string;
    lesson_number: number;
    skill_tag: string;
    question_text: string;
};

type QuizState = 'cta' | 'loading' | 'active' | 'feedback' | 'complete' | 'no-questions';

function QuizPanel({ videoId, takeaways, autoStart, onClose, onOpenOverlay, mobileStartSignal }: {
    videoId: string;
    takeaways: string[];
    autoStart?: boolean;
    onClose?: () => void;
    onOpenOverlay?: () => void;
    mobileStartSignal?: number;
}) {
    const [quizState, setQuizState] = useState<QuizState>(autoStart ? 'loading' : 'cta');
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    // batch 0 = first 3 questions (indices 0-2), batch 1 = second 3 (indices 3-5)
    const [batch, setBatch] = useState(0);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswer, setUserAnswer] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [feedback, setFeedback] = useState<{ passed: boolean; confidence: string; feedback: string } | null>(null);
    const [passedCount, setPassedCount] = useState(0);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const submitBtnRef = useRef<HTMLButtonElement>(null);

    // Resolve the current user UUID on mount (Viewer or Creator)
    useEffect(() => {
        const resolveUser = async () => {
            const realUserId = await getCurrentUserId();
            if (realUserId) {
                setResolvedUserId(realUserId);
            }
        };
        resolveUser();
    }, []);

    // If autoStart, immediately try to load questions
    useEffect(() => {
        if (autoStart) handleStartQuiz();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoStart]);

    // Mobile: trigger quiz start when parent signals (from end screen)
    useEffect(() => {
        if (mobileStartSignal && mobileStartSignal > 0 && quizState === 'cta') {
            handleStartQuiz();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mobileStartSignal]);

    const handleStartQuiz = async () => {
        setQuizState('loading');
        try {
            const data = await getQuizQuestions(videoId);

            if (!data || data.length === 0) {
                setQuizState('no-questions');
                return;
            }

            setQuestions(data);
            setBatch(0);
            setCurrentIndex(0);
            setPassedCount(0);
            setQuizState('active');
            setTimeout(() => inputRef.current?.focus(), 300);
        } catch (err) {
            console.error('Failed to load quiz:', err);
            setQuizState('no-questions');
        }
    };

    const handleSubmitAnswer = async () => {
        if (!userAnswer.trim() || isSubmitting) return;
        setIsSubmitting(true);

        // Real index into questions array: batch 0 uses 0-2, batch 1 uses 3-5
        const realIndex = batch * 3 + currentIndex;
        const currentQ = questions[realIndex];
        try {
            const res = await fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: resolvedUserId || 'anonymous',
                    video_id: videoId,
                    topic: currentQ.skill_tag,
                    question: currentQ.question_text,
                    user_answer: userAnswer,
                }),
            });
            const data = await res.json();
            setFeedback({
                passed: data.passed ?? true,
                confidence: data.confidence || 'low',
                feedback: data.feedback || 'Great effort!',
            });
            if (data.passed) setPassedCount(p => p + 1);
            setQuizState('feedback');
        } catch (err) {
            console.error('Quiz submit error:', err);
            setFeedback({ passed: true, confidence: 'low', feedback: 'Great effort! Keep going.' });
            setQuizState('feedback');
        }
        setIsSubmitting(false);
    };

    const handleNext = () => {
        setUserAnswer('');
        setFeedback(null);
        // Move to next question in current batch (0, 1, 2 per batch)
        if (currentIndex < 2) {
            setCurrentIndex(i => i + 1);
            setQuizState('active');
            setTimeout(() => inputRef.current?.focus(), 200);
        } else {
            // End of current batch (question 3 of this batch answered)
            setQuizState('complete');
        }
    };

    const handleLoadMore = async () => {
        setIsLoadingMore(true);
        try {
            // Switch to batch 1 (questions at indices 3-5)
            if (questions.length > 3) {
                setBatch(1);
                setCurrentIndex(0);
                setPassedCount(0);
                setUserAnswer(''); // Clear text input for new batch
                setFeedback(null);
                setQuizState('active');
                setTimeout(() => inputRef.current?.focus(), 300);
            } else {
                console.log('No extra questions available for this video.');
            }
        } catch (err) {
            console.error('Load more error:', err);
        }
        setIsLoadingMore(false);
    };

    // The question currently displayed
    const realIndex = batch * 3 + currentIndex;
    const currentQ = questions[realIndex];

    // Tier colors for the skill tag badge
    const getTagColor = (tag: string) => {
        const colors: Record<string, string> = {
            'Sales': 'bg-orange-500/20 text-orange-300 border-orange-500/30',
            'Copywriting': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
            'Marketing Psychology': 'bg-pink-500/20 text-pink-300 border-pink-500/30',
            'AI/Automation': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
            'Content Creation': 'bg-green-500/20 text-green-300 border-green-500/30',
            'Outreach': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
            'Time Management': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
            'VibeCoding/Architecture': 'bg-red-500/20 text-red-300 border-red-500/30',
        };
        return colors[tag] || 'bg-white/10 text-gray-300 border-white/20';
    };

    // On desktop: clicking CTA opens overlay instead of staying in panel
    const handleDesktopCta = () => {
        if (onOpenOverlay && window.innerWidth >= 768) {
            onOpenOverlay();
        } else {
            handleStartQuiz();
        }
    };

    return (
        <div className="col-span-1 md:col-span-1 pb-72 md:pb-0">
            <div className="w-full bg-white/[0.03] backdrop-blur-sm rounded-2xl border border-white/5 flex flex-col relative overflow-hidden">
                {/* Background noise */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none" />

                <div className="relative z-10 p-5">
                    <AnimatePresence mode="wait">
                        {/* === CTA STATE === */}
                        {quizState === 'cta' && (
                            <motion.div
                                key="cta"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center text-center gap-4 py-6"
                            >
                                <motion.div
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-red-900 shadow-[0_0_30px_rgba(220,38,38,0.4)] flex items-center justify-center"
                                >
                                    <Brain className="w-8 h-8 text-white" />
                                </motion.div>

                                <div>
                                    <p className="text-xs text-gray-400 mb-1 italic">{`Don't make this a "brain-porn"!`}</p>
                                    <h3 className="text-lg font-bold text-white">Claim your knowledge!</h3>
                                </div>

                                <p className="text-[11px] text-gray-500 max-w-[180px]">
                                    In 3 minutes get 50x more from watching this video
                                </p>

                                <button
                                    onClick={handleDesktopCta}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white text-sm font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] flex items-center gap-2 active:scale-95"
                                >
                                    <Zap className="w-4 h-4 fill-current" />
                                    Proof of Work
                                </button>
                            </motion.div>
                        )}

                        {/* === LOADING STATE === */}
                        {quizState === 'loading' && (
                            <motion.div
                                key="loading"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-12 gap-3"
                            >
                                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                                <p className="text-xs text-gray-500">Loading your quiz...</p>
                            </motion.div>
                        )}

                        {/* === NO QUESTIONS STATE === */}
                        {quizState === 'no-questions' && (
                            <motion.div
                                key="no-q"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center justify-center py-8 gap-3 text-center"
                            >
                                <Brain className="w-10 h-10 text-gray-600" />
                                <p className="text-sm text-gray-400">Quiz questions are being generated...</p>
                                <p className="text-xs text-gray-600">Check back in a moment!</p>
                                <button
                                    onClick={() => setQuizState('cta')}
                                    className="mt-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                                >
                                    Try again
                                </button>
                            </motion.div>
                        )}

                        {/* === ACTIVE QUIZ STATE === */}
                        {quizState === 'active' && currentQ && (
                            <motion.div
                                key={`q-${batch}-${currentIndex}`}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex flex-col gap-4"
                            >
                                {/* Progress indicator */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                        Question {currentIndex + 1} of {Math.min(3, questions.length - batch * 3)}
                                    </span>
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getTagColor(currentQ.skill_tag)}`}>
                                        {currentQ.skill_tag}
                                    </span>
                                </div>

                                {/* Progress dots */}
                                <div className="flex gap-1.5">
                                    {Array.from({ length: Math.min(3, questions.length - batch * 3) }).map((_, i) => (
                                        <div
                                            key={i}
                                            className={`h-1 flex-1 rounded-full transition-all duration-300 ${i < currentIndex ? 'bg-green-500'
                                                : i === currentIndex ? 'bg-red-500'
                                                    : 'bg-white/10'
                                                }`}
                                        />
                                    ))}
                                </div>

                                {/* Question */}
                                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                                    {currentQ.question_text}
                                </p>

                                {/* Answer Input */}
                                <textarea
                                    ref={inputRef}
                                    value={userAnswer}
                                    onChange={(e) => setUserAnswer(e.target.value)}
                                    onFocus={() => {
                                        setTimeout(() => {
                                            submitBtnRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                        }, 400); // Wait for mobile keyboard to fully transition before scrolling
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmitAnswer();
                                        }
                                    }}
                                    placeholder="Type your answer..."
                                    rows={5}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 resize-none caret-red-500 transition-all duration-300"
                                />

                                {/* Submit Button */}
                                <button
                                    ref={submitBtnRef}
                                    onClick={handleSubmitAnswer}
                                    disabled={!userAnswer.trim() || isSubmitting}
                                    className="w-full py-2.5 bg-red-600 hover:bg-red-500 disabled:bg-gray-800 disabled:text-gray-600 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Evaluating...
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            Submit Answer
                                        </>
                                    )}
                                </button>
                            </motion.div>
                        )}

                        {/* === FEEDBACK STATE === */}
                        {quizState === 'feedback' && feedback && (
                            <motion.div
                                key={`fb-${currentIndex}`}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col gap-4"
                            >
                                {/* Pass/Fail Header */}
                                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${feedback.passed
                                    ? 'bg-green-500/10 border border-green-500/20'
                                    : 'bg-red-500/10 border border-red-500/20'
                                    }`}>
                                    {feedback.passed ? (
                                        <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                                    ) : (
                                        <X className="w-5 h-5 text-red-400 flex-shrink-0" />
                                    )}
                                    <span className={`text-sm font-bold ${feedback.passed ? 'text-green-300' : 'text-red-300'}`}>
                                        {feedback.passed ? 'Passed!' : ''}
                                    </span>
                                    {feedback.confidence === 'high' && (
                                        <Trophy className="w-4 h-4 text-yellow-400 ml-auto" />
                                    )}
                                </div>

                                {/* AI Feedback */}
                                <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                                    <p className="text-sm text-gray-300 leading-relaxed italic">
                                        {`"${feedback.feedback}"`}
                                    </p>
                                </div>

                                {/* Skill tag earned */}
                                {feedback.passed && currentQ && (
                                    <div className="flex items-center gap-2 text-xs text-gray-500">
                                        <Sparkles className="w-3 h-3 text-yellow-400" />
                                        <span>+1 to <span className="text-white font-medium">{currentQ.skill_tag}</span></span>
                                    </div>
                                )}

                                {/* Next Button or End of Batch Actions */}
                                {!((batch === 0 && currentIndex === 2) || (batch === 1 && currentIndex === questions.length - 4) || (currentIndex + 1 === questions.length) || (currentIndex === 2 && batch === 1)) ? (
                                    <button
                                        onClick={handleNext}
                                        className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                    >
                                        Next Question <ArrowRight className="w-4 h-4" />
                                    </button>
                                ) : (
                                    <div className="flex flex-col gap-2 w-full mt-4">
                                        {/* +3 More Questions Button */}
                                        {questions.length > 3 && batch === 0 && (
                                            <button
                                                onClick={handleLoadMore}
                                                disabled={isLoadingMore}
                                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                                            >
                                                {isLoadingMore ? (
                                                    <>
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                        Loading...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-4 h-4" />
                                                        I like this, give me 3 more!
                                                    </>
                                                )}
                                            </button>
                                        )}

                                        {/* Save to Profile Button */}
                                        <button
                                            onClick={handleNext}
                                            className="w-full py-3 bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            Save to my profile <Trophy className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* === COMPLETE STATE === */}
                        {quizState === 'complete' && (
                            <motion.div
                                key="complete"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0 }}
                                className="flex flex-col items-center text-center gap-4 py-4"
                            >
                                <motion.div
                                    initial={{ rotate: 0 }}
                                    animate={{ rotate: [0, -10, 10, 0] }}
                                    transition={{ duration: 0.5, delay: 0.2 }}
                                >
                                    <Trophy className="w-12 h-12 text-yellow-400" />
                                </motion.div>

                                <div>
                                    <h3 className="text-lg font-bold text-white mb-1">Quiz Complete!</h3>
                                    <p className="text-sm text-gray-400">Your answers have been recorded. Keep going!</p>
                                </div>

                                {/* Back to CTA */}
                                <button
                                    onClick={() => { setQuizState('cta'); setBatch(0); setCurrentIndex(0); setPassedCount(0); }}
                                    className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
                                >
                                    Done
                                </button>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}

