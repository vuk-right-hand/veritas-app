"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Youtube, BarChart3, Users, Zap, Search, Copy, Clock, AlertCircle } from 'lucide-react';
import { getChannelMetadata, verifyChannelOwnership } from '../actions/video-actions';

// Mock Data for Dashboard
const MOCK_CHANNEL_STATS = {
    subscribers: "1.2M",
    videosPromoted: 12,
    totalVeritasViews: "450K",
    humanScoreAvg: 96
};

const MOCK_PROMOTED_VIDEOS = [
    { id: "hJKe5P9y6V4", title: "How I Started A $100M Company (In 2024)", views: "125K", humanScore: 98, status: "Active" },
    { id: "BSX8VjX3l00", title: "Mental Models for Founders", views: "89K", humanScore: 95, status: "Active" },
    { id: "pL5223_Cq1s", title: "The Ultimate Guide To Deep Work", views: "236K", humanScore: 92, status: "Trending" },
];

export default function CreatorDashboard() {
    // State
    const [isClaimed, setIsClaimed] = useState(false);

    // Claim Flow State
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [channelUrl, setChannelUrl] = useState("");
    const [email, setEmail] = useState("");
    const [channelName, setChannelName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Verification State
    const [verificationToken, setVerificationToken] = useState("");
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(60);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Password State
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSettingPassword, setIsSettingPassword] = useState(false);
    const [claimStatus, setClaimStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

    // Step 1: Handle initial submit (URL + Email)
    const handleStartClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            // Fetch channel metadata to confirm it exists and get name
            const { title, success } = await getChannelMetadata(channelUrl);

            if (success) {
                setChannelName(title);
                setStep(2);
            } else {
                setError("Could not find channel. Please check the URL.");
            }
        } catch (err) {
            setError("An error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Step 2: Generate Token
    const generateToken = () => {
        const randomString = Math.random().toString(36).substring(2, 10).toUpperCase();
        setVerificationToken(`VERITAS-${randomString}`);
    };

    const copyToken = () => {
        if (verificationToken) {
            navigator.clipboard.writeText(verificationToken);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

    // Step 2: Start Verification Process
    const startVerification = () => {
        setIsTimerRunning(true);
        setTimeLeft(60);
    };

    // Timer Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (isTimerRunning && timeLeft === 0) {
            // Timer finished, run verification
            setIsTimerRunning(false);
            performVerification();
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, timeLeft]);

    const performVerification = async () => {
        setIsVerifying(true);
        try {
            const result = await verifyChannelOwnership(channelUrl, verificationToken);
            if (result.success) {
                // Instead of jumping to claimed, go to Password Step
                setStep(3); // 3 = Password Set
            } else {
                setError("Verification failed. We couldn't find the token in your channel description. Please try again.");
                setIsTimerRunning(false); // Reset to allow retry
            }
        } catch (err) {
            setError("Verification failed due to an error. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleFinalizeClaim = async () => {
        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setError("");
        setClaimStatus('loading');

        try {
            // Dynamically import to avoid server action issues in client component if checking types strict
            const { finalizeChannelClaim } = await import('../actions/auth-actions');

            const result = await finalizeChannelClaim(email, password, {
                url: channelUrl,
                title: channelName,
                token: verificationToken
            });

            if (result.success) {
                setClaimStatus('success');
                // Auto-close after 4 seconds
                setTimeout(() => {
                    setClaimStatus('idle'); // or keep success?
                    setIsClaimed(true); // Show dashboard
                }, 4000);
            } else {
                setClaimStatus('error');
                setError(result.message);
            }
        } catch (e: any) {
            setClaimStatus('error');
            setError(e.message || "Failed to finalize claim.");
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-500/30">

            {/* Navbar */}
            <nav className="fixed top-0 w-full z-50 border-b border-white/5 bg-black/80 backdrop-blur-xl">
                <div className="max-w-[1600px] mx-auto px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/dashboard" className="p-2 -ml-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors">
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-red-600 to-red-900 shadow-[0_0_15px_rgba(220,38,38,0.5)]" />
                            <span className="font-bold text-xl tracking-tight">Veritas <span className="text-gray-500 font-normal text-sm ml-2">for Creators</span></span>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-8 max-w-[1200px] mx-auto min-h-[80vh] flex flex-col justify-center">

                <AnimatePresence mode='wait'>
                    {!isClaimed ? (
                        /* STATE 1: UNCLAIMED (Claim Flow) */
                        <motion.div
                            key="unclaimed"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full max-w-2xl mx-auto text-center"
                        >
                            {step !== 3 && (
                                <>
                                    <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-900/10 border border-red-500/20 shadow-[0_0_40px_rgba(220,38,38,0.1)]">
                                        <Youtube className="w-10 h-10 text-red-500" />
                                    </div>

                                    <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 mb-6">
                                        Claim Your Authority.
                                    </h1>

                                    <p className="text-lg text-gray-400 mb-12 leading-relaxed">
                                        Veritas aggregates only the highest quality, human-verified content.
                                        <br />Claim your channel to manage your presence and see who's watching.
                                    </p>
                                </>
                            )}

                            {step === 3 && claimStatus === 'success' && (
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="max-w-md mx-auto bg-green-500/10 border border-green-500/20 p-8 rounded-2xl relative overflow-hidden"
                                >
                                    <div className="absolute top-4 right-4">
                                        <button onClick={() => setIsClaimed(true)} className="p-2 text-green-400 hover:text-white transition-colors">
                                            ✕
                                        </button>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-white mb-2">Success!</h3>
                                        <p className="text-gray-300 text-sm">
                                            You can safely remove the token from your description.
                                        </p>
                                        <div className="mt-6 w-full h-1 bg-green-500/20 rounded-full overflow-hidden">
                                            <motion.div
                                                className="h-full bg-green-500"
                                                initial={{ width: "100%" }}
                                                animate={{ width: "0%" }}
                                                transition={{ duration: 4, ease: "linear" }}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            )}

                            {step === 3 && claimStatus !== 'success' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="max-w-md mx-auto bg-[#111] p-8 rounded-2xl border border-white/10 shadow-2xl relative"
                                >
                                    <div className="mb-6 text-center">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-900/20 text-green-400 mb-4">
                                            <CheckCircle2 className="w-6 h-6" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white">Channel Verified!</h3>
                                        <p className="text-gray-400 text-sm mt-2">
                                            Set a password to lock your dashboard.
                                        </p>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <input
                                                type="password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                placeholder="Password"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-gray-600"
                                            />
                                        </div>
                                        <div>
                                            <input
                                                type="password"
                                                value={confirmPassword}
                                                onChange={(e) => setConfirmPassword(e.target.value)}
                                                placeholder="Re-type password"
                                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-gray-600"
                                            />
                                        </div>

                                        {error && (
                                            <div className="text-red-400 text-xs text-center">{error}</div>
                                        )}

                                        <button
                                            onClick={handleFinalizeClaim}
                                            disabled={claimStatus === 'loading'}
                                            className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all disabled:opacity-50 mt-4"
                                        >
                                            {claimStatus === 'loading' ? 'Setting up...' : 'Secure & Enter Dashboard'}
                                        </button>
                                    </div>
                                </motion.div>
                            )}

                            {step === 1 ? (
                                /* STEP 1: URL & Email Input */
                                <form onSubmit={handleStartClaim} className="relative max-w-lg mx-auto flex flex-col gap-4">
                                    <div className="relative group">
                                        <div className="absolute inset-0 bg-red-600/20 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                        <input
                                            type="text"
                                            value={channelUrl}
                                            onChange={(e) => setChannelUrl(e.target.value)}
                                            placeholder="Paste your YouTube Channel URL..."
                                            className="w-full bg-[#151515] border border-white/10 rounded-full py-4 px-8 text-white focus:outline-none focus:border-red-500/50 focus:bg-[#1a1a1a] transition-all relative z-10 placeholder:text-gray-600 text-center shadow-2xl"
                                            required
                                        />
                                    </div>
                                    <div className="relative group">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your email address..."
                                            className="w-full bg-[#151515] border border-white/10 rounded-full py-4 px-8 text-white focus:outline-none focus:border-red-500/50 focus:bg-[#1a1a1a] transition-all relative z-10 placeholder:text-gray-600 text-center shadow-2xl"
                                            required
                                        />
                                    </div>

                                    {error && (
                                        <div className="text-red-400 text-sm mt-2 flex items-center justify-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            {error}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={isLoading}
                                        className="mt-4 px-12 py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto w-full md:w-auto"
                                    >
                                        {isLoading ? (
                                            <>
                                                <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                                                Locating Channel...
                                            </>
                                        ) : (
                                            <>
                                                <span>Verify & Claim</span>
                                                <CheckCircle2 className="w-5 h-5" />
                                            </>
                                        )}
                                    </button>
                                </form>
                            ) : step === 2 ? (
                                /* STEP 2: Token Verification */
                                <motion.div
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="max-w-lg mx-auto bg-[#111] p-8 rounded-2xl border border-white/10"
                                >
                                    <div className="mb-6 text-left">
                                        <h3 className="text-xl font-bold text-white mb-2">Verify Ownership</h3>
                                        <p className="text-gray-400 text-sm leading-relaxed">
                                            IMPORTANT: To ensure that you are the actual owner of <strong className="text-white">{channelName}</strong>, we need to verify that you have "Write Access" to the channel.
                                        </p>
                                    </div>

                                    {!verificationToken ? (
                                        <button
                                            onClick={generateToken}
                                            className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <Zap className="w-4 h-4" />
                                            Generate Verification Token
                                        </button>
                                    ) : (
                                        <div className="space-y-6">
                                            <div className="bg-black/50 p-4 rounded-xl border border-white/10 flex items-center justify-between group">
                                                <code className="text-lg font-mono text-red-400">{verificationToken}</code>
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-xs ${isCopied ? 'text-green-400 opacity-100' : 'text-gray-500 opacity-0 group-hover:opacity-100'} transition-all`}>
                                                        {isCopied ? 'Copied!' : 'Click to copy'}
                                                    </span>
                                                    <button
                                                        onClick={copyToken}
                                                        className={`p-2 rounded-lg transition-colors ${isCopied ? 'text-green-400 bg-green-900/20' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                                                        title="Copy to clipboard"
                                                    >
                                                        {isCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="text-sm text-gray-500 text-left space-y-2">
                                                <p><strong className="text-gray-300">Desktop:</strong> Channel Dashboard {'>'} Customization {'>'} Basic Info {'>'} Description</p>
                                                <p><strong className="text-gray-300">Mobile:</strong> Profile Icon {'>'} View Channel {'>'} Edit Channel (Pencil) {'>'} Description</p>
                                            </div>

                                            {!isTimerRunning ? (
                                                <>
                                                    {error && (
                                                        <div className="text-red-400 text-sm p-3 bg-red-900/10 rounded-lg border border-red-500/20 text-left">
                                                            {error}
                                                        </div>
                                                    )}
                                                    <button
                                                        onClick={startVerification}
                                                        disabled={isVerifying}
                                                        className="w-full py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                    >
                                                        {isVerifying ? 'Checking...' : 'Done & Verify'}
                                                    </button>
                                                </>
                                            ) : (
                                                <div className="py-4 text-center">
                                                    <div className="text-4xl font-mono font-bold text-white mb-2 tabular-nums">
                                                        00:{timeLeft.toString().padStart(2, '0')}
                                                    </div>
                                                    <p className="text-sm text-gray-500">
                                                        Verifying your channel... <br />
                                                        <span className="text-xs opacity-70">Give it 60 seconds to prevent "race-condition hacks"</span>
                                                    </p>
                                                    <div className="mt-4 w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                        <motion.div
                                                            className="h-full bg-red-500"
                                                            initial={{ width: "100%" }}
                                                            animate={{ width: "0%" }}
                                                            transition={{ duration: 60, ease: "linear" }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                </motion.div>
                            ) : null}

                            <p className="mt-8 text-xs text-gray-600">
                                By claiming, you agree to our anti-AI content policy.
                            </p>
                        </motion.div>

                    ) : (
                        /* STATE 3: CLAIMED (Dashboard View) */
                        <motion.div
                            key="claimed"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="w-full"
                        >
                            {/* Header Info */}
                            <div className="flex flex-col md:flex-row items-end justify-between gap-6 mb-12 border-b border-white/5 pb-8">
                                <div className="flex items-center gap-6">
                                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-gray-700 to-black border-2 border-white/10 shadow-2xl flex items-center justify-center text-3xl font-bold overflow-hidden">
                                        {/* Placeholder Avatar or Initials based on Channel Name */}
                                        {channelName.substring(0, 2).toUpperCase() || "AH"}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h1 className="text-3xl font-bold text-white">{channelName || "Alex Hormozi"}</h1>
                                            <CheckCircle2 className="w-5 h-5 text-blue-400 fill-blue-400/10" />
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-gray-400">
                                            <span>@{channelName.replace(/\s+/g, '') || "AlexHormozi"}</span>
                                            <span className="text-gray-600">•</span>
                                            <span className="text-green-400 font-medium">Verified Human Creator</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <button className="px-6 py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-sm font-medium">
                                        Manage Links
                                    </button>
                                    <button className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 transition-colors text-sm font-bold text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]">
                                        Submit New Video
                                    </button>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
                                {[
                                    { label: 'Total Veritas Views', value: MOCK_CHANNEL_STATS.totalVeritasViews, icon: Users, color: 'text-blue-400' },
                                    { label: 'Human Score Avg', value: `${MOCK_CHANNEL_STATS.humanScoreAvg}%`, icon: Zap, color: 'text-yellow-400' },
                                    { label: 'Videos Promoted', value: MOCK_CHANNEL_STATS.videosPromoted, icon: Youtube, color: 'text-red-400' },
                                    { label: 'Engagement Rate', value: '18.5%', icon: BarChart3, color: 'text-green-400' },
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

                            {/* Promoted Videos List */}
                            <div className="bg-[#111] rounded-2xl border border-white/5 overflow-hidden">
                                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                    <h2 className="text-lg font-bold text-white">Active Promotions</h2>
                                    <div className="bg-black/50 border border-white/5 rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs text-gray-400">
                                        <Search className="w-3.5 h-3.5" />
                                        <span>Search videos...</span>
                                    </div>
                                </div>

                                <div className="divide-y divide-white/5">
                                    {MOCK_PROMOTED_VIDEOS.map((video) => (
                                        <div key={video.id} className="p-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
                                            {/* Thumbnail Preview */}
                                            <div className="w-24 aspect-video bg-gray-800 rounded-md overflow-hidden relative">
                                                <img
                                                    src={`https://img.youtube.com/vi/${video.id}/default.jpg`}
                                                    alt={video.title}
                                                    className="w-full h-full object-cover opacity-80"
                                                />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-sm font-medium text-white truncate group-hover:text-red-400 transition-colors">{video.title}</h3>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                                                    <span>Published: 2 days ago</span>
                                                    <span>•</span>
                                                    <span className={video.status === 'Trending' ? 'text-green-400 font-bold' : ''}>{video.status}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-8 px-4">
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500">Human Score</div>
                                                    <div className="text-sm font-bold text-green-400">{video.humanScore}%</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs text-gray-500">Views</div>
                                                    <div className="text-sm font-bold text-white">{video.views}</div>
                                                </div>
                                            </div>

                                            <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                                                <div className="w-1 h-1 bg-current rounded-full mb-0.5" />
                                                <div className="w-1 h-1 bg-current rounded-full mb-0.5" />
                                                <div className="w-1 h-1 bg-current rounded-full" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

            </main>
        </div>
    );
}
