"use client";

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, Youtube, Zap, AlertCircle, Copy, Eye, EyeOff, Shield, Mail, Clock } from 'lucide-react';
import { getChannelMetadata, verifyChannelOwnership } from '../actions/video-actions';
import { savePendingClaim } from '../actions/pending-data-actions';
import { OAuthButtons } from '@/components/OAuthButtons';
import Footer from '@/components/Footer';

export default function ClaimChannelPageWrapper() {
    return (
        <Suspense>
            <ClaimChannelPage />
        </Suspense>
    );
}

function ClaimChannelPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Step flow: 1=URL, 2=method choice, '2a'=email+token, 3=password
    const [step, setStep] = useState<1 | 2 | '2a' | 3>(1);
    const [channelUrl, setChannelUrl] = useState("");
    const [email, setEmail] = useState("");
    const [channelName, setChannelName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Verification State (email/token path)
    const [verificationToken, setVerificationToken] = useState("");
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timeLeft, setTimeLeft] = useState(45);
    const [isVerifying, setIsVerifying] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Password State
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [claimStatus, setClaimStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [bypassMode, setBypassMode] = useState(false);

    // Callback error display
    const callbackError = searchParams.get('error');

    const getCallbackErrorMessage = () => {
        switch (callbackError) {
            case 'channel_mismatch':
                return 'The Google account selected does not match the channel URL provided. Please try again with the correct account.';
            case 'missing_youtube_access':
                return 'Could not access your YouTube data. Please try again and grant YouTube permissions.';
            case 'no_youtube_channels':
                return 'No YouTube channels found on this Google account.';
            case 'session_expired':
                return 'Your session expired. Please start the claim process again.';
            case 'claim_failed':
                return searchParams.get('message') || 'Failed to claim channel. Please try again.';
            case 'youtube_api_failed':
                return 'Could not verify your YouTube channel. Please try the manual token method instead.';
            default:
                return callbackError ? 'Something went wrong. Please try again.' : null;
        }
    };

    const callbackErrorMsg = getCallbackErrorMessage();

    // Step 1: Handle URL submit
    const handleStartClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const { title, success } = await getChannelMetadata(channelUrl);
            if (success) {
                setChannelName(title);
                setStep(2);
            } else {
                setError("Could not find channel. Please check the URL.");
            }
        } catch {
            setError("An error occurred. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    // Save pending claim + trigger Google OAuth
    const handleGoogleVerify = async () => {
        await savePendingClaim(channelUrl, channelName);
        // OAuthButtons handles the redirect
    };

    // Step 2a: Generate Token (email/token path)
    const generateToken = async () => {
        if (!email.trim()) {
            setError("Please enter your email address.");
            return;
        }
        setIsLoading(true);
        setError("");
        try {
            const { generateVerificationToken } = await import('../actions/video-actions');
            const result = await generateVerificationToken(email, channelUrl);
            if (result.success && result.token) {
                setVerificationToken(result.token);
            } else {
                setError(result.message || "Failed to generate token.");
            }
        } catch (e: any) {
            setError(e.message || "Failed to generate token.");
        } finally {
            setIsLoading(false);
        }
    };

    const copyToken = async () => {
        if (verificationToken) {
            try {
                if (navigator.clipboard && window.isSecureContext) {
                    await navigator.clipboard.writeText(verificationToken);
                } else {
                    const textArea = document.createElement("textarea");
                    textArea.value = verificationToken;
                    textArea.style.position = "fixed";
                    textArea.style.left = "-999999px";
                    textArea.style.top = "-999999px";
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    textArea.remove();
                }
                setIsCopied(true);
                setTimeout(() => setIsCopied(false), 2000);
            } catch (err) {
                console.error("Copy failed", err);
            }
        }
    };

    const startVerification = () => {
        setError("");
        setIsTimerRunning(true);
        setTimeLeft(45);
    };

    // Timer Effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTimerRunning && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (isTimerRunning && timeLeft === 0) {
            setIsTimerRunning(false);
            performVerification();
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, timeLeft]);

    const performVerification = async () => {
        setIsVerifying(true);
        try {
            const result = await verifyChannelOwnership(email, channelUrl, verificationToken);
            if (result.success) {
                setError("");

                const { getAuthenticatedUserId, claimChannelForExistingUser } = await import('../actions/auth-actions');
                const existingUserId = await getAuthenticatedUserId();

                if (existingUserId) {
                    setBypassMode(true);
                    setStep(3);
                    setClaimStatus('loading');
                    const bypassResult = await claimChannelForExistingUser(email, {
                        url: channelUrl,
                        title: channelName,
                        token: verificationToken
                    });

                    if (bypassResult.success) {
                        setClaimStatus('success');
                        setTimeout(() => router.push('/creator-dashboard'), 3000);
                    } else {
                        setClaimStatus('error');
                        setError(bypassResult.message);
                    }
                } else {
                    setStep(3);
                }
            } else {
                setError("Verification failed. We couldn't find the token in your channel description. Please try again.");
                setIsTimerRunning(false);
            }
        } catch {
            setError("Verification failed due to an error. Please try again.");
        } finally {
            setIsVerifying(false);
        }
    };

    const handleFinalizeClaim = async () => {
        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setError("");
        setClaimStatus('loading');

        try {
            const { finalizeChannelClaim, creatorLogin } = await import('../actions/auth-actions');

            const result = await finalizeChannelClaim(email, password, {
                url: channelUrl,
                title: channelName,
                token: verificationToken
            });

            if (result.success) {
                const loginResult = await creatorLogin(email, password);
                if (!loginResult.success) {
                    console.error("Auto-login failed:", loginResult.message);
                }

                setClaimStatus('success');
                setTimeout(() => {
                    router.push('/creator-dashboard');
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
                    <motion.div
                        key="claim-flow"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="w-full max-w-2xl mx-auto text-center"
                    >
                        {/* Header — show on steps 1 and 2 */}
                        {(step === 1 || step === 2) && (
                            <>
                                <div className="mb-8 inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-900/10 border border-red-500/20 shadow-[0_0_40px_rgba(220,38,38,0.1)]">
                                    <Youtube className="w-10 h-10 text-red-500" />
                                </div>

                                <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-400 mb-6">
                                    Claim Your Channel
                                </h1>

                                <p className="text-lg text-gray-400 mb-12 leading-relaxed">
                                    Manage your videos, links and offers... And get the latest &quot;content-gaps&quot; from our in-house data.
                                </p>
                            </>
                        )}

                        {/* Callback error banner */}
                        {callbackErrorMsg && (step === 1 || step === 2) && (
                            <div className="mb-6 max-w-lg mx-auto p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-300 text-sm text-left flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <span>{callbackErrorMsg}</span>
                            </div>
                        )}

                        {/* SUCCESS STATE */}
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

                        {/* STEP 3: PASSWORD (email/token path only, not bypass) */}
                        {step === 3 && claimStatus !== 'success' && !bypassMode && (
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
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            placeholder="Password (min. 6 characters)"
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 pr-12 text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-gray-600"
                                            onKeyDown={(e) => e.key === 'Enter' && handleFinalizeClaim()}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
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

                        {/* STEP 1: CHANNEL URL */}
                        {step === 1 && (
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
                                        suppressHydrationWarning
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
                                            <span>Next</span>
                                            <CheckCircle2 className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        {/* STEP 2: VERIFICATION METHOD CHOICE */}
                        {step === 2 && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="max-w-lg mx-auto space-y-4"
                            >
                                <div className="text-left mb-6">
                                    <p className="text-gray-400 text-sm">
                                        Claiming <strong className="text-white">{channelName}</strong>
                                    </p>
                                </div>

                                {/* Google Option */}
                                <div className="bg-[#111] p-6 rounded-2xl border border-white/10 space-y-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Shield className="w-5 h-5 text-green-400" />
                                        <h3 className="font-semibold text-white">Instant Verification</h3>
                                    </div>
                                    <p className="text-gray-400 text-sm">
                                        Google verifies you own this channel automatically. No tokens, no waiting.
                                    </p>
                                    <OAuthButtons
                                        flow="claim"
                                        extraScopes={['https://www.googleapis.com/auth/youtube.readonly']}
                                        onBeforeRedirect={handleGoogleVerify}
                                    />
                                </div>

                                {/* Divider */}
                                <div className="relative flex items-center my-2">
                                    <div className="flex-1 h-px bg-white/10" />
                                    <span className="px-4 text-sm text-gray-500">or</span>
                                    <div className="flex-1 h-px bg-white/10" />
                                </div>

                                {/* Email & Token Option */}
                                <button
                                    onClick={() => setStep('2a')}
                                    className="w-full bg-[#111] p-6 rounded-2xl border border-white/10 hover:border-white/20 transition-all text-left group"
                                >
                                    <div className="flex items-center gap-3 mb-2">
                                        <Mail className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
                                        <h3 className="font-semibold text-white">Email & Token</h3>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-500 text-sm">
                                        <Clock className="w-4 h-4" />
                                        <span>Takes ~90 seconds to complete</span>
                                    </div>
                                </button>

                                <button
                                    onClick={() => { setStep(1); setError(""); }}
                                    className="mt-4 text-sm text-gray-500 hover:text-white transition-colors"
                                >
                                    Back
                                </button>
                            </motion.div>
                        )}

                        {/* STEP 2a: EMAIL + TOKEN VERIFICATION */}
                        {step === '2a' && (
                            <motion.div
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="max-w-lg mx-auto bg-[#111] p-8 rounded-2xl border border-white/10"
                            >
                                <div className="mb-6 text-left">
                                    <h3 className="text-xl font-bold text-white mb-2">Verify Ownership</h3>
                                    <p className="text-gray-400 text-sm leading-relaxed">
                                        To verify you own <strong className="text-white">{channelName}</strong>, we&apos;ll generate a unique token for you to paste in your channel description.
                                    </p>
                                </div>

                                {/* Email input */}
                                {!verificationToken && (
                                    <div className="space-y-4 mb-6">
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="Enter your email address..."
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white focus:outline-none focus:border-red-500/50 transition-all placeholder:text-gray-600"
                                        />
                                    </div>
                                )}

                                {!verificationToken ? (
                                    <button
                                        onClick={generateToken}
                                        disabled={isLoading}
                                        className="w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        <Zap className="w-4 h-4" />
                                        {isLoading ? 'Generating...' : 'Generate Verification Token'}
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

                                        <p className="text-gray-400 text-sm mb-4">Paste this token into your channel&apos;s description.</p>

                                        <div className="text-sm text-gray-500 text-left space-y-2">
                                            <p><strong className="text-gray-300">Desktop:</strong> Channel Dashboard {'>'} Customization {'>'} Basic Info {'>'} Description <strong className="text-red-500">{'>'} save/publish</strong></p>
                                            <p><strong className="text-gray-300">Mobile:</strong> Profile Icon {'>'} View Channel {'>'} Edit Channel (Pencil) {'>'} Description <strong className="text-red-500">{'>'} save/publish</strong></p>
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
                                                    <span className="text-xs opacity-70">To prevent race-conditioning hacks allow YouTube 45 seconds to update</span>
                                                </p>
                                                <div className="mt-4 w-full bg-white/5 rounded-full h-1.5 overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-red-500"
                                                        initial={{ width: "100%" }}
                                                        animate={{ width: "0%" }}
                                                        transition={{ duration: 45, ease: "linear" }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!verificationToken && (
                                    <button
                                        onClick={() => { setStep(2); setError(""); }}
                                        className="mt-4 text-sm text-gray-500 hover:text-white transition-colors"
                                    >
                                        Back
                                    </button>
                                )}
                            </motion.div>
                        )}


                    </motion.div>
                </AnimatePresence>

            </main>

            <div className="max-w-[1200px] mx-auto px-8">
                <Footer />
            </div>
        </div>
    );
}
