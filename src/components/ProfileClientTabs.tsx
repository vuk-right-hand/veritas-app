"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { User, Trophy, Lock, Brain, CheckCircle2, Save, Zap, Eye, EyeOff, Target, Clock, ChevronRight, Play, Handshake } from 'lucide-react';
import { updateProfile, updateProfileAvatar, updateUserPassword } from '@/app/actions/profile-actions';
import { logoutUser } from '@/app/actions/auth-actions';
import { supabase } from '@/lib/supabaseClient';
import SkillProgressCard from '@/components/SkillProgressCard';
import { toggleHandshake } from '@/app/actions/handshake-actions';
import type { HandshakeCreator } from '@/app/actions/handshake-actions';

const GOALS = [
    "Make $10,000/m Online",
    "Master VibeCoding",
    "Build a Personal Brand",
    "Other..."
];

const STRUGGLES = [
    "Procrastination",
    "Lack of Focus",
    "Don't Know Where to Start",
    "Other..."
];

interface ProfileClientTabsProps {
    initialMission: any;
    skillsMatrix: Record<string, any>;
    topCreators: any[];
    watchHistory: any[];
    handshakes: HandshakeCreator[];
}

export default function ProfileClientTabs({ initialMission, skillsMatrix, topCreators, watchHistory, handshakes: initialHandshakes }: ProfileClientTabsProps) {
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: initialMission?.userDetails?.name || '',
        email: initialMission?.userDetails?.email || '',
        goal: initialMission ? (!GOALS.includes(initialMission.goal) ? 'Other...' : initialMission.goal) : GOALS[0],
        struggle: initialMission ? (!STRUGGLES.includes(initialMission.obstacle) ? 'Other...' : initialMission.obstacle) : STRUGGLES[0]
    });

    const [password, setPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(initialMission?.userDetails?.avatar_url || '');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [customGoal, setCustomGoal] = useState(initialMission && !GOALS.includes(initialMission.goal) ? initialMission.goal : '');
    const [customStruggle, setCustomStruggle] = useState(initialMission && !STRUGGLES.includes(initialMission.obstacle) ? initialMission.obstacle : '');
    
    const [showCustomGoal, setShowCustomGoal] = useState(initialMission && !GOALS.includes(initialMission.goal));
    const [showCustomStruggle, setShowCustomStruggle] = useState(initialMission && !STRUGGLES.includes(initialMission.obstacle));
    
    const [showResetPassword, setShowResetPassword] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);

    // Tab state
    const [activeTab, setActiveTab] = useState<'profile' | 'proof-of-work' | 'history' | 'handshakes'>('profile');
    const [handshakesList, setHandshakesList] = useState<HandshakeCreator[]>(initialHandshakes || []);
    const [unhandshakeLoading, setUnhandshakeLoading] = useState<string | null>(null);


    const handleGoalSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFormData({ ...formData, goal: val });
        if (val === 'Other...') {
            setShowCustomGoal(true);
        } else {
            setShowCustomGoal(false);
        }
    };

    const handleStruggleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFormData({ ...formData, struggle: val });
        if (val === 'Other...') {
            setShowCustomStruggle(true);
        } else {
            setShowCustomStruggle(false);
        }
    };

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingAvatar(true);
        setError('');

        try {
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

            const fileName = `avatars/${Date.now()}.webp`;

            const { data, error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, compressedBlob, {
                    contentType: 'image/webp',
                    upsert: true
                });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(fileName);

            const updateResult = await updateProfileAvatar(publicUrl);
            if (!updateResult.success) throw new Error(updateResult.message);

            setAvatarUrl(publicUrl);
            setSuccessMessage("Profile picture updated!");
            setTimeout(() => setSuccessMessage(''), 3000);

        } catch (err: any) {
            console.error("Upload failed", err);
            setError("Failed to upload image. " + (err.message || ''));
        } finally {
            setUploadingAvatar(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setSuccessMessage('');

        if (password) {
            if (password.length < 6) {
                setError("Password must be at least 6 characters.");
                setSaving(false);
                return;
            }

            const pwdResult = await updateUserPassword(password);
            if (!pwdResult.success) {
                setError(pwdResult.message || "Failed to update password.");
                setSaving(false);
                return;
            }

            setPassword('');
        }

        const finalGoal = formData.goal === 'Other...' ? customGoal : formData.goal;
        const finalStruggle = formData.struggle === 'Other...' ? customStruggle : formData.struggle;

        if (!formData.name || !formData.email || !finalGoal || !finalStruggle) {
            setError("All fields are required.");
            setSaving(false);
            return;
        }

        const result = await updateProfile({
            name: formData.name,
            email: formData.email,
            goal: finalGoal,
            struggle: finalStruggle
        });

        if (result.success) {
            setSuccessMessage("Profile updated successfully!");
            setTimeout(() => setSuccessMessage(''), 3000);
        } else {
            setError(result.message || "Failed to update profile.");
        }
        setSaving(false);
    };

    const handleLogout = async () => {
        try {
            await logoutUser();
        } catch (e) { }
        window.location.href = '/dashboard';
    };

    return (
        <div className="w-full max-w-2xl relative z-10">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0f0f0f] border border-white/5 backdrop-blur-md rounded-3xl p-6 md:p-10 shadow-2xl"
            >
                <div className="flex items-center gap-4 mb-8">
                    <div
                        className="w-16 h-16 rounded-full bg-red-600/10 flex items-center justify-center border border-red-500/20 relative cursor-pointer group overflow-hidden"
                        onClick={handleAvatarClick}
                    >
                        {uploadingAvatar ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                            </div>
                        ) : avatarUrl ? (
                            <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                            <User className="w-8 h-8 text-red-500 group-hover:scale-110 transition-transform" />
                        )}
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileChange}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <span className="text-[10px] uppercase font-bold text-white tracking-wider">Edit</span>
                        </div>
                    </div>
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold">Your Profile</h1>
                        <p className="text-gray-400">Manage your identity and mission.</p>
                    </div>
                </div>

                {/* Tab Switcher — horizontal scroll, pill cards */}
                <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar scroll-smooth -mx-1 px-1">
                    {([
                        { key: 'profile' as const, label: 'Profile', icon: <User className="w-3.5 h-3.5" /> },
                        { key: 'proof-of-work' as const, label: 'Proof of Work', icon: <Trophy className="w-3.5 h-3.5" /> },
                        { key: 'history' as const, label: 'History', icon: <Clock className="w-3.5 h-3.5" /> },
                        { key: 'handshakes' as const, label: 'Handshakes', icon: <Handshake className="w-3.5 h-3.5" /> },
                    ]).map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all flex-shrink-0 ${
                                activeTab === tab.key
                                    ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                                    : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    {/* Profile Tab Content */}
                    {activeTab === 'profile' && (
                        <motion.div
                            key="profile"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-6"
                        >
                            {/* Personal Info */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-2 tracking-wider">Full Name</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600"
                                        placeholder="Enter your name"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-2 tracking-wider">Email Address</label>
                                    <input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600"
                                        placeholder="Enter your email"
                                    />
                                </div>
                            </div>

                            {/* Account Security */}
                            <div className="pt-6 border-t border-white/5 space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                                        <Lock className="w-4 h-4 text-gray-400" />
                                        Account Security
                                    </h3>
                                    <button
                                        onClick={() => setShowResetPassword(!showResetPassword)}
                                        className="text-xs font-medium text-red-500 hover:text-red-400 transition-colors"
                                    >
                                        Reset password
                                    </button>
                                </div>
                                <AnimatePresence>
                                    {showResetPassword && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="space-y-4 overflow-hidden"
                                        >
                                            <div>
                                                <label className="block text-xs uppercase text-gray-500 font-bold mb-2 tracking-wider">New Password</label>
                                                <div className="relative">
                                                    <input
                                                        type={showNewPassword ? "text" : "password"}
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl py-3 px-4 pr-12 text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600"
                                                        placeholder="Enter new password"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                                    >
                                                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            {/* Mission */}
                            <div className="pt-6 border-t border-white/5">
                                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Target className="w-5 h-5 text-red-500" />
                                    Current Mission
                                </h2>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs uppercase text-gray-500 font-bold mb-2 tracking-wider">Main Goal</label>
                                        <select
                                            value={formData.goal}
                                            onChange={handleGoalSelect}
                                            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-red-500/50 transition-colors appearance-none cursor-pointer"
                                        >
                                            {GOALS.map(g => (
                                                <option key={g} value={g}>{g}</option>
                                            ))}
                                        </select>
                                        {showCustomGoal && (
                                            <input
                                                type="text"
                                                value={customGoal}
                                                onChange={(e) => setCustomGoal(e.target.value)}
                                                className="mt-2 w-full bg-[#1a1a1a] border border-red-500/30 rounded-xl p-4 text-white focus:outline-none focus:border-red-500 transition-colors placeholder:text-gray-600"
                                                placeholder="Describe your specific goal..."
                                            />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs uppercase text-gray-500 font-bold mb-2 tracking-wider">Biggest Struggle</label>
                                        <select
                                            value={formData.struggle}
                                            onChange={handleStruggleSelect}
                                            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-red-500/50 transition-colors appearance-none cursor-pointer"
                                        >
                                            {STRUGGLES.map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                        {showCustomStruggle && (
                                            <input
                                                type="text"
                                                value={customStruggle}
                                                onChange={(e) => setCustomStruggle(e.target.value)}
                                                className="mt-2 w-full bg-[#1a1a1a] border border-red-500/30 rounded-xl p-4 text-white focus:outline-none focus:border-red-500 transition-colors placeholder:text-gray-600"
                                                placeholder="Describe your struggle..."
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Status Messages */}
                            {error && (
                                <div className="p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-200 text-sm font-medium flex items-center gap-2">
                                    <Zap className="w-4 h-4" /> {error}
                                </div>
                            )}

                            {successMessage && (
                                <div className="p-4 rounded-xl bg-green-900/20 border border-green-500/30 text-green-200 text-sm font-medium flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" /> {successMessage}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="pt-4">
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="w-full bg-white text-black font-bold py-4 rounded-xl hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {saving ? (
                                        <>
                                            <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                                            Saving Changes...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Save Changes
                                        </>
                                    )}
                                </button>

                                <div className="text-center mt-4">
                                    <button
                                        onClick={() => setShowLogoutModal(true)}
                                        className="text-[13px] text-gray-500 hover:text-white transition-colors"
                                    >
                                        Log out
                                    </button>
                                </div>

                                <p className="text-center text-xs text-gray-500 mt-4">
                                    Updating your goal will refresh your video feed to match your new direction.
                                </p>
                            </div>
                        </motion.div>
                    )}

                    {/* Proof of Work Tab Content */}
                    {activeTab === 'proof-of-work' && (
                        <motion.div
                            key="proof-of-work"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-6"
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 rounded-xl bg-red-600/20 flex items-center justify-center">
                                    <Brain className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">Your Skills</h2>
                                    <p className="text-xs text-gray-500">Built from Proof of Work quizzes</p>
                                </div>
                            </div>
                            <SkillProgressCard skillsMatrix={skillsMatrix} />
                        </motion.div>
                    )}

                    {/* Watch History Tab Content */}
                    {activeTab === 'history' && (
                        <motion.div
                            key="history"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-8"
                        >
                            {/* Top Creators Section */}
                            <div>
                                <h2 className="text-sm font-bold uppercase tracking-widest text-green-400 mb-4 flex items-center gap-2">
                                    <Trophy className="w-4 h-4" />
                                    Top Creators
                                </h2>
                                {topCreators.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                        {topCreators.map((creator, index) => {
                                            const totalMinutes = Math.floor(creator.watchSeconds / 60);
                                            const hours = Math.floor(totalMinutes / 60);
                                            const mins = totalMinutes % 60;
                                            const displayTime = hours > 0
                                                ? `${hours}h ${mins > 0 ? `${mins}m` : ''}`
                                                : `${totalMinutes}m`;

                                            const card = (
                                                <div className="h-full bg-[#111] border border-white/5 hover:border-green-500/30 rounded-2xl p-4 flex flex-col gap-2 transition-all group">
                                                    <div className="text-[11px] uppercase tracking-widest text-gray-500 font-bold">#{index + 1} Creator</div>
                                                    <div className="text-sm font-semibold text-white line-clamp-2 group-hover:text-green-400 transition-colors leading-snug">
                                                        {creator.channelName}
                                                    </div>
                                                    <div className="mt-auto pt-2 border-t border-white/5">
                                                        <span className="text-xl font-black text-green-400">{displayTime}</span>
                                                        <span className="text-[10px] text-gray-500 ml-1.5 uppercase tracking-wider">watched</span>
                                                    </div>
                                                </div>
                                            );

                                            return creator.creatorSlug ? (
                                                <Link key={index} href={`/c/${creator.creatorSlug}`} className="block">
                                                    {card}
                                                </Link>
                                            ) : (
                                                <div key={index}>{card}</div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-500 py-6 text-center border border-white/5 rounded-2xl border-dashed">
                                        Watch videos to see your top creators here.
                                    </div>
                                )}
                            </div>

                            {/* Recently Watched — 3-item preview, full list at /watch-history */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-bold uppercase tracking-widest text-red-400 flex items-center gap-2">
                                        <Clock className="w-4 h-4" />
                                        Recently Watched
                                    </h2>
                                    {watchHistory.length > 0 && (
                                        <Link
                                            href="/watch-history"
                                            className="text-[11px] font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-colors flex items-center gap-1"
                                        >
                                            See all
                                            <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    )}
                                </div>
                                {watchHistory.length > 0 ? (
                                    <>
                                        <div className="space-y-0.5">
                                            {watchHistory.slice(0, 3).map((video) => (
                                                <a
                                                    key={video.id}
                                                    href={`/v/${video.slug || video.video_id}`}
                                                    className="group flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors"
                                                >
                                                    {/* Thumbnail */}
                                                    <div className="relative w-28 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-zinc-900">
                                                        <img
                                                            src={`https://img.youtube.com/vi/${video.video_id}/mqdefault.jpg`}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                            loading="lazy"
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <Play className="w-5 h-5 text-white fill-white drop-shadow" />
                                                        </div>
                                                    </div>
                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[13px] font-semibold text-white line-clamp-2 leading-snug group-hover:text-red-400 transition-colors">
                                                            {video.title}
                                                        </p>
                                                        <p className="text-[11px] text-gray-500 mt-0.5 truncate">{video.channelTitle}</p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-gray-700 group-hover:text-gray-400 flex-shrink-0 transition-colors" />
                                                </a>
                                            ))}
                                        </div>

                                        <Link
                                            href="/watch-history"
                                            className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-white/8 hover:border-red-500/30 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-white transition-all"
                                        >
                                            View full history
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Link>
                                    </>
                                ) : (
                                    <div className="text-sm text-gray-500 py-8 text-center border border-white/5 rounded-2xl border-dashed">
                                        No recent watch history found.
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* Handshakes Tab Content */}
                    {activeTab === 'handshakes' && (
                        <motion.div
                            key="handshakes"
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-4"
                        >
                            <h2 className="text-sm font-bold uppercase tracking-widest text-red-400 flex items-center gap-2">
                                <Handshake className="w-4 h-4" />
                                Your Handshakes
                            </h2>

                            {handshakesList.length > 0 ? (
                                <div className="space-y-1">
                                    {handshakesList.map((creator) => (
                                        <div
                                            key={creator.creatorId}
                                            className="flex items-center gap-3 p-3 rounded-xl bg-[#111] border border-white/5 hover:border-white/10 transition-colors group"
                                        >
                                            {/* Avatar */}
                                            {creator.avatarUrl ? (
                                                <img
                                                    src={creator.avatarUrl}
                                                    alt={creator.channelName}
                                                    className="w-10 h-10 rounded-full object-cover border border-white/10"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-red-900/20 border border-red-500/20 flex items-center justify-center text-sm font-bold text-red-400">
                                                    {creator.channelName?.charAt(0) || '?'}
                                                </div>
                                            )}

                                            {/* Name — clickable link to creator channel */}
                                            <div className="flex-1 min-w-0">
                                                {creator.slug ? (
                                                    <Link
                                                        href={`/c/${creator.slug}`}
                                                        className="text-sm font-semibold text-white hover:text-red-400 transition-colors truncate block"
                                                    >
                                                        {creator.channelName}
                                                    </Link>
                                                ) : (
                                                    <span className="text-sm font-semibold text-white truncate block">
                                                        {creator.channelName}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Unhandshake button */}
                                            <button
                                                onClick={async () => {
                                                    setUnhandshakeLoading(creator.creatorId);
                                                    // Optimistic removal
                                                    setHandshakesList(prev => prev.filter(c => c.creatorId !== creator.creatorId));
                                                    const result = await toggleHandshake(creator.creatorId);
                                                    if (result.error) {
                                                        // Revert on error
                                                        setHandshakesList(prev => [...prev, creator]);
                                                    }
                                                    setUnhandshakeLoading(null);
                                                }}
                                                disabled={unhandshakeLoading === creator.creatorId}
                                                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider text-gray-500 hover:text-red-400 border border-white/5 hover:border-red-500/20 transition-all"
                                            >
                                                Unhandshake
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-sm text-gray-500 py-8 text-center border border-white/5 rounded-2xl border-dashed">
                                    No handshakes yet. Visit a creator&apos;s channel to handshake them.
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* Logout Confirmation Modal */}
            <AnimatePresence>
                {showLogoutModal && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowLogoutModal(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                        />

                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 50 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 50 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-[90%] max-w-sm bg-[#111] border border-white/10 rounded-2xl shadow-2xl p-6 text-center"
                        >
                            <h2 className="text-2xl font-bold text-white mb-3">Please confirm...</h2>
                            <p className="text-gray-400 text-sm mb-8 leading-relaxed">
                                This will re-customize your feed and lock most of the features on the platform.
                            </p>

                            <button
                                onClick={handleLogout}
                                className="w-full py-4 px-6 bg-white hover:bg-gray-200 text-black font-bold rounded-xl transition-all transform active:scale-95"
                            >
                                Log out
                            </button>
                            <button
                                onClick={() => setShowLogoutModal(false)}
                                className="mt-4 text-sm text-gray-500 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
