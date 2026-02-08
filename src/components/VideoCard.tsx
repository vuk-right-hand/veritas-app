"use client";

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, X, Brain, CheckCircle2, Volume2, Maximize2 } from 'lucide-react';
import SmartVideoPlayer from './SmartVideoPlayer';

interface VideoCardProps {
    videoId: string;
    title: string;
    humanScore: number;
    takeaways: string[];
    description?: string;
    onQuizStart: () => void;
}

// Mock Comments
const MOCK_COMMENTS = [
    { id: 1, user: "Sarah Jenkins", text: "This completely changed how I look at outreach. The Rule of 100 is gold.", time: "2h ago" },
    { id: 2, user: "DevMaster", text: "Finally someone verifying the content. Sick of AI generated fluff.", time: "5h ago" },
    { id: 3, user: "MindsetKing", text: "The point about selling implementation vs information is subtle but deep.", time: "1d ago" },
];

export default function VideoCard({ videoId, title, humanScore, takeaways, description, onQuizStart }: VideoCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isFullscreen) {
                    setIsFullscreen(false);
                } else {
                    setIsOpen(false);
                }
            }
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isFullscreen]);

    const handleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
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
            </motion.div>


            {/* Expanded State (The Glass Modal) */}
            <AnimatePresence>
                {isOpen && (
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
                                <div className={`flex flex-col md:flex-row gap-6 items-stretch ${isFullscreen ? 'h-full w-full' : 'min-h-[400px]'}`}>

                                    {/* LEFT: Video Player */}
                                    <div
                                        ref={videoContainerRef}
                                        className={`
                                            relative group overflow-hidden bg-black shadow-2xl flex-shrink-0 transition-all duration-500
                                            ${isFullscreen
                                                ? 'w-full h-full rounded-none flex items-center justify-center'
                                                : 'w-full md:w-3/4 rounded-2xl border border-white/10'
                                            }
                                        `}
                                    >
                                        <div className={`w-full ${isFullscreen ? 'h-full' : 'h-full absolute inset-0'}`}>
                                            <SmartVideoPlayer
                                                videoId={videoId}
                                                title={title}
                                                autoplay={true}
                                                controls={false}
                                                className="w-full h-full object-contain"
                                                onEnded={() => {
                                                    // Placeholder: Logic for "End of Video" popup 
                                                    console.log("Main Feed Video Ended");
                                                    alert("Video Finished! Show Creator Links?");
                                                }}
                                            />
                                        </div>

                                        {/* Aspect Ratio spacer for normal view only */}
                                        {!isFullscreen && <div className="pt-[56.25%] pointer-events-none"></div>}

                                        {/* Custom Controls Overlay */}
                                        <div className="absolute bottom-6 right-8 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-auto z-10">
                                            <button className="px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-xs font-bold text-white hover:bg-white/20 transition-colors">
                                                1.5x
                                            </button>
                                            <button className="p-2 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-colors">
                                                <Volume2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={handleFullscreen}
                                                className="p-2 rounded-lg bg-black/80 backdrop-blur-md border border-white/10 text-white hover:bg-white/20 transition-colors"
                                            >
                                                {isFullscreen ? <X className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* RIGHT: Quiz Box (Hidden in Fullscreen) */}
                                    {!isFullscreen && (
                                        <div className="w-full md:w-1/4 flex">
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

                                {/* --- BOTTOM ROW: INSIGHTS (Hidden in Fullscreen) --- */}
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
                                                        <a href="#" className="text-xs text-blue-400 hover:text-blue-300 hover:underline">
                                                            Join Newsletter
                                                        </a>
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
                                                        <p className="text-sm text-gray-400 leading-relaxed max-w-2xl">
                                                            {description || "In this video, we break down the fundamental principles of acquisition. The 'Rule of 100' states that you must commit to 100 primary actions simply to get your first result. It is not about skill, it is about volume."}
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

                                            <div className="space-y-4">
                                                {MOCK_COMMENTS.map((comment) => (
                                                    <div key={comment.id} className="flex gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center text-xs font-bold text-white border border-white/10">
                                                            {comment.user.charAt(0)}
                                                        </div>
                                                        <div className="flex-1">
                                                            <div className="flex items-baseline gap-2 mb-1">
                                                                <span className="text-sm font-semibold text-gray-200">{comment.user}</span>
                                                                <span className="text-[10px] text-gray-600">{comment.time}</span>
                                                            </div>
                                                            <p className="text-sm text-gray-400 leading-relaxed font-light">
                                                                {comment.text}
                                                            </p>
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Add Comment Input Mock */}
                                                <div className="flex gap-3 mt-6 pt-6 border-t border-white/5">
                                                    <div className="w-8 h-8 rounded-full bg-red-900/20 border border-red-500/20" />
                                                    <div className="flex-1">
                                                        <input
                                                            type="text"
                                                            placeholder="Add a comment..."
                                                            className="w-full bg-transparent border-b border-white/10 pb-2 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-700"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
}
