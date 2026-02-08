"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageSquare, Send, Sparkles, Play, Calendar, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import SmartVideoPlayer from '@/components/SmartVideoPlayer';
import { useRouter } from 'next/navigation';
import { getPendingVideos, moderateVideo } from '@/app/actions/video-actions';

// Mock Data for "Founder Updates"
const MOCK_UPDATES = [
    {
        id: "update-1",
        videoId: "dQw4w9WgXcQ", // Placeholder ID
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

export default function FounderMeeting() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'home' | 'suggested'>('home');

    // Home Tab State
    const [activeVideo, setActiveVideo] = useState(MOCK_UPDATES[0]);
    const [commentText, setCommentText] = useState("");

    // Suggested Tab State
    const [pendingVideos, setPendingVideos] = useState<any[]>([]);
    const [selectedPendingVideo, setSelectedPendingVideo] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'suggested') {
            loadPendingVideos();
        }
    }, [activeTab]);

    const loadPendingVideos = async () => {
        setIsLoading(true);
        const videos = await getPendingVideos();
        setPendingVideos(videos || []);
        setIsLoading(false);
    };

    const handleVideoEnd = () => {
        alert("Meeting complete! Redirecting to the next step...");
    };

    const handleModeration = async (videoId: string, action: 'approve' | 'ban') => {
        const result = await moderateVideo(videoId, action);

        if (!result.success) {
            // Show error if the update actually failed
            alert(`Moderation failed: ${result.message}`);
            return;
        }

        // Optimistic UI Update - only if successful
        setPendingVideos(prev => prev.filter(v => v.id !== videoId));
        setSelectedPendingVideo(null);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30 flex flex-col">

            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-[1200px] mx-auto px-6 h-20 flex items-center justify-between">
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
                            {/* Pulsing Dot Mock (In real app, verify count > 0) */}
                            <span className="absolute top-1 right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                            </span>
                        </button>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-6 max-w-[1200px] mx-auto flex-1 w-full">

                <AnimatePresence mode="wait">
                    {/* TAB: HOME (Existing Founder Meeting) */}
                    {activeTab === 'home' ? (
                        <motion.div
                            key="home"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 lg:grid-cols-3 gap-12"
                        >
                            {/* ... (Existing Left Column) ... */}
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
                                        {activeVideo.title}
                                    </h1>
                                    <p className="text-gray-400 text-sm flex items-center gap-2">
                                        <Calendar className="w-4 h-4" /> {activeVideo.date}
                                    </p>
                                </div>

                                <div className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
                                    <SmartVideoPlayer
                                        videoId={activeVideo.videoId}
                                        title={activeVideo.title}
                                        onEnded={handleVideoEnd}
                                    />
                                </div>

                                <div className="p-6 bg-[#111] rounded-2xl border border-white/5">
                                    <h3 className="text-lg font-bold text-white mb-2">Message from the Founder</h3>
                                    <p className="text-gray-400 leading-relaxed">
                                        {activeVideo.description}
                                    </p>
                                </div>

                                {/* Comments (Simplified for brevity) */}
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xl font-bold flex items-center gap-2">
                                            <MessageSquare className="w-5 h-5 text-red-500" />
                                            Community Feedback
                                        </h3>
                                        <span className="text-sm text-gray-500">{activeVideo.comments} comments</span>
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
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ... (Existing Right Column - Updates List) ... */}
                            <div className="space-y-6">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Previous Meetings</h3>
                                <div className="space-y-4">
                                    {MOCK_UPDATES.map((update) => (
                                        <button
                                            key={update.id}
                                            onClick={() => setActiveVideo(update)}
                                            className={`w-full group text-left p-4 rounded-xl border transition-all duration-300 ${activeVideo.id === update.id
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
                                            <h4 className={`font-bold text-sm leading-snug mb-1 ${activeVideo.id === update.id ? 'text-red-400' : 'text-gray-300 group-hover:text-white'
                                                }`}>
                                                {update.title}
                                            </h4>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    ) : (
                        /* TAB: SUGGESTED (Admin Moderation) */
                        <motion.div
                            key="suggested"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="h-full"
                        >
                            {!selectedPendingVideo ? (
                                /* LIST VIEW */
                                <div className="max-w-4xl mx-auto">
                                    <div className="flex items-center justify-between mb-8">
                                        <h2 className="text-2xl font-bold flex items-center gap-3">
                                            <AlertCircle className="w-6 h-6 text-yellow-500" />
                                            Pending Review
                                        </h2>
                                        <span className="text-sm text-gray-500">{pendingVideos.length} items waiting</span>
                                    </div>

                                    {isLoading ? (
                                        <div className="text-center py-20 text-gray-500">Loading suggestions...</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {pendingVideos.map((video) => (
                                                <button
                                                    key={video.id}
                                                    onClick={() => setSelectedPendingVideo(video)}
                                                    className="flex items-start gap-4 p-4 rounded-xl bg-[#111] border border-white/5 hover:border-white/20 hover:bg-white/5 text-left transition-all group"
                                                >
                                                    <div className="w-32 aspect-video bg-black rounded-lg overflow-hidden flex-shrink-0 relative">
                                                        <img
                                                            src={`https://img.youtube.com/vi/${video.id}/mqdefault.jpg`}
                                                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                                                        />
                                                    </div>
                                                    <div>
                                                        <h3 className="font-bold text-gray-200 group-hover:text-white line-clamp-2 mb-1">{video.id}</h3>
                                                        <span className="text-xs text-yellow-500 font-mono uppercase bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-500/20">Pending</span>
                                                    </div>
                                                </button>
                                            ))}
                                            {pendingVideos.length === 0 && (
                                                <div className="col-span-2 text-center py-20 bg-[#111] rounded-2xl border border-white/5 border-dashed">
                                                    <p className="text-gray-500">No pending suggestions. All clear!</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* REVIEW VIEW */
                                <div className="max-w-5xl mx-auto flex flex-col items-center">
                                    <button
                                        onClick={() => setSelectedPendingVideo(null)}
                                        className="self-start text-sm text-gray-500 hover:text-white mb-6 flex items-center gap-2"
                                    >
                                        <ArrowLeft className="w-4 h-4" /> Back to list
                                    </button>

                                    <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 mb-8">
                                        {/* Clean Player - No Distractions */}
                                        <SmartVideoPlayer
                                            videoId={selectedPendingVideo.id}
                                            autoplay={true}
                                        />
                                    </div>

                                    <div className="flex items-center gap-8">
                                        <button
                                            onClick={() => handleModeration(selectedPendingVideo.id, 'ban')}
                                            className="px-8 py-4 rounded-xl bg-red-950/20 border border-red-500/20 hover:bg-red-900/40 hover:border-red-500 transition-all group flex items-center gap-3"
                                        >
                                            <div className="p-2 rounded-full bg-red-500/10 group-hover:bg-red-500 text-red-500 group-hover:text-white transition-colors">
                                                <XCircle className="w-6 h-6" />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-bold text-red-400 group-hover:text-white">Decline & Ban</div>
                                                <div className="text-[10px] text-red-500/50 group-hover:text-red-300">Never show again</div>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => handleModeration(selectedPendingVideo.id, 'approve')}
                                            className="px-8 py-4 rounded-xl bg-green-950/20 border border-green-500/20 hover:bg-green-900/40 hover:border-green-500 transition-all group flex items-center gap-3"
                                        >
                                            <div className="p-2 rounded-full bg-green-500/10 group-hover:bg-green-500 text-green-500 group-hover:text-white transition-colors">
                                                <CheckCircle2 className="w-6 h-6" />
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-bold text-green-400 group-hover:text-white">Approve Video</div>
                                                <div className="text-[10px] text-green-500/50 group-hover:text-green-300">Add to public feed</div>
                                            </div>
                                        </button>
                                    </div>

                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

            </main>
        </div>
    );
}
