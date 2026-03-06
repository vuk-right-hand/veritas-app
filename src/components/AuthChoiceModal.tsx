"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Youtube, LogIn, Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { creatorLogin, sendPasswordReset } from '@/app/actions/auth-actions';
import { useRouter } from 'next/navigation';
import { OAuthButtons } from '@/components/OAuthButtons';

interface AuthChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultView?: 'choice' | 'login';
}

export default function AuthChoiceModal({ isOpen, onClose, defaultView = 'choice' }: AuthChoiceModalProps) {
    const router = useRouter();
    const [view, setView] = useState<'choice' | 'login' | 'redirecting'>(defaultView);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [resetEmail, setResetEmail] = useState("");
    const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [resetError, setResetError] = useState("");

    // Reset state when opening/closing
    React.useEffect(() => {
        if (!isOpen) {
            setView(defaultView);
            setEmail("");
            setPassword("");
            setError("");
        } else {
            setView(defaultView);
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        // Handle body scroll locking
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        }

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isOpen, defaultView]);

    const handleClaimClick = () => {
        router.push('/claim-channel');
        onClose();
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");

        try {
            const result = await creatorLogin(email, password);

            if (!result.success) {
                setError(result.message || "Invalid credentials.");
                setIsLoading(false);
            } else {
                // Keep modal open — shows redirecting state until the new page loads.
                // Without this the modal closes instantly and the user stares at the
                // feed for 4-5 seconds while the dashboard Server Component fetches data.
                setView('redirecting');
                router.push('/creator-dashboard');
            }
        } catch (err) {
            setError("An unexpected error occurred.");
            setIsLoading(false);
        }
    };

    const handleSendReset = async () => {
        if (!resetEmail.trim()) {
            setResetError('Please enter your email address.');
            return;
        }
        setResetError('');
        setResetStatus('sending');
        const result = await sendPasswordReset(resetEmail.trim());
        if (result.success) {
            setResetStatus('sent');
        } else {
            setResetError(result.message || 'Something went wrong.');
            setResetStatus('idle');
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 50 }}
                        className="fixed bottom-0 md:top-1/2 left-0 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[101] w-full max-w-md bg-[#111] border border-white/10 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-y-auto md:overflow-visible max-h-[90dvh] md:max-h-none pb-safe"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10 bg-black/50 p-1.5 rounded-full"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-6">
                            <AnimatePresence mode='wait'>
                                {view === 'redirecting' ? (
                                    <motion.div
                                        key="redirecting"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex flex-col items-center justify-center py-10 gap-5 text-center"
                                    >
                                        <div className="w-14 h-14 rounded-full border-2 border-white/10 border-t-white animate-spin" />
                                        <div>
                                            <h2 className="text-xl font-bold text-white">Assembling your dashboard</h2>
                                            <p className="text-sm text-gray-500 mt-1">Just a moment...</p>
                                        </div>
                                    </motion.div>
                                ) : view === 'choice' ? (
                                    <motion.div
                                        key="choice"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="text-center">
                                            <h2 className="text-2xl font-bold text-white mb-2">Creator Access</h2>
                                            <p className="text-sm text-gray-400">Manage your verified channel presence.</p>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Primary: Claim Channel (Top) */}
                                            <button
                                                onClick={handleClaimClick}
                                                className="w-full p-4 rounded-xl bg-gradient-to-r from-red-900/10 to-transparent border border-red-500/20 hover:border-red-500/40 transition-all flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-red-900/20 flex items-center justify-center text-red-500">
                                                        <Youtube className="w-5 h-5" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-bold text-white group-hover:text-red-400 transition-colors">Claim Channel</div>
                                                        <div className="text-xs text-gray-500">New here? Verify ownership</div>
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                            </button>

                                            {/* Secondary: Log In (Bottom) */}
                                            <button
                                                onClick={() => setView('login')}
                                                className="w-full p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all flex items-center justify-between group"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-blue-900/20 flex items-center justify-center text-blue-400">
                                                        <LogIn className="w-5 h-5" />
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="font-bold text-white group-hover:text-blue-300 transition-colors">Log In</div>
                                                        <div className="text-xs text-gray-500">Already a creator? Access your dashboard</div>
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                            </button>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="login"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-3"
                                    >
                                        <div className="text-center">
                                            <h2 className="text-lg font-bold text-white mb-0.5">Welcome Back</h2>
                                            <p className="text-xs text-gray-400">Enter your credentials to continue.</p>
                                        </div>

                                        {/* OAuth */}
                                        <OAuthButtons flow="creator-login" size="sm" />

                                        {/* Divider */}
                                        <div className="relative flex items-center">
                                            <div className="flex-1 h-px bg-white/10" />
                                            <span className="px-3 text-xs text-gray-500">or</span>
                                            <div className="flex-1 h-px bg-white/10" />
                                        </div>

                                        <form onSubmit={handleLogin} className="space-y-2.5">
                                            <div className="space-y-2">
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                    <input
                                                        type="email"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        placeholder="Email address"
                                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                                                        required
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                    <input
                                                        type={showPassword ? "text" : "password"}
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        placeholder="Password"
                                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-2 pl-10 pr-10 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                                    >
                                                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                                <div className="flex justify-end">
                                                    <button
                                                        type="button"
                                                        onClick={() => { setResetEmail(email); setResetStatus('idle'); setResetError(''); setShowForgotModal(true); }}
                                                        className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                                                    >
                                                        Forgot password?
                                                    </button>
                                                </div>
                                            </div>

                                            {error && (
                                                <div className="text-red-400 text-xs flex items-center gap-2 bg-red-900/10 p-3 rounded-lg border border-red-500/10">
                                                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                                                    {error}
                                                </div>
                                            )}

                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="w-full py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50"
                                            >
                                                {isLoading ? 'Signing in...' : 'Log In'}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setView('choice')}
                                                className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                Back to options
                                            </button>
                                        </form>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {/* Forgot Password Modal */}
                    <AnimatePresence>
                        {showForgotModal && (
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setShowForgotModal(false)}
                                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110]"
                                />
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                                    animate={{ scale: 1, opacity: 1, y: 0 }}
                                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[111] w-full max-w-md mx-4"
                                >
                                    <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                                        <div className="p-6">
                                            <h2 className="text-xl font-bold text-white mb-1 text-center">Reset Password</h2>
                                            {resetStatus === 'sent' ? (
                                                <div className="text-center py-4">
                                                    <p className="text-white font-medium mb-2">Reset link sent!</p>
                                                    <p className="text-sm text-gray-400 mb-6">Check your inbox and spam folder.</p>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowForgotModal(false)}
                                                        className="px-6 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all"
                                                    >
                                                        Back to Login
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-sm text-gray-400 mb-4 text-center">Enter your email to receive a reset link.</p>
                                                    <div className="relative mb-3">
                                                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                        <input
                                                            type="email"
                                                            value={resetEmail}
                                                            onChange={(e) => setResetEmail(e.target.value)}
                                                            placeholder="Your email address"
                                                            disabled={resetStatus === 'sending'}
                                                            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600 disabled:opacity-50"
                                                            onKeyDown={(e) => e.key === 'Enter' && handleSendReset()}
                                                        />
                                                    </div>
                                                    {resetError && (
                                                        <div className="mb-3 p-3 rounded-xl bg-red-900/20 border border-red-500/30 text-red-200 text-xs flex items-center gap-2">
                                                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                                            {resetError}
                                                        </div>
                                                    )}
                                                    <div className="flex gap-3">
                                                        <button
                                                            type="button"
                                                            onClick={() => setShowForgotModal(false)}
                                                            disabled={resetStatus === 'sending'}
                                                            className="flex-1 py-2.5 border border-white/10 text-gray-400 font-medium rounded-xl hover:bg-white/5 transition-all disabled:opacity-50"
                                                        >
                                                            Cancel
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={handleSendReset}
                                                            disabled={resetStatus === 'sending'}
                                                            className="flex-1 py-2.5 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                        >
                                                            {resetStatus === 'sending' ? (
                                                                <span className="w-4 h-4 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                                                            ) : 'Send Link'}
                                                        </button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </>
            )}
        </AnimatePresence>
    );
}
