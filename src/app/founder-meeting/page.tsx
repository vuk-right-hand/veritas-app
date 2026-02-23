"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageSquare, Send, Sparkles, Calendar, Lightbulb, Loader2, ChevronDown } from 'lucide-react';
import SmartVideoPlayer from '@/components/SmartVideoPlayer';
import FeatureRequestModal from '@/components/FeatureRequestModal';
import { getComments, postComment } from '@/app/actions/video-actions';

// Mock Data for "Founder Updates"
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

export default function FounderMeeting() {
    const [isFeatureModalOpen, setIsFeatureModalOpen] = useState(false);

    // Home Tab State
    const [activeUpdate, setActiveUpdate] = useState(MOCK_UPDATES[0]);
    // Comments State
    const [comments, setComments] = useState<any[]>([]);
    const [newComment, setNewComment] = useState("");
    const [isLoadingComments, setIsLoadingComments] = useState(false);
    const [isPostingComment, setIsPostingComment] = useState(false);
    const [commentPage, setCommentPage] = useState(0);
    const [hasMoreComments, setHasMoreComments] = useState(true);
    const COMMENTS_PER_PAGE = 10;

    // Load Comments when Active Update Changes
    useEffect(() => {
        loadInitialComments();
    }, [activeUpdate.videoId]);

    const loadInitialComments = async () => {
        setIsLoadingComments(true);
        const initialLimit = 2;
        const data = await getComments(activeUpdate.videoId, initialLimit, 0);
        setComments(data || []);
        setCommentPage(1);
        setHasMoreComments((data?.length || 0) === initialLimit);
        setIsLoadingComments(false);
    };

    const handleLoadMoreComments = async () => {
        setIsLoadingComments(true);
        const offset = 2 + (commentPage - 1) * COMMENTS_PER_PAGE;
        const data = await getComments(activeUpdate.videoId, COMMENTS_PER_PAGE, offset);

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

        const optimisticComment = {
            id: `temp-${Date.now()}`,
            user_name: 'You',
            text: newComment,
            created_at: new Date().toISOString()
        };
        setComments(prev => [optimisticComment, ...prev]);
        setNewComment("");

        const result = await postComment(activeUpdate.videoId, optimisticComment.text);

        if (result.success && result.comment) {
            setComments(prev => prev.map(c => c.id === optimisticComment.id ? result.comment : c));
        } else {
            setComments(prev => prev.filter(c => c.id !== optimisticComment.id));
            alert(`Failed to post comment: ${result.message}`);
        }
        setIsPostingComment(false);
    };

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
                            <img src="/veritas-heart.svg" alt="Veritas Logo" className="w-11 h-11 object-contain animate-heartbeat fill-red-600" />
                            <span className="font-bold text-xl tracking-tight">Veritas <span className="text-gray-500 font-normal text-sm ml-2">Headquarters</span></span>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-24 pb-8 px-6 max-w-[1600px] mx-auto w-full flex-1 flex flex-col">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
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
                            </div>

                            {/* 1. Add Comment Input (Top) */}
                            <div className="flex gap-4">
                                <div className="w-10 h-10 rounded-full bg-gray-800 border border-white/10 flex-shrink-0 flex items-center justify-center">
                                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                                </div>
                                <div className="flex-1 relative">
                                    <input
                                        type="text"
                                        value={newComment}
                                        onChange={(e) => setNewComment(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && !isPostingComment) handlePostComment();
                                        }}
                                        placeholder="Share your thoughts directly with the team..."
                                        className="w-full bg-[#111] border border-white/10 rounded-xl p-4 text-sm text-white focus:outline-none focus:border-red-500/50 pr-12 placeholder:text-gray-600"
                                    />
                                    <button
                                        onClick={handlePostComment}
                                        disabled={!newComment.trim() || isPostingComment}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-red-600 text-white transition-colors disabled:opacity-30 disabled:hover:bg-white/10"
                                    >
                                        {isPostingComment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </button>
                                </div>
                            </div>

                            {/* 2. Comments List */}
                            <div className="space-y-4 pl-14">
                                {comments.map((comment) => (
                                    <div key={comment.id} className="flex gap-3 group">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center text-xs font-bold text-gray-400 border border-white/5 flex-shrink-0">
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
                </div>

                {/* Feature Request Modal */}
                <FeatureRequestModal
                    isOpen={isFeatureModalOpen}
                    onClose={() => setIsFeatureModalOpen(false)}
                />
            </main>
        </div>
    );
}
