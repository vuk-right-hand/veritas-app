"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
// Removed AnimatePresence if not used, or keep for potential future use
import { ArrowLeft, AlertCircle, CheckCircle2, XCircle, Box, MoreVertical, Trash2 } from 'lucide-react';
import Hexagon from '@/components/Hexagon';
import Portal from '@/components/ui/portal';
import { getPendingVideos, getVerifiedVideos, getDeniedVideos, getStorageVideos, moderateVideo, deleteVideo } from '@/app/actions/video-actions';

// Column Types
type StatusColumn = 'pending' | 'verified' | 'banned' | 'storage';

export default function SuggestedVideosPage() {
    // Suggestions Tab State
    const [columns, setColumns] = useState<{ [key in StatusColumn]: any[] }>({
        pending: [],
        verified: [],
        banned: [],
        storage: []
    });
    const [isLoading, setIsLoading] = useState(false);
    const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
    // Changed to CSSProperties to support top/bottom switching
    const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

    // Drag and Drop State
    const [draggedVideoId, setDraggedVideoId] = useState<string | null>(null);
    const [dragOverColumn, setDragOverColumn] = useState<StatusColumn | null>(null);

    // Initial Load
    useEffect(() => {
        loadAllVideos();
    }, []);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setActiveMenuId(null);
        window.addEventListener('click', handleClickOutside);
        return () => window.removeEventListener('click', handleClickOutside);
    }, []);

    // Close menu on scroll to prevent it from detaching from the button (since it's fixed)
    useEffect(() => {
        const handleScroll = () => {
            if (activeMenuId) setActiveMenuId(null);
        };
        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, [activeMenuId]);

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

    const handleMove = async (videoId: string, toStatus: StatusColumn) => {
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

    // Drag and Drop Handlers
    const handleDragStart = (e: React.DragEvent, videoId: string) => {
        setDraggedVideoId(videoId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', videoId);
        // Ensure menu is closed when drag starts
        setActiveMenuId(null);
    };

    const handleDragOver = (e: React.DragEvent, status: StatusColumn) => {
        e.preventDefault(); // Necessary to allow dropping
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';

        if (dragOverColumn !== status) {
            setDragOverColumn(status);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Optional: logic to clear dragOverColumn if leaving the container
    };

    const handleDrop = (e: React.DragEvent, status: StatusColumn) => {
        e.preventDefault();
        e.stopPropagation();
        setDragOverColumn(null);

        const videoId = e.dataTransfer.getData('text/plain');
        if (videoId) {
            handleMove(videoId, status);
        }
        setDraggedVideoId(null);
    };


    const handleMenuOpen = (videoId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const button = e.currentTarget;
        const rect = button.getBoundingClientRect();

        const menuHeight = 220; // Only used for detection, NOT positioning
        const menuWidth = 160;
        const gap = 4;

        const spaceBelow = window.innerHeight - rect.bottom;

        // Base style: Fixed positioning, Right aligned to the button
        const style: React.CSSProperties = {
            position: 'fixed',
            left: rect.right - menuWidth,
            zIndex: 9999,
        };

        if (spaceBelow < menuHeight) {
            // Flip Upwards
            // We use 'bottom' relative to viewport to anchor it above the button
            // Calculation: Viewport Height - Button Top + Gap
            // This places the bottom of the menu simply at "button top - gap"
            style.bottom = window.innerHeight - rect.top + gap;
            style.top = 'auto'; // ensure top is unset
        } else {
            // Regular Downwards
            style.top = rect.bottom + gap;
            style.bottom = 'auto';
        }

        setMenuStyle(style);
        setActiveMenuId(activeMenuId === videoId ? null : videoId);
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
        <div
            className={`flex-1 min-w-[300px] flex flex-col h-full bg-[#111] rounded-2xl border transition-all ${dragOverColumn === status ? 'border-red-500 bg-red-900/10' : 'border-white/5 overflow-hidden'}`}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, status)}
        >
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
                    <div
                        key={video.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, video.id)}
                        className={`group relative bg-black/40 border border-white/5 rounded-xl p-2 hover:border-white/20 transition-all ${draggedVideoId === video.id ? 'opacity-50' : 'opacity-100'} cursor-grab active:cursor-grabbing`}
                    >
                        {/* Video Row Layout */}
                        <div className="flex items-center gap-3">
                            {/* 1. Video Thumbnail (Left) */}
                            <div className="w-20 aspect-video rounded bg-gray-900 overflow-hidden flex-shrink-0 relative pointer-events-none">
                                <img
                                    src={`https://img.youtube.com/vi/${video.id}/default.jpg`}
                                    className="w-full h-full object-cover opacity-80"
                                />
                            </div>

                            {/* 2. Info (Middle) */}
                            <div className="flex-1 min-w-0 pointer-events-none">
                                <h4 className="text-xs font-bold text-gray-200 line-clamp-2 leading-tight mb-1" title={video.title || "Unknown Title"}>
                                    {video.title || video.id}
                                </h4>
                                <div className="flex items-center gap-2 overflow-hidden">
                                    {video.channel_url ? (
                                        <span
                                            className="text-[10px] text-blue-400 truncate"
                                        >
                                            {video.channel_title || video.channel_id || "Unknown Channel"}
                                        </span>
                                    ) : (
                                        <span className="text-[10px] text-gray-500 truncate">{video.channel_title || video.channel_id || "Unknown Channel"}</span>
                                    )}
                                </div>
                            </div>

                            {/* 3. Hexagon (Near Right) */}
                            <div className="flex-shrink-0 pointer-events-none" title={`Suggestion Count: ${video.suggestion_count || 1}`}>
                                <Hexagon filledSegments={video.suggestion_count || 1} />
                            </div>

                            {/* 4. Action Dots (Far Right) */}
                            <div className="relative flex-shrink-0">
                                <button
                                    onClick={(e) => handleMenuOpen(video.id, e)}
                                    // Re-enable pointer events for the button specifically
                                    className={`p-1 hover:bg-white/10 rounded transition-colors pointer-events-auto ${activeMenuId === video.id ? 'text-white bg-white/10' : 'text-gray-500 hover:text-white'}`}
                                >
                                    <MoreVertical className="w-4 h-4" />
                                </button>
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
                            <span className="font-bold text-xl tracking-tight text-red-500">Suggestions <span className="text-gray-500 font-normal text-sm ml-2">Inbox</span></span>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-24 pb-8 px-6 max-w-[1600px] mx-auto w-full flex-1 flex flex-col">
                <div className="flex-1 flex gap-4 overflow-x-auto h-[calc(100vh-140px)]">
                    {/* 4 COLUMNS */}
                    {renderColumn('Pending', 'pending', <AlertCircle className="w-4 h-4" />, 'text-yellow-500')}
                    {renderColumn('Approved', 'verified', <CheckCircle2 className="w-4 h-4" />, 'text-green-500')}
                    {renderColumn('Denied', 'banned', <XCircle className="w-4 h-4" />, 'text-red-500')}
                    {renderColumn('Storage', 'storage', <Box className="w-4 h-4" />, 'text-blue-500')}

                    {/* Global Dropdown via Portal */}
                    {activeMenuId && (
                        <Portal>
                            <div
                                // Fixed positioning is applied via style={menuStyle}, so we remove 'absolute'/'fixed' from class
                                // Added 'fixed' back to class just in case style fails, but style overrides.
                                // Actually, let's keep it simple: className sets visuals, style sets pos.
                                className="z-[9999] w-40 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden py-1"
                                style={menuStyle}
                                onClick={(e) => e.stopPropagation()}
                            >
                                {(() => {
                                    // Find the active video and its status
                                    let activeVideo: any = null;
                                    let activeStatus: StatusColumn | null = null;

                                    for (const statusEnv of ['pending', 'verified', 'banned', 'storage'] as StatusColumn[]) {
                                        const found = columns[statusEnv].find(v => v.id === activeMenuId);
                                        if (found) {
                                            activeVideo = found;
                                            activeStatus = statusEnv;
                                            break;
                                        }
                                    }

                                    if (!activeVideo || !activeStatus) return null;

                                    return (
                                        <>
                                            {activeStatus !== 'pending' && <button onClick={() => handleMove(activeVideo.id, 'pending')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-yellow-500">Move to Pending</button>}
                                            {activeStatus !== 'verified' && <button onClick={() => handleMove(activeVideo.id, 'verified')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-green-500">Approve</button>}
                                            {activeStatus !== 'storage' && <button onClick={() => handleMove(activeVideo.id, 'storage')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-blue-500">Move to Storage</button>}
                                            {activeStatus !== 'banned' && <button onClick={() => handleMove(activeVideo.id, 'banned')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-red-500">Deny</button>}
                                            <div className="h-px bg-white/10 my-1"></div>
                                            <button onClick={(e) => handleDelete(activeVideo.id, e)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-900/20 text-red-600 font-bold flex items-center gap-2">
                                                <Trash2 className="w-3 h-3" /> Delete
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>
                            {/* Backdrop for explicit click-outside */}
                            <div className="fixed inset-0 z-[9990]" onClick={() => setActiveMenuId(null)} />
                        </Portal>
                    )}
                </div>
            </main>
        </div>
    );
}
