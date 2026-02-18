"use client";

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, User, Target, Zap, Save, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getMyMission } from '../actions/video-actions';
import { updateProfile, updateProfileAvatar } from '../actions/profile-actions';
import { supabase } from '@/lib/supabaseClient';

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

export default function Profile() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        email: '',
        goal: GOALS[0],
        struggle: STRUGGLES[0]
    });

    const [avatarUrl, setAvatarUrl] = useState('');
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const [customGoal, setCustomGoal] = useState('');
    const [customStruggle, setCustomStruggle] = useState('');
    const [showCustomGoal, setShowCustomGoal] = useState(false);
    const [showCustomStruggle, setShowCustomStruggle] = useState(false);

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const mission = await getMyMission();
                if (mission) {
                    const isCustomGoal = !GOALS.includes(mission.goal);
                    const isCustomStruggle = !STRUGGLES.includes(mission.obstacle);

                    setFormData({
                        name: mission.userDetails?.name || '',
                        email: mission.userDetails?.email || '',
                        goal: isCustomGoal ? 'Other...' : mission.goal,
                        struggle: isCustomStruggle ? 'Other...' : mission.obstacle
                    });

                    if (mission.userDetails?.avatar_url) {
                        setAvatarUrl(mission.userDetails.avatar_url);
                    }

                    if (isCustomGoal) {
                        setCustomGoal(mission.goal);
                        setShowCustomGoal(true);
                    }
                    if (isCustomStruggle) {
                        setCustomStruggle(mission.obstacle);
                        setShowCustomStruggle(true);
                    }
                } else {
                    // No mission found, redirect to onboarding to create one
                    router.push('/onboarding');
                }
            } catch (e) {
                console.error("Failed to load profile", e);
                setError("Failed to load profile data.");
            } finally {
                setLoading(false);
            }
        };

        loadProfile();
    }, [router]);

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
            const fileName = `avatars/${Date.now()}.webp`;

            // Note: In a real auth setup, we'd use user ID, but we rely on storage policies or anon upload here.
            // Since we don't have the user ID easily on client without auth session context for storage policies, 
            // ensure bucket is public or we use a signed URL if we had backend upload.
            // Using 'anon' upload requires public bucket policy.

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

            // 4. Update Profile Metadata
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

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black text-white font-sans p-6 md:p-12 relative overflow-hidden flex items-center justify-center">
            {/* Background Ambience */}
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-2xl relative z-10">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Feed
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0f0f0f] border border-white/5 backdrop-blur-md rounded-3xl p-6 md:p-10 shadow-2xl"
                >
                    <div className="flex items-center gap-4 mb-8 border-b border-white/5 pb-8">
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

                    <div className="space-y-6">
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
                            <p className="text-center text-xs text-gray-500 mt-4">
                                Updating your goal will refresh your video feed to match your new direction.
                            </p>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
