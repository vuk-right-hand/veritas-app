"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Added for redirect
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Youtube, Zap, AlertCircle, Copy } from 'lucide-react';
// Relative imports might break if not adjusted, checking path
// Original was in src/app/creator-dashboard/page.tsx, now in src/app/claim-channel/page.tsx
// Paths to actions should remain ../actions/video-actions which is correct relative to src/app/claim-channel
import { getChannelMetadata, verifyChannelOwnership } from '../actions/video-actions';
import { supabase } from '../../lib/supabaseClient';

export default function ClaimChannelPage() {
    const router = useRouter(); // For redirection

    // State
    // Removed isClaimed, using redirect instead

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



    // ... (imports)

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
                // Sign In the user immediately so they have a session
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (signInError) {
                    console.error("Auto-login failed:", signInError);
                    // Still show success but maybe warn? Or just redirect and let them login?
                    // We'll proceed to success UI but redirect might fail to show dashboard if middleware protects it.
                    // But our dashboard page checks for session now.
                }

                setClaimStatus('success');
                // Auto-redirect after 3 seconds
                setTimeout(() => {
                    router.push('/creator-dashboard'); // Redirect to dashboard
                }, 3000);
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
                            <img src="/veritas-heart.svg" alt="Veritas Logo" className="w-11 h-11 object-contain animate-heartbeat fill-red-600" />
                            <span className="font-bold text-xl tracking-tight">Veritas <span className="text-gray-500 font-normal text-sm ml-2">Claim Channel</span></span>
                        </div>
                    </div>
                </div>
            </nav>

            <main className="pt-32 pb-20 px-8 max-w-[1200px] mx-auto min-h-[80vh] flex flex-col justify-center">

                <AnimatePresence mode='wait'>
                    {/* STATE 1: UNCLAIMED (Claim Flow) */}
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
                                <div className="flex flex-col items-center">
                                    <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4">
                                        <CheckCircle2 className="w-8 h-8 text-green-400" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Success!</h3>
                                    <p className="text-gray-300 text-sm">
                                        Success! Remove the token from the description.
                                    </p>
                                    <div className="mt-6 w-full h-1 bg-green-500/20 rounded-full overflow-hidden">
                                        <motion.div
                                            className="h-full bg-green-500"
                                            initial={{ width: "100%" }}
                                            animate={{ width: "0%" }}
                                            transition={{ duration: 5, ease: "linear" }}
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

                                        <p className="text-gray-400 text-sm mb-4">Paste this token into your channel's description.</p>

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
                </AnimatePresence>

            </main>
        </div>
    );
}
