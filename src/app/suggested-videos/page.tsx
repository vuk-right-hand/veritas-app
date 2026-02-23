"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
// Removed AnimatePresence if not used, or keep for potential future use
import { ArrowLeft, AlertCircle, CheckCircle2, XCircle, Box, MoreVertical, Trash2 } from 'lucide-react';
import Hexagon from '@/components/Hexagon';
import Portal from '@/components/ui/portal';
import { getPendingVideos, getVerifiedVideos, getDeniedVideos, getStorageVideos, moderateVideo, deleteVideo } from '@/app/actions/video-actions';
import { suggestChannel, getPendingChannels, getApprovedChannels, getDeniedChannels, getStorageChannels, moderateChannel, deleteChannel } from '@/app/actions/channel-actions';

// Column Types
type StatusColumn = 'pending' | 'verified' | 'banned' | 'storage';

export default function SuggestedVideosPage() {
    // Tab State
    const [activeView, setActiveView] = useState<'videos' | 'channels'>('videos');
    const [suggestionUrl, setSuggestionUrl] = useState("");
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [suggestionStatus, setSuggestionStatus] = useState<'idle' | 'success' | 'error'>('idle');

    // Suggestions Tab State
    const [columns, setColumns] = useState<{ [key in StatusColumn]: any[] }>({
        pending: [],
        verified: [],
        banned: [],
        storage: []
    });
    const [channelColumns, setChannelColumns] = useState<{ [key in StatusColumn]: any[] }>({
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
        loadAllData();
    }, [activeView]);

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

    const loadAllData = async () => {
        setIsLoading(true);
        if (activeView === 'videos') {
            const [pending, verified, banned, storage] = await Promise.all([
                getPendingVideos(),
                getVerifiedVideos('evergreen', 1000),
                getDeniedVideos(),
                getStorageVideos()
            ]);
            setColumns({
                pending: pending || [],
                verified: verified || [],
                banned: banned || [],
                storage: storage || []
            });
        } else {
            const [pending, approved, banned, storage] = await Promise.all([
                getPendingChannels(),
                getApprovedChannels(),
                getDeniedChannels(),
                getStorageChannels()
            ]);
            setChannelColumns({
                pending: pending || [],
                verified: approved || [],
                banned: banned || [],
                storage: storage || []
            });
        }
        setIsLoading(false);
    };

    const handleMove = async (id: string, toStatus: StatusColumn) => {
        setActiveMenuId(null);
        const currentData = activeView === 'videos' ? columns : channelColumns;
        const setMethod = activeView === 'videos' ? setColumns : setChannelColumns;

        const sourceColumnKey = Object.keys(currentData).find(key =>
            currentData[key as StatusColumn].some((v: any) => v.id === id)
        ) as StatusColumn;

        if (!sourceColumnKey || sourceColumnKey === toStatus) return;

        const itemToMove = currentData[sourceColumnKey].find((v: any) => v.id === id);

        // Optimistic Update
        setMethod(prev => ({
            ...prev,
            [sourceColumnKey]: prev[sourceColumnKey].filter((v: any) => v.id !== id),
            [toStatus]: [itemToMove, ...prev[toStatus]]
        }));

        let serverAction: 'approve' | 'ban' | 'storage' | 'pending' = 'pending';
        if (toStatus === 'verified') serverAction = 'approve';
        else if (toStatus === 'banned') serverAction = 'ban';
        else if (toStatus === 'storage') serverAction = 'storage';

        let result;
        if (activeView === 'videos') {
            result = await moderateVideo(id, serverAction);
        } else {
            result = await moderateChannel(id, serverAction);
        }

        if (!result.success) {
            alert(`Failed to move: ${result.message}`);
            loadAllData(); // Revert
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

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm(`Are you sure you want to completely delete this ${activeView.slice(0, -1)}?`)) return;

        setActiveMenuId(null);

        const currentData = activeView === 'videos' ? columns : channelColumns;
        const setMethod = activeView === 'videos' ? setColumns : setChannelColumns;

        // Optimistic UI Removal
        const sourceColumnKey = Object.keys(currentData).find(key =>
            currentData[key as StatusColumn].some((v: any) => v.id === id)
        ) as StatusColumn;

        if (sourceColumnKey) {
            setMethod(prev => ({
                ...prev,
                [sourceColumnKey]: prev[sourceColumnKey].filter((v: any) => v.id !== id)
            }));
        }

        let result;
        if (activeView === 'videos') {
            result = await deleteVideo(id);
        } else {
            result = await deleteChannel(id);
        }

        if (!result.success) {
            alert(`Failed to delete: ${result.message}`);
            loadAllData();
        }
    };

    const handleSuggestChannel = async () => {
        if (!suggestionUrl) return;
        setIsSuggesting(true);
        setSuggestionStatus('idle');

        const result = await suggestChannel(suggestionUrl);

        if (result.success) {
            setSuggestionStatus('success');
            setSuggestionUrl("");
            loadAllData();
            setTimeout(() => setSuggestionStatus('idle'), 3000);
        } else {
            alert(result.message);
            setSuggestionStatus('error');
        }

        setIsSuggesting(false);
    };

    const renderColumn = (title: string, status: StatusColumn, icon: any, colorClass: string) => {
        const dataList = activeView === 'videos' ? columns[status] : channelColumns[status];
        return (
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
                    <span className="text-xs font-mono text-gray-500">{dataList.length}</span>
                </div>

                {/* Scroll Area */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                    {dataList.map((item: any) => (
                        <div
                            key={item.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            className={`group relative bg-black/40 border border-white/5 rounded-xl p-2 hover:border-white/20 transition-all ${draggedVideoId === item.id ? 'opacity-50' : 'opacity-100'} cursor-grab active:cursor-grabbing`}
                        >
                            {/* Row Layout */}
                            <div className="flex items-center gap-3">
                                {/* 1. Thumbnail/Avatar (Left) */}
                                {activeView === 'videos' ? (
                                    <div className="w-20 aspect-video rounded bg-gray-900 overflow-hidden flex-shrink-0 relative pointer-events-none">
                                        <img
                                            src={`https://img.youtube.com/vi/${item.id}/default.jpg`}
                                            className="w-full h-full object-cover opacity-80"
                                        />
                                    </div>
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-gray-900 overflow-hidden flex-shrink-0 relative pointer-events-none border border-white/10">
                                        {item.avatar_url ? (
                                            <img
                                                src={item.avatar_url}
                                                className="w-full h-full object-cover opacity-90"
                                                onError={(e) => {
                                                    e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2'%3E%3C/path%3E%3Ccircle cx='12' cy='7' r='4'%3E%3C/circle%3E%3C/svg%3E";
                                                    e.currentTarget.className = "w-full h-full object-cover opacity-50 p-2 bg-gray-900";
                                                }}
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs font-bold">CH</div>
                                        )}
                                    </div>
                                )}

                                {/* 2. Info (Middle) */}
                                <div className="flex-1 min-w-0 pointer-events-none">
                                    {activeView === 'channels' ? (
                                        <a href={item.channel_url} target="_blank" rel="noopener noreferrer" className="pointer-events-auto hover:underline decoration-white/50 cursor-pointer">
                                            <h4 className="text-xs font-bold text-gray-200 line-clamp-2 leading-tight mb-1" title={item.title || "Unknown Title"}>
                                                {item.title || item.id}
                                            </h4>
                                        </a>
                                    ) : (
                                        <h4 className="text-xs font-bold text-gray-200 line-clamp-2 leading-tight mb-1" title={item.title || "Unknown Title"}>
                                            {item.title || item.id}
                                        </h4>
                                    )}
                                    {activeView === 'videos' && (
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            {item.channel_url ? (
                                                <span
                                                    className="text-[10px] text-blue-400 truncate"
                                                >
                                                    {item.channel_title || item.channel_id || "Unknown Channel"}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-gray-500 truncate">{item.channel_title || item.channel_id || "Unknown Channel"}</span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* 3. Hexagon (Near Right) */}
                                <div className="flex-shrink-0 pointer-events-none" title={`Suggestion Count: ${item.suggestion_count || 1}`}>
                                    <Hexagon filledSegments={item.suggestion_count || 1} />
                                </div>

                                {/* 4. Action Dots (Far Right) */}
                                <div className="relative flex-shrink-0">
                                    <button
                                        onClick={(e) => handleMenuOpen(item.id, e)}
                                        // Re-enable pointer events for the button specifically
                                        className={`p-1 hover:bg-white/10 rounded transition-colors pointer-events-auto ${activeMenuId === item.id ? 'text-white bg-white/10' : 'text-gray-500 hover:text-white'}`}
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
                            <span className="font-bold text-xl tracking-tight text-red-500">Suggestions <span className="text-gray-500 font-normal text-sm ml-2">Inbox</span></span>
                        </div>
                    </div>
                    {/* View Toggle */}
                    <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                        <button
                            onClick={() => setActiveView('videos')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeView === 'videos' ? 'bg-red-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Videos
                        </button>
                        <button
                            onClick={() => setActiveView('channels')}
                            className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-all ${activeView === 'channels' ? 'bg-blue-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                        >
                            Channels
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="pt-24 pb-8 px-6 max-w-[1600px] mx-auto w-full flex-1 flex flex-col">
                {activeView === 'channels' && (
                    <div className="w-full max-w-lg mb-6 self-start relative">
                        <div className="absolute inset-0 bg-blue-600/20 rounded-full blur-xl animate-pulse" />
                        <input
                            type="text"
                            value={suggestionStatus === 'success' ? "Success! Added." : suggestionUrl}
                            onChange={(e) => {
                                if (suggestionStatus !== 'success') setSuggestionUrl(e.target.value);
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleSuggestChannel()}
                            placeholder="Paste a channel url..."
                            disabled={suggestionStatus === 'success'}
                            className={`w-full border-2 rounded-full py-3 px-6 text-sm focus:outline-none transition-all relative z-10 shadow-[0_0_20px_rgba(37,99,235,0.4)] ${suggestionStatus === 'success'
                                ? 'bg-green-900/20 border-green-500/50 text-green-400 font-bold tracking-wide'
                                : 'bg-[#1a1a1a] border-blue-600/60 text-white placeholder:text-blue-300/50 focus:border-blue-500 focus:bg-[#202020]'
                                }`}
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 z-20">
                            <button
                                onClick={handleSuggestChannel}
                                disabled={isSuggesting || suggestionStatus === 'success'}
                                className={`p-1.5 rounded-full transition-all duration-500 ease-out disabled:opacity-100 ${suggestionStatus === 'success'
                                    ? 'bg-green-500 text-white shadow-[0_0_20px_rgba(34,197,94,0.6)]'
                                    : 'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.8)]'
                                    }`}
                            >
                                <span className="sr-only">Submit</span>
                                {isSuggesting ? (
                                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                                ) : suggestionStatus === 'success' ? (
                                    <CheckCircle2 className="w-4 h-4" />
                                ) : (
                                    <Box className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                    </div>
                )}
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
                                    // Find the active item and its status
                                    const currentDataList = activeView === 'videos' ? columns : channelColumns;
                                    let activeItem: any = null;
                                    let activeStatus: StatusColumn | null = null;
                                    for (const statusEnv of ['pending', 'verified', 'banned', 'storage'] as StatusColumn[]) {
                                        const found = currentDataList[statusEnv].find((v: any) => v.id === activeMenuId);
                                        if (found) {
                                            activeItem = found;
                                            activeStatus = statusEnv;
                                            break;
                                        }
                                    }

                                    if (!activeItem || !activeStatus) return null;

                                    return (
                                        <>
                                            {activeStatus !== 'pending' && <button onClick={() => handleMove(activeItem.id, 'pending')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-yellow-500">Move to Pending</button>}
                                            {activeStatus !== 'verified' && <button onClick={() => handleMove(activeItem.id, 'verified')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-green-500">Approve</button>}
                                            {activeStatus !== 'storage' && <button onClick={() => handleMove(activeItem.id, 'storage')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-blue-500">Move to Storage</button>}
                                            {activeStatus !== 'banned' && <button onClick={() => handleMove(activeItem.id, 'banned')} className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 text-red-500">Deny</button>}
                                            <div className="h-px bg-white/10 my-1"></div>
                                            <button onClick={(e) => handleDelete(activeItem.id, e)} className="w-full text-left px-3 py-2 text-xs hover:bg-red-900/20 text-red-600 font-bold flex items-center gap-2">
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
