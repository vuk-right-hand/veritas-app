"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, Mail, Lock, AlertCircle, ArrowLeft, Eye, EyeOff, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { viewerLogin, sendPasswordReset } from '../actions/auth-actions';
import { OAuthButtons } from '@/components/OAuthButtons';
import Footer from '@/components/Footer';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetStatus, setResetStatus] = useState<'idle' | 'sending' | 'sent'>('idle');
    const [resetError, setResetError] = useState('');

    // Display OAuth callback errors
    const callbackError = searchParams.get('error');
    const callbackErrorMsg = callbackError === 'exchange_failed'
        ? 'Your reset link has expired or is invalid. Please request a new one.'
        : callbackError === 'invalid_link'
            ? 'That reset link is invalid. Please request a new one.'
            : callbackError === 'account_exists'
                ? 'An account with this email already exists. Try a different sign-in method.'
                : callbackError === 'no_code'
                    ? 'Authentication was cancelled. Please try again.'
                    : callbackError
                        ? 'Something went wrong. Please try again.'
                        : null;

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await viewerLogin(email, password);

        if (result.success) {
            router.push('/dashboard');
            router.refresh();
        } else {
            setError(result.message || "Failed to log in.");
            setIsLoading(false);
        }
    };

    const openForgotModal = () => {
        setResetEmail(email); // auto-fill from login state
        setResetError('');
        setResetStatus('idle');
        setShowForgotModal(true);
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
        <div className="min-h-[100dvh] bg-black text-white flex p-4 md:p-6 relative overflow-x-hidden overflow-y-auto font-sans">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10 m-auto py-8">
                <Link href="/dashboard" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0f0f0f] border border-white/5 backdrop-blur-md rounded-3xl p-5 md:p-10 shadow-2xl"
                >
                    <div className="text-center mb-6 md:mb-8">
                        <div className="hidden md:inline-block p-4 rounded-3xl bg-white/5 border border-white/5 mb-6 backdrop-blur-xl shadow-2xl">
                            <img src="/veritas-heart.svg" alt="Veritas" className="w-12 h-12 object-contain animate-heartbeat fill-red-600" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-2">Welcome Back</h1>
                        <p className="text-sm md:text-base text-gray-400">Log in to sync your profile and feed.</p>
                    </div>

                    {/* Callback error banner */}
                    {callbackErrorMsg && (
                        <div className="mb-4 p-3 rounded-xl bg-red-900/20 border border-red-500/30 text-red-200 text-sm font-medium flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {callbackErrorMsg}
                        </div>
                    )}

                    {/* OAuth Buttons */}
                    <OAuthButtons flow="login" className="mb-4" />

                    {/* Divider */}
                    <div className="relative flex items-center mb-4">
                        <div className="flex-1 h-px bg-white/10" />
                        <span className="px-4 text-sm text-gray-500">or</span>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1 md:space-y-2">
                            <label className="block text-[10px] md:text-xs uppercase text-gray-500 font-bold mb-1 tracking-wider">Email</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="your@email.com"
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl py-3 md:py-4 pl-11 md:pl-12 pr-4 text-sm md:text-base text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1 md:space-y-2">
                            <label className="block text-[10px] md:text-xs uppercase text-gray-500 font-bold mb-1 tracking-wider">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl py-3 md:py-4 pl-11 md:pl-12 pr-11 md:pr-12 text-sm md:text-base text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4 md:w-5 md:h-5" /> : <Eye className="w-4 h-4 md:w-5 md:h-5" />}
                                </button>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={openForgotModal}
                                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 md:p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-200 text-sm font-medium flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-3 md:py-4 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2 md:mt-4"
                        >
                            {isLoading ? (
                                <span className="w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    Log In
                                </>
                            )}
                        </button>

                        <div className="text-center mt-4 pt-4 md:mt-6 md:pt-6 border-t border-white/10">
                            <p className="text-xs md:text-sm text-gray-400">
                                Don't have an account?{' '}
                                <Link href="/onboarding" className="text-red-400 hover:text-red-300 transition-colors font-medium">
                                    Start Here
                                </Link>
                            </p>
                        </div>
                    </form>
                </motion.div>
            </div>

            {/* Forgot Password Modal */}
            <AnimatePresence>
                {showForgotModal && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowForgotModal(false)}
                            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[101] w-full max-w-md mx-4"
                        >
                            <div className="bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                                <div className="h-1.5 w-full bg-gradient-to-r from-red-600 to-red-400" />

                                <div className="p-6 md:p-8">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-6">
                                        <h2 className="text-xl font-bold text-white">Reset Password</h2>
                                        <button
                                            type="button"
                                            onClick={() => setShowForgotModal(false)}
                                            className="text-gray-500 hover:text-white transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {resetStatus === 'sent' ? (
                                        /* Success state */
                                        <div className="text-center py-4">
                                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-900/30 border border-green-500/30 mb-4">
                                                <CheckCircle2 className="w-7 h-7 text-green-400" />
                                            </div>
                                            <p className="text-white font-medium mb-2">
                                                If an account exists for this email, a password reset link has been sent.
                                            </p>
                                            <p className="text-sm text-gray-400 mb-6">Check your inbox and spam folder.</p>
                                            <button
                                                type="button"
                                                onClick={() => setShowForgotModal(false)}
                                                className="px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all"
                                            >
                                                Back to Login
                                            </button>
                                        </div>
                                    ) : (
                                        /* Email input + send state */
                                        <>
                                            <p className="text-sm text-gray-400 mb-4">
                                                Enter your email and we'll send you a link to reset your password.
                                            </p>

                                            <div className="relative mb-4">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                                                <input
                                                    type="email"
                                                    value={resetEmail}
                                                    onChange={(e) => setResetEmail(e.target.value)}
                                                    placeholder="Enter the email you used to claim your profile."
                                                    disabled={resetStatus === 'sending'}
                                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl py-3 md:py-4 pl-11 md:pl-12 pr-4 text-sm md:text-base text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600 disabled:opacity-50"
                                                    onKeyDown={(e) => e.key === 'Enter' && handleSendReset()}
                                                />
                                            </div>

                                            {resetError && (
                                                <div className="mb-4 p-3 rounded-xl bg-red-900/20 border border-red-500/30 text-red-200 text-sm font-medium flex items-center gap-2">
                                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                                    {resetError}
                                                </div>
                                            )}

                                            <div className="flex gap-3">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowForgotModal(false)}
                                                    disabled={resetStatus === 'sending'}
                                                    className="flex-1 py-3 border border-white/10 text-gray-400 font-medium rounded-xl hover:bg-white/5 transition-all disabled:opacity-50"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleSendReset}
                                                    disabled={resetStatus === 'sending'}
                                                    className="flex-1 py-3 bg-white text-black font-bold rounded-xl hover:bg-gray-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                                >
                                                    {resetStatus === 'sending' ? (
                                                        <span className="w-5 h-5 rounded-full border-2 border-black/30 border-t-black animate-spin" />
                                                    ) : (
                                                        'Send Reset Link'
                                                    )}
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

            <div className="absolute bottom-4 left-0 right-0 z-10">
                <Footer />
            </div>
        </div>
    );
}
