"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Brain, CheckCircle2, Volume2, Maximize2, Pause, VolumeX, Send, Loader2, ChevronDown } from 'lucide-react';
import SmartVideoPlayer, { SmartVideoPlayerRef } from './SmartVideoPlayer';
import { getComments, postComment } from '@/app/actions/video-actions';

interface VideoCardProps {
    videoId: string;
    title: string;
    humanScore: number;
    takeaways: string[];
    description?: string;
    channelTitle?: string;
    channelUrl?: string;
    publishedAt?: string;
    onQuizStart: () => void;
}



export default function VideoCard({ videoId, title, humanScore, takeaways, description, channelTitle, channelUrl, publishedAt, onQuizStart }: VideoCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);

    // Player State
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 100
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [playbackRate, setPlaybackRate] = useState(1);
    const [volume, setVolume] = useState(100);
    const [isMuted, setIsMuted] = useState(false);
    const [showVolumeSlider, setShowVolumeSlider] = useState(false);

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

    // Progress Loop
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isOpen && isPlaying) {
            interval = setInterval(() => {
                if (playerRef.current) {
                    const curr = playerRef.current.getCurrentTime();
                    const dur = playerRef.current.getDuration();
                    setCurrentTime(curr);
                    setDuration(dur);
                    if (dur > 0) {
                        setProgress((curr / dur) * 100);
                    }
                }
            }, 500); // Update every 500ms
        }
        return () => clearInterval(interval);
    }, [isOpen, isPlaying]);

    // Load Initial Comments
    useEffect(() => {
        if (isOpen) {
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
                onClick={() => setIsOpen(true)}
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
                <div className="p-5">
                    {/* Score Label above Headline */}
                    <div className="flex items-center justify-between mb-2">
                        <span className={`text-[10px] font-bold tracking-wider uppercase ${humanScore > 90 ? 'text-green-500' : 'text-yellow-500'}`}>
                            {humanScore}% Human Verified
                        </span>
                    </div>

                    <h3 className="text-lg font-bold text-gray-100 line-clamp-2 leading-tight mb-4 group-hover:text-red-400 transition-colors">
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
                    isOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">

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
                                        : 'w-full max-w-6xl rounded-[32px] bg-[#1a1a1a]/60 backdrop-blur-3xl border border-white/10 max-h-[95vh]'
                                    }
                            `}
                                onClick={(e) => e.stopPropagation()}
                            >
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
                                <div className={`flex flex-col gap-6 ${isFullscreen ? 'h-full' : 'p-8 overflow-y-auto no-scrollbar'}`}>

                                    {/* --- TOP ROW: Video + Quiz --- */}
                                    {/* Grid Layout for strict alignment */}
                                    <div className={`grid grid-cols-1 md:grid-cols-4 gap-6 ${isFullscreen ? 'h-full w-full flex flex-col md:grid' : ''}`}>

                                        {/* LEFT: Video Player (Browser Fullscreen API handles fullscreen) */}
                                        <div
                                            ref={videoContainerRef}
                                            className="col-span-3 relative group bg-black shadow-2xl flex flex-col justify-center overflow-hidden transition-all duration-300 w-full rounded-2xl border border-white/10 aspect-video"
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
                                                        setIsPlaying(false);
                                                    }}
                                                    onPlay={() => setIsPlaying(true)}
                                                    onPause={() => setIsPlaying(false)}
                                                />

                                                {/* Transparent Double-Click Capture Layer */}
                                                <div
                                                    className="absolute inset-0 z-10"
                                                    onClick={(e) => {
                                                        e.preventDefault();
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

                                                {/* Custom Controls Overlay */}
                                                <div
                                                    className="absolute inset-0 pointer-events-none flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
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
                                                                    onMouseEnter={() => setShowVolumeSlider(true)}
                                                                    onMouseLeave={() => setShowVolumeSlider(false)}
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
                                                                            <div className="absolute bottom-full left-0 mb-2 p-2 bg-black/90 border border-white/10 rounded-full backdrop-blur-md flex flex-col items-center shadow-xl">
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

                                        {/* RIGHT: Quiz Box (Takes 1 col, Matches Height) */}
                                        {!isFullscreen && (
                                            <div className="col-span-1 h-full w-full flex">
                                                <div
                                                    className="w-full flex-1 p-6 rounded-2xl bg-white/5 border border-white/5 relative overflow-hidden group/quiz cursor-pointer hover:border-red-500/40 hover:bg-white/10 transition-all duration-300 flex flex-col justify-between"
                                                    onClick={onQuizStart}
                                                >
                                                    <div className="absolute top-4 right-4 opacity-30">
                                                        <Brain className="w-10 h-10 text-gray-500" />
                                                    </div>

                                                    <div className="mt-6">
                                                        <div className="text-[10px] font-mono text-gray-400 tracking-wider mb-2 uppercase">Active Recall</div>
                                                        <h3 className="text-xl font-bold text-white mb-2 leading-tight">
                                                            What did <br /> you learn?
                                                        </h3>
                                                        <p className="text-xs text-gray-400 font-light leading-relaxed">
                                                            Tap to start a quick 3-question assessment to verify your knowledge.
                                                        </p>
                                                    </div>

                                                    <div className="flex items-center gap-2 text-red-400 text-xs font-bold group-hover/quiz:translate-x-1 transition-transform mt-4">
                                                        <Brain className="w-3 h-3" />
                                                        <span>Start Quiz</span>
                                                    </div>

                                                    {/* Abstract Decor */}
                                                    <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-red-600/10 rounded-full blur-3xl group-hover/quiz:bg-red-600/20 transition-colors" />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* --- BOTTOM ROW: INSIGHTS & ACTIONS --- */}
                                    {!isFullscreen && (
                                        <div className="flex flex-col gap-8 w-full md:w-3/4">

                                            {/* Info & Links Bar */}
                                            <div className="flex flex-col gap-4">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <h2 className="text-2xl font-bold text-white leading-tight mb-2">{title}</h2>
                                                        <div className="flex items-center gap-3">
                                                            <div className={`px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 border border-white/10 ${humanScore > 90 ? 'text-green-400' : 'text-yellow-400'}`}>
                                                                {humanScore}% HUMAN
                                                            </div>
                                                            <span className="text-xs text-gray-500">•</span>
                                                            <span className="text-xs text-gray-500">•</span>

                                                            {channelUrl ? (
                                                                <a
                                                                    href={channelUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-xs text-blue-400 hover:text-blue-300 hover:underline uppercase tracking-wide font-bold"
                                                                >
                                                                    {channelTitle || 'Unknown Channel'}
                                                                </a>
                                                            ) : (
                                                                <span className="text-xs text-gray-400 uppercase tracking-wide font-bold">{channelTitle || 'Unknown Channel'}</span>
                                                            )}

                                                            {publishedAt && (
                                                                <>
                                                                    <span className="text-xs text-gray-500">•</span>
                                                                    <span className="text-xs text-gray-500">{new Date(publishedAt).toLocaleDateString()}</span>
                                                                </>
                                                            )}
                                                            <span className="text-xs text-gray-500">•</span>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); setIsDescriptionOpen(!isDescriptionOpen); }}
                                                                className="text-xs text-gray-400 hover:text-white transition-colors font-medium">
                                                                {isDescriptionOpen ? "Less..." : "More..."}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Collapsible Description & Links */}
                                                <AnimatePresence>
                                                    {isDescriptionOpen && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="overflow-hidden"
                                                        >
                                                            <p className="text-sm text-gray-400 leading-relaxed max-w-2xl whitespace-pre-wrap">
                                                                {description ? (
                                                                    description.split(/(https?:\/\/[^\s]+)/g).map((part, i) => {
                                                                        if (part.match(/(https?:\/\/[^\s]+)/g)) {
                                                                            return (
                                                                                <a
                                                                                    key={i}
                                                                                    href={part}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    className="text-blue-400 hover:text-blue-300 hover:underline break-all"
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                >
                                                                                    {part}
                                                                                </a>
                                                                            );
                                                                        }
                                                                        return part;
                                                                    })
                                                                ) : (
                                                                    "In this video, we break down the fundamental principles of acquisition. The 'Rule of 100' states that you must commit to 100 primary actions simply to get your first result. It is not about skill, it is about volume."
                                                                )}
                                                            </p>
                                                            <div className="mt-4 flex flex-col gap-2">
                                                                <a href="#" className="text-sm text-blue-400 hover:underline flex items-center gap-2">
                                                                    <span>→</span> Check out the full course
                                                                </a>
                                                                <a href="#" className="text-sm text-blue-400 hover:underline flex items-center gap-2">
                                                                    <span>→</span> Follow on Twitter
                                                                </a>
                                                            </div>
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
                                        </div>
                                    )}

                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >
        </>
    );
}
