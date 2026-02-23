"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Youtube, BarChart3, Users, Zap, Search, Plus, ExternalLink, MoreVertical, Edit2, Trash2 } from 'lucide-react';
import { updateCreatorLinks, updateVideoLinks, updateCreatorAvatar } from '../actions/creator-actions'; // We need to export suggestVideo from creator-actions or import from video-actions

// Import from video actions for suggestion as it was there? 
// Actually I put suggestVideo in creator-actions? No, I put getCreatorStats, updateCreatorLinks, updateVideoLinks. 
// suggestVideo is in video-actions.ts. I should reference that.
import { suggestVideo, updateVideoDescription } from '../actions/video-actions';

interface LinkType {
    title: string;
    url: string;
}

interface VideoType {
    id: string;
    title: string;
    views_count?: number; // from DB or analytic count passed in
    human_score: number;
    status: string;
    published_at: string | null;
    custom_links?: LinkType[];
    analytics_views?: number; // passed from server stats
}

interface CreatorStats {
    totalViews: number;
    searches: number;
    videosPromoted: number;
    humanScoreAvg: number;
    trafficInsights?: {
        last_14_days: number;
        evergreen: number;
        other: number;
        total: number;
    };
    gaps?: {
        term: string;
        demand: number;
        supply: number;
        score: number;
    }[];
}

interface CreatorProfile {
    id: string;
    channel_name: string;
    channel_url: string;
    links: LinkType[];
    description?: string;
    avatar_url?: string;
}

export default function CreatorDashboardClient({
    stats,
    creator,
    videos
}: {
    stats: CreatorStats,
    creator: CreatorProfile,
    videos: VideoType[]
}) {
    const [activeTab, setActiveTab] = useState<'home' | 'videos'>('home');
    const [isManageLinksOpen, setIsManageLinksOpen] = useState(false);
    const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
    const [showConfirmation, setShowConfirmation] = useState(false);

    // State for Link Management
    const [profileLinks, setProfileLinks] = useState<LinkType[]>(creator.links || []);
    const [channelDescription, setChannelDescription] = useState(creator.description || '');
    const [savingLinks, setSavingLinks] = useState(false);

    // State for Suggestion
    const [suggestUrl, setSuggestUrl] = useState("");
    const [suggestStatus, setSuggestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [suggestMsg, setSuggestMsg] = useState("");

    // State for Video Customization
    const [videoLinks, setVideoLinks] = useState<LinkType[]>([]);
    const [videoDescription, setVideoDescription] = useState('');

    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    // Handlers
    const handleSaveProfileLinks = async () => {
        setShowConfirmation(true);
    };

    const handleConfirmSave = async () => {
        setSavingLinks(true);
        setShowConfirmation(false);

        const res = await updateCreatorLinks(creator.id, profileLinks, channelDescription);

        if (res.success) {
            window.location.reload();
        } else {
            alert('Failed to save links: ' + res.error);
            setSavingLinks(false);
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);

        try {
            // 1. Compress Image (Canvas -> WebP, 400x400)
            const compressedBlob = await new Promise<Blob>((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = (event) => {
                    const img = new Image();
                    img.src = event.target?.result as string;
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const MAX_SIZE = 400;
                        const minDim = Math.min(img.width, img.height);
                        const sx = (img.width - minDim) / 2;
                        const sy = (img.height - minDim) / 2;

                        canvas.width = MAX_SIZE;
                        canvas.height = MAX_SIZE;
                        const ctx = canvas.getContext('2d');
                        if (!ctx) {
                            reject(new Error("Canvas context failed"));
                            return;
                        }

                        // Center Crop
                        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, MAX_SIZE, MAX_SIZE);

                        canvas.toBlob((blob) => {
                            if (blob) resolve(blob);
                            else reject(new Error("Compression failed"));
                        }, 'image/webp', 0.8);
                    };
                    img.onerror = (err) => reject(err);
                };
                reader.onerror = (err) => reject(err);
            });

            // 2. Upload to Supabase Storage
            const fileName = `creator-avatars/${creator.id}-${Date.now()}.webp`;

            const supabase = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
            );

            const { data, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, compressedBlob, {
                    contentType: 'image/webp',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 3. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            // 4. Update Creator Profile
            const res = await updateCreatorAvatar(creator.id, publicUrl);

            if (res.success) {
                window.location.reload();
            } else {
                alert("Failed to update avatar: " + res.error);
            }

        } catch (err: any) {
            console.error("Upload failed", err);
            alert("Failed to upload image. " + (err.message || ''));
        } finally {
            setUploadingAvatar(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30">
            {/* Same Navbar */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <img src="/veritas-heart.svg" alt="Veritas Logo" className="w-11 h-11 object-contain animate-heartbeat fill-red-600" />
                            <span className="font-bold text-xl tracking-tight">Veritas <span className="text-gray-500 font-normal text-sm ml-2">Creator Dashboard</span></span>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-8 max-w-[1200px] mx-auto min-h-[80vh]">
                {/* Header & Stats */}
                <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12 border-b border-white/5 pb-8">
                    <div className="flex items-center gap-6">
                        <div
                            className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-700 to-black border-2 border-white/10 shadow-2xl flex items-center justify-center text-3xl font-bold overflow-hidden relative group cursor-pointer"
                            onClick={handleAvatarClick}
                        >
                            {uploadingAvatar ? (
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
                                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                </div>
                            ) : creator.avatar_url ? (
                                <img src={creator.avatar_url} alt={creator.channel_name} className="w-full h-full object-cover" />
                            ) : (
                                creator.channel_name.substring(0, 2).toUpperCase()
                            )}

                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-[10px] uppercase font-bold text-white tracking-widest">Upload</span>
                            </div>

                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                onChange={handleFileChange}
                            />
                        </div >
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-3xl font-bold text-white">{creator.channel_name}</h1>
                                <img
                                    src="/veritas-heart.svg"
                                    alt="Verification Status"
                                    className={`w-8 h-8 object-contain ${videos.some(v => v.status === 'verified') ? 'fill-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.5)]' : 'opacity-20 grayscale'}`}
                                />
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-400">
                                <span>Views: {stats.totalViews}</span>
                                <span className="text-gray-600">•</span>
                                <span className={`${videos.some(v => v.status === 'verified') ? 'text-green-400 shadow-green-400/20 drop-shadow-sm' : 'text-gray-600'} font-medium transition-colors duration-500`}>
                                    Verified Human Creator
                                </span>
                            </div>
                        </div>
                    </div >
                    <div className="flex gap-3">
                        {activeTab === 'home' && (
                            <button
                                onClick={() => {
                                    // Reset state to current creator values when opening modal
                                    setProfileLinks(creator.links || []);
                                    setChannelDescription(creator.description || '');
                                    setIsManageLinksOpen(true);
                                }}
                                className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium"
                            >
                                Manage Links
                            </button>
                        )}
                    </div>
                </div >

                {/* Mobile/Desktop Tabs */}
                <div className="flex border-b border-white/10 mb-8 overflow-x-auto no-scrollbar">
                    <button
                        onClick={() => setActiveTab('home')}
                        className={`px-8 py-4 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'home' ? 'border-red-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        Home
                    </button>
                    <button
                        onClick={() => setActiveTab('videos')}
                        className={`px-8 py-4 font-semibold text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'videos' ? 'border-red-500 text-white' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                    >
                        Videos
                    </button>
                </div>

                {activeTab === 'home' && (
                    <div className="space-y-12 animate-in fade-in duration-500">
                        {/* Verified Badge Card - Always Dark/Grey "Coming Up" State */}
                        <div className="relative overflow-hidden rounded-xl transition-all duration-500 bg-gradient-to-br from-gray-900/40 via-black to-black border border-white/5">
                            {/* Coming Up Label */}
                            <div className="absolute top-4 left-0 w-full flex justify-center z-20">
                                <span className="text-gray-500/50 text-xs font-medium tracking-[0.2em] uppercase">Coming up...</span>
                            </div>

                            <div className="backdrop-blur-xl p-8 flex items-center justify-between gap-8">
                                <div className="flex items-center gap-8 relative z-10 flex-col md:flex-row text-center md:text-left">
                                    <div className="w-24 h-24 rounded-full flex items-center justify-center border border-white/5 bg-black/40 flex-shrink-0">
                                        <img
                                            src="/veritas-heart.svg"
                                            alt="Heart Logo"
                                            className="w-14 h-14 object-contain opacity-20 grayscale"
                                        />
                                    </div>
                                    <div>
                                        <h3 className="text-xl md:text-2xl font-serif tracking-wide text-white flex items-center gap-3 justify-center md:justify-start">
                                            Verified Human Badge
                                        </h3>
                                        <p className="text-gray-400 text-sm max-w-xl mt-3 leading-relaxed font-light">
                                            Show the world that you are a "Verified Human Creator". Submit a video for review and receive the "Human Heart" to display across your social media.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Advanced Insights Row */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Traffic Alert */}
                            <div className="rounded-xl bg-gradient-to-br from-gray-900/40 via-black to-black border border-white/5 relative overflow-hidden h-full flex flex-col pt-12 p-6">
                                <div className="absolute top-4 left-0 w-full flex justify-center z-20">
                                    <span className="text-gray-500/50 text-xs font-medium tracking-[0.2em] uppercase">Coming up...</span>
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-white/5 text-gray-500">
                                        <BarChart3 className="w-5 h-5 opacity-50" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Traffic Sources</h3>
                                </div>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    You'll be able to see if viewers are filtering content by "last 14 days" for example so you can make sure to have at least one new video every 2 weeks.
                                </p>
                            </div>

                            {/* Opportunity Engine */}
                            <div className="rounded-xl bg-gradient-to-br from-gray-900/40 via-black to-black border border-white/5 relative overflow-hidden h-full flex flex-col pt-12 p-6">
                                <div className="absolute top-4 left-0 w-full flex justify-center z-20">
                                    <span className="text-gray-500/50 text-xs font-medium tracking-[0.2em] uppercase">Coming up...</span>
                                </div>
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-white/5 text-gray-500">
                                        <Search className="w-5 h-5 opacity-50" />
                                    </div>
                                    <h3 className="text-lg font-bold text-white">Content Gaps</h3>
                                </div>
                                <p className="text-sm text-gray-400 leading-relaxed">
                                    You'll get a report of the most searched terms across the platform inside your niche. Plus the biggest supply & demand mismatch so you can fill the gap and guarantee views.
                                </p>
                            </div>
                        </div>

                        {/* Stats Grid - Using Real Data */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: 'Total Veritas Views', value: stats.totalViews, icon: Users, color: 'text-blue-400' },
                                { label: 'Human Score Avg', value: `${Math.round(stats.humanScoreAvg || 0)}%`, icon: Zap, color: 'text-yellow-400' },
                                { label: 'Videos Promoted', value: stats.videosPromoted, icon: Youtube, color: 'text-red-400' },
                                { label: 'Searches', value: stats.searches, icon: Search, color: 'text-green-400' },
                            ].map((stat, i) => (
                                <div key={i} className="p-6 rounded-2xl bg-[#111] border border-white/5 hover:border-white/10 transition-colors group">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-sm text-gray-500 font-medium">{stat.label}</span>
                                        <stat.icon className={`w-5 h-5 ${stat.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                                    </div>
                                    <div className="text-3xl font-bold text-white tracking-tight">{stat.value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === 'videos' && (
                    <div className="space-y-12 animate-in fade-in duration-500">
                        {/* Suggest Video (from Feed) */}
                        <div className="w-full relative max-w-2xl mx-auto mt-4 px-4 md:px-0">
                            <span className="text-[10px] text-red-500 uppercase tracking-widest mb-2 font-bold flex justify-center animate-pulse">Submit A New Video</span>
                            <div className="w-full relative group">
                                <div className="absolute inset-0 bg-red-600/30 rounded-full blur-xl animate-pulse" />
                                <input
                                    type="text"
                                    suppressHydrationWarning
                                    value={suggestStatus === 'success' ? "Success! Thank you!" : suggestUrl}
                                    onChange={(e) => {
                                        if (suggestStatus !== 'success') setSuggestUrl(e.target.value);
                                    }}
                                    onKeyDown={(e) => e.key === 'Enter' && submitSuggestion(suggestUrl, setSuggestStatus, setSuggestMsg)}
                                    placeholder="Paste the YouTube URL..."
                                    disabled={suggestStatus === 'success'}
                                    className={`w-full border-2 rounded-full py-4 px-6 text-sm focus:outline-none transition-all relative z-10 shadow-[0_0_20px_rgba(220,38,38,0.4)] ${suggestStatus === 'success'
                                        ? 'bg-green-900/20 border-green-500/50 text-green-400 font-bold text-center tracking-wide'
                                        : 'bg-[#1a1a1a] border-red-600/60 text-white placeholder:text-red-300/50 focus:border-red-500 focus:bg-[#202020] animate-pulse focus:animate-none'
                                        }`}
                                />
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
                                    <button
                                        onClick={() => submitSuggestion(suggestUrl, setSuggestStatus, setSuggestMsg)}
                                        disabled={suggestStatus === 'loading' || suggestStatus === 'success'}
                                        className={`p-1.5 rounded-full transition-all duration-500 ease-out disabled:opacity-100 ${suggestStatus === 'success'
                                            ? 'bg-green-500 text-white transform scale-125 shadow-[0_0_20px_rgba(34,197,94,0.6)]'
                                            : 'bg-red-600 text-white hover:bg-red-500 shadow-[0_0_10px_rgba(220,38,38,0.8)]'
                                            }`}
                                    >
                                        <span className="sr-only">Submit</span>
                                        {suggestStatus === 'loading' ? (
                                            <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                                        ) : suggestStatus === 'success' ? (
                                            <CheckCircle2 className="w-4 h-4 animate-in zoom-in spin-in-90 duration-300" />
                                        ) : (
                                            <Zap className="w-4 h-4 fill-current" />
                                        )}
                                    </button>
                                </div>
                            </div>
                            {suggestMsg && <div className={`mt-3 text-center text-sm font-medium ${suggestStatus === 'success' ? 'text-green-400' : 'text-red-400'}`}>{suggestMsg}</div>}
                        </div>

                        {/* Video List */}
                        <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h2 className="text-lg font-bold text-white">Active Promotions</h2>
                                {/* Search placeholder */}
                            </div>

                            <div className="divide-y divide-white/5">
                                {videos.map((video) => (
                                    <div key={video.id} className="p-4 flex flex-col sm:flex-row items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                                        <div className="w-full sm:w-40 aspect-video bg-gray-800 rounded-md overflow-hidden relative flex-shrink-0">
                                            <img
                                                src={`https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                                                alt={video.title}
                                                className="w-full h-full object-cover opacity-90"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0 text-center sm:text-left">
                                            <h3 className="text-sm font-medium text-white line-clamp-2 md:line-clamp-none group-hover:text-red-400 transition-colors px-2 leading-snug">{video.title}</h3>
                                            <div className="flex items-center justify-center sm:justify-start gap-3 mt-1 text-xs text-gray-500">
                                                <span>{new Date(video.published_at || Date.now()).toLocaleDateString()}</span>
                                                <span className={video.status === 'verified' ? 'text-green-400' : 'text-yellow-400'}>{video.status}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-6 px-4 py-2 bg-black/40 sm:bg-transparent rounded-lg w-full sm:w-auto justify-around">
                                            <div className="text-center sm:text-right">
                                                <div className="text-xs text-gray-500">Links</div>
                                                <div className="text-sm font-bold text-white">{(video.custom_links || []).length}</div>
                                            </div>
                                            <div className="text-center sm:text-right">
                                                <div className="text-xs text-gray-500">Views</div>
                                                <div className="text-sm font-bold text-white">{video.views_count || 0}</div>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    setEditingVideoId(video.id);
                                                    setVideoLinks(video.custom_links || []);
                                                }}
                                                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                                {videos.length === 0 && (
                                    <div className="p-12 text-center text-gray-500 shrink-0">
                                        No active promotions found. Submit a video above to get started.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </main >

            {/* Manage Links Modal */}
            <AnimatePresence>
                {
                    isManageLinksOpen && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl p-6"
                            >
                                <h2 className="text-xl font-bold mb-4">Manage Profile Links</h2>

                                {/* Channel Description */}
                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">General Description</label>
                                    <textarea
                                        value={channelDescription}
                                        onChange={(e) => setChannelDescription(e.target.value)}
                                        placeholder="Describe your channel and what viewers can expect from your content..."
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white min-h-[100px] resize-none shadow-inner"
                                    />
                                </div>

                                {/* Links Editor */}
                                <LinkEditor links={profileLinks} onChange={setProfileLinks} />
                                <div className="flex justify-end gap-3 mt-6">
                                    <button onClick={() => setIsManageLinksOpen(false)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
                                    <button
                                        onClick={handleSaveProfileLinks}
                                        disabled={savingLinks}
                                        className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {savingLinks ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >



            {/* Video Links Modal */}
            <AnimatePresence>
                {
                    editingVideoId && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-lg bg-[#111] border border-white/10 rounded-2xl p-6"
                            >
                                <h2 className="text-xl font-bold mb-4">Customize Video</h2>
                                <p className="text-sm text-gray-400 mb-4">Add a custom description and specific links for this video.</p>

                                {/* Video Description */}
                                <div className="mb-6">
                                    <label className="block text-sm font-semibold text-gray-300 mb-2">Custom Description (optional)</label>
                                    <textarea
                                        value={videoDescription}
                                        onChange={(e) => setVideoDescription(e.target.value)}
                                        placeholder="Override channel description for this specific video..."
                                        className="w-full bg-black/50 border border-white/10 rounded-lg p-3 text-white min-h-[80px] resize-none shadow-inner"
                                    />
                                </div>

                                {/* Video Links */}
                                <LinkEditor links={videoLinks} onChange={setVideoLinks} />
                                <div className="flex justify-end gap-3 mt-6">
                                    <button onClick={() => setEditingVideoId(null)} className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">Cancel</button>
                                    <button onClick={async () => {
                                        setSavingLinks(true);
                                        await Promise.all([
                                            updateVideoLinks(editingVideoId, videoLinks),
                                            updateVideoDescription(editingVideoId, videoDescription)
                                        ]);
                                        setSavingLinks(false);
                                        setEditingVideoId(null);
                                    }} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold">{savingLinks ? 'Saving...' : 'Save Changes'}</button>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >

            {/* Confirmation Modal */}
            <AnimatePresence>
                {
                    showConfirmation && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="w-full max-w-md bg-[#111] border border-red-500/30 rounded-2xl p-6 shadow-[0_0_50px_rgba(220,38,38,0.3)]"
                            >
                                <h2 className="text-xl font-bold mb-4 text-white">Update All Videos?</h2>
                                <p className="text-gray-300 mb-6 leading-relaxed">
                                    This will update the description inside all of your videos on Veritas. Your channel links will be added to every video you've submitted.
                                </p>
                                <div className="flex justify-end gap-3">
                                    <button
                                        onClick={() => setShowConfirmation(false)}
                                        className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleConfirmSave}
                                        disabled={savingLinks}
                                        className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {savingLinks ? 'Updating...' : 'Confirm'}
                                    </button>
                                </div>
                            </motion.div>
                        </div>
                    )
                }
            </AnimatePresence >

        </div >
    );
}



// ... (rest of helper functions)

// Helpers
function LinkEditor({ links, onChange }: { links: LinkType[], onChange: (l: LinkType[]) => void }) {
    const addLink = () => onChange([...links, { title: "", url: "" }]);
    const updateLink = (index: number, field: keyof LinkType, value: string) => {
        const newLinks = [...links];
        newLinks[index] = { ...newLinks[index], [field]: value };
        onChange(newLinks);
    };
    const removeLink = (index: number) => {
        const newLinks = [...links];
        newLinks.splice(index, 1);
        onChange(newLinks);
    };

    return (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {links.map((link, i) => (
                <div key={i} className="flex gap-2 items-start">
                    <div className="flex-1 space-y-2">
                        <input
                            placeholder="Link Title (e.g. My Course)"
                            value={link.title}
                            onChange={(e) => updateLink(i, 'title', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-sm text-white"
                        />
                        <input
                            placeholder="https://..."
                            value={link.url}
                            onChange={(e) => updateLink(i, 'url', e.target.value)}
                            className="w-full bg-black/50 border border-white/10 rounded p-2 text-sm text-white font-mono"
                        />
                    </div>
                    <button onClick={() => removeLink(i)} className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-colors mt-1">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}
            <button onClick={addLink} className="w-full py-2 border border-dashed border-white/20 rounded-lg text-sm text-gray-400 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Link
            </button>
        </div>
    );
}



async function submitSuggestion(url: string, setStatus: any, setMsg: any) {
    setStatus('loading');
    try {
        const res = await suggestVideo(url);
        if (res.success) {
            setStatus('success');
            setMsg(res.message);
            // Optional: Reload page or optimistic update? Page reload is safer
            setTimeout(() => window.location.reload(), 1500);
        } else {
            setStatus('error');
            setMsg(res.message);
        }
    } catch (e) {
        setStatus('error');
        setMsg("Failed to submit.");
    }
}

