"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageSquare, Send, Sparkles, AlertCircle, CheckCircle2, XCircle, Box, MoreVertical, Trash2, Calendar, Lightbulb } from 'lucide-react';
import SmartVideoPlayer from '@/components/SmartVideoPlayer';
import FeatureRequestModal from '@/components/FeatureRequestModal';
import { getPendingVideos, getVerifiedVideos, getDeniedVideos, getStorageVideos, moderateVideo, deleteVideo } from '@/app/actions/video-actions';

// Mock Data for "Founder Updates" (Restored)
const MOCK_UPDATES = [
    {
        id: "update-1",
        videoId: "dQw4w9WgXcQ", // Placeholder
        title: "Update #13: The New Verification Engine & What's Next",
        date: "Oct 24, 2026",
        description: "In this update, I break down the new strict verification protocols we're rolling out to combat AI slop. I also need your feedback on the 'Creator Dashboard' features.",
        comments: 42
    },
    {
        id: "update-2",
        videoId: "pL5223_Cq1s",
        title: "Update #12: How we are changing the algorithm",
        date: "Oct 10, 2026",
        description: "We are removing engagement-bait metrics from the ranking system alongside a new 'Human Score' visualizer.",
        comments: 128
    }
];

// Column Types
type StatusColumn = 'pending' | 'verified' | 'banned' | 'storage';

export default function FounderMeeting() {
    const [activeTab, setActiveTab] = useState<'home' | 'suggested'>('home');
    const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);

    // Home Tab State
    const [activeUpdate, setActiveUpdate] = useState(MOCK_UPDATES[0]);
    const [commentText, setCommentText] = useState("");

    // Suggestions Tab State
    const [columns, setColumns] = useState<{ [key in StatusColumn]: any[] }>({
        pending: [],
        verified: [],
        banned: [],
        storage: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

    // Initial Load
    useEffect(() => {
        if (activeTab === 'suggested') {
            loadAllVideos();
        }
    }, [activeTab]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    const loadAllVideos = async () => {
        setIsLoading(true);
        const [pending, verified, banned, storage] = await Promise.all([
            getPendingVideos(),
            getVerifiedVideos(),
            getDeniedVideos(),
            getStorageVideos()
        ]);
        setColumns({
            pending: pending || [],
            verified: verified || [],
            banned: banned || [],
            storage: storage || []
        });
        setIsLoading(false);
    };

    const handleMove = async (videoId: string, toStatus: StatusColumn, e: React.MouseEvent) => {
        e.stopPropagation();
        setActiveMenuId(null);

        const sourceColumnKey = Object.keys(columns).find(key =>
            columns[key as StatusColumn].some(v => v.id === videoId)
        ) as StatusColumn;

        if (!sourceColumnKey || sourceColumnKey === toStatus) return;

        const videoToMove = columns[sourceColumnKey].find(v => v.id === videoId);

        // Optimistic Update
        setColumns(prev => ({
            ...prev,
            [sourceColumnKey]: prev[sourceColumnKey].filter(v => v.id !== videoId),
            [toStatus]: [videoToMove, ...prev[toStatus]]
        }));

        let serverAction: 'approve' | 'ban' | 'storage' | 'pending' = 'pending';
        if (toStatus === 'verified') serverAction = 'approve';
        else if (toStatus === 'banned') serverAction = 'ban';
        else if (toStatus === 'storage') serverAction = 'storage';

        const result = await moderateVideo(videoId, serverAction);
        if (!result.success) {
            alert(`Failed to move: ${result.message}`);
            loadAllVideos(); // Revert
        }
    };

    const handleDelete = async (videoId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm("Are you sure you want to completely delete this video?")) return;

        setActiveMenuId(null);

        // Optimistic UI Removal
        const sourceColumnKey = Object.keys(columns).find(key =>
            columns[key as StatusColumn].some(v => v.id === videoId)
        ) as StatusColumn;

        if (sourceColumnKey) {
            setColumns(prev => ({
                ...prev,
                [sourceColumnKey]: prev[sourceColumnKey].filter(v => v.id !== videoId)
            }));
        }

        const result = await deleteVideo(videoId);
        if (!result.success) {
            alert(`Failed to delete: ${result.message}`);
            loadAllVideos();
        }
    };

    const renderColumn = (title: string, status: StatusColumn, icon: any, colorClass: string) => (
        <div className="flex-1 min-w-[300px] flex flex-col h-full bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
            {/* Header */}
            <div className={`p-4 border-b border-white/5 flex items-center justify-between ${colorClass} bg-opacity-5`}>
                <div className="flex items-center gap-2">
                    {icon}
                    <h3 className={`font-bold text-sm uppercase tracking-wider ${colorClass}`}>{title}</h3>
                </div>
                <span className="text-xs font-mono text-gray-500">{columns[status].length}</span>
            </div>

            {/* Scroll Area */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {columns[status].map((video) => (
                    <div key={video.id} className="group relative bg-black/40 border border-white/5 rounded-xl p-2 hover:border-white/20 transition-all">
                        {/* Video Row Layout */}
                        <div className="flex items-center gap-3">
                            {/* 1. Video Thumbnail (Left) */}
                            <div className="w-20 aspect-video rounded bg-gray-900 overflow-hidden flex-shrink-0 relative">
                                <img
                                    src={`https://img.youtube.com/vi/${video.id}/default.jpg`}
                                    className="w-full h-full object-cover opacity-80"
                                />
                            </div>

                            {/* 2. Info (Middle) */}
                            <div className="flex-1 min-w-0">
                                <h4 className="text-xs font-bold text-gray-200 line-clamp-2 leading-tight mb-1" title={video.title || "Unknown Title"}>
                                    {video.title || video.id}
                                </h4>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <span className="text-[10px] text-gray-500 truncate">{video.channel_id || "Unknown Channel"}</span>
                                </div>
                            </div>

                            {/* 3. Hexagon (Near Right) */}
                            <div className="flex-shrink-0" title={`Suggestion Count: ${video.suggestion_count || 1}`}>
                                <Hexagon filledSegments={video.suggestion_count || 1} />
                            </div>

                            {/* 4. Action Dots (Far Right) */}
                            <div className="relative flex-shrink-0">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMenuId(activeMenuId === video.id ? null : video.id);
                                    }}
                                    className="p-1 hover:bg-white/10 rounded text-gray-500 hover:text-white transition-colors"
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>

                                {/* Dropdown Menu */}
                                {activeMenuId === video.id && (
                                    <div className="absolute right-0 top-6 z-50 w-40 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden py-1">
                                        {status !== 'pending' && <button onClick={(e) => handleMove(video.id, 'pending', e)} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-yellow-500">Move to Pending</button>}
                                        {status !== 'verified' && <button onClick={(e) => handleMove(video.id, 'verified', e)} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-green-500">Approve</button>}
                                        {status !== 'storage' && <button onClick={(e) => handleMove(video.id, 'storage', e)} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-blue-500">Move to Storage</button>}
                                        {status !== 'banned' && <button onClick={(e) => handleMove(video.id, 'banned', e)} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-red-500">Deny</button>}
                                        <div className="h-px bg-white/10 my-1"></div>
                                        <button onClick={(e) => handleDelete(video.id, e)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-900/20 text-red-600 font-bold flex items-center gap-2">
                                            <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30 flex flex-col">
            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-[1600px] mx-auto px-6 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-red-900 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                            <span className="font-bold text-xl tracking-tight">Veritas <span className="text-gray-500 font-normal text-sm ml-2">Headquarters</span></span>
                        </div>
                    </div>

                    {/* Tabs Switcher */}
                    <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
                        <button
                            onClick={() => setActiveTab('home')}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeTab === 'home' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Updates
                        </button>
                        <button
                            onClick={() => setActiveTab('suggested')}
                            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all relative ${activeTab === 'suggested' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                        >
                            Suggestions
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-24 pb-8 px-6 max-w-[1600px] mx-auto w-full flex-1 flex flex-col">
                <AnimatePresence mode="wait">
                    {activeTab === 'home' ? (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-12"
                        >
                            {/* LEFT COLUMN: Main Video + Comments */}
                            <div className="lg:col-span-2 space-y-8">
                                <div>
                                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-900/20 border border-red-500/20 text-red-400 text-xs font-medium mb-4">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                        </span>
                                        Founder Update
                                    </div>
                                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">
                                        {activeUpdate.title}
                                    </h1>
                                    <p className="text-gray-400 text-sm flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> {activeUpdate.date}
                                    </p>
                                </div>

                                <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                    <SmartVideoPlayer
                                        videoId={activeUpdate.videoId}
                                        title={activeUpdate.title}
                                    />
                                </div>

                                <div className="p-6 bg-[#111] rounded-2xl border border-white/5">
                                    <h3 className="text-lg font-bold text-white mb-2">Message from the Founder</h3>
                                    <p className="text-gray-400 leading-relaxed">
                                        {activeUpdate.description}
                                    </p>
                                </div>

                                {/* Comments Section */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <MessageSquare className="w-5 h-5 text-red-500" />
                                            Your feedback is ALL that matters
                                        </h3>
                                        <span className="text-sm text-gray-500">{activeUpdate.comments} comments</span>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 flex-shrink-0" />
                                        <div className="flex-1 relative">
                                            <textarea
                                                value={commentText}
                                                onChange={(e) => setCommentText(e.target.value)}
                                                placeholder="Share your thoughts directly with the team..."
                                                className="w-full bg-[#111] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-red-500/50 min-h-[100px] resize-none placeholder:text-gray-600"
                                            />
                                            <div className="absolute bottom-3 right-3">
                                                <button className="p-2 rounded-full bg-white/10 hover:bg-red-600 text-white transition-colors">
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: List + Feature Request */}
                            <div className="space-y-8">
                                {/* Previous Updates */}
                                <div className="space-y-6">
                                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Previous Meetings</h3>
                                    <div className="space-y-4">
                                        {MOCK_UPDATES.map((update) => (
                                            <button
                                                key={update.id}
                                                onClick={() => setActiveUpdate(update)}
                                                className={`w-full group text-left p-4 rounded-xl border transition-all duration-300 ${activeUpdate.id === update.id
                                                    ? 'bg-red-900/10 border-red-500/30'
                                                    : 'bg-[#111] border-white/5 hover:border-white/20 hover:bg-white/5'
                                                    }`}
                                            >
                                                <div className="relative aspect-video rounded-lg overflow-hidden bg-black mb-3 grayscale group-hover:grayscale-0 transition-all">
                                                    <img
                                                        src={`https://img.youtube.com/vi/${update.videoId}/mqdefault.jpg`}
                                                        alt={update.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <h4 className={`font-bold text-sm leading-snug mb-1 ${activeUpdate.id === update.id ? 'text-red-400' : 'text-gray-300 group-hover:text-white'
                                                    }`}>
                                                    {update.title}
                                                </h4>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Request a Feature Widget */}
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
                                        onClick={() => setIsFeatureModalOpen(true)}
                                        className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm font-medium transition-colors"
                                    >
                                        Submit Request
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="suggested"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex-1 flex gap-4 overflow-x-auto h-[calc(100vh-140px)]"
                        >
                            {/* 4 COLUMNS */}
                            {renderColumn('Pending', 'pending', <AlertCircle className="w-4 h-4" />, 'text-yellow-500')}
                            {renderColumn('Approved', 'verified', <CheckCircle2 className="w-4 h-4" />, 'text-green-500')}
                            {renderColumn('Denied', 'banned', <XCircle className="w-4 h-4" />, 'text-red-500')}
                            {renderColumn('Storage', 'storage', <Box className="w-4 h-4" />, 'text-blue-500')}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Feature Request Modal */}
                <FeatureRequestModal
                    isOpen={isFeatureModalOpen}
                    onClose={() => setIsFeatureModalOpen(false)}
                />
            </main>
        </div>
    );
}
