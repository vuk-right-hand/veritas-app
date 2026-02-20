"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Youtube, LogIn, Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { creatorLogin } from '@/app/actions/auth-actions';
import { useRouter } from 'next/navigation';

interface AuthChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function AuthChoiceModal({ isOpen, onClose }: AuthChoiceModalProps) {
    const router = useRouter();
    const [view, setView] = useState<'choice' | 'login'>('choice');
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");

    // Reset state when opening/closing
    React.useEffect(() => {
        if (!isOpen) {
            setView('choice');
            setEmail("");
            setPassword("");
            setError("");
        }
    }, [isOpen]);

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
                // Success
                router.push('/creator-dashboard');
                onClose();
            }
        } catch (err) {
            setError("An unexpected error occurred.");
            setIsLoading(false);
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
                        className="fixed bottom-0 md:top-1/2 left-0 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[101] w-full max-w-md bg-[#111] border border-white/10 rounded-t-3xl md:rounded-2xl shadow-2xl overflow-y-auto max-h-[85vh] pb-safe"
                    >
                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors z-10 bg-black/50 p-1.5 rounded-full"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        <div className="p-8">
                            <AnimatePresence mode='wait'>
                                {view === 'choice' ? (
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
                                            {/* Logic: Login Button (Top) */}
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
                                                        <div className="text-xs text-gray-500">Access your dashboard</div>
                                                    </div>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                            </button>

                                            {/* Logic: Claim Button (Bottom) */}
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
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="login"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="space-y-6"
                                    >
                                        <div className="text-center">
                                            <h2 className="text-2xl font-bold text-white mb-2">Welcome Back</h2>
                                            <p className="text-sm text-gray-400">Enter your credentials to continue.</p>
                                        </div>

                                        <form onSubmit={handleLogin} className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="relative">
                                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                    <input
                                                        type="email"
                                                        value={email}
                                                        onChange={(e) => setEmail(e.target.value)}
                                                        placeholder="Email address"
                                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                                                        required
                                                    />
                                                </div>
                                                <div className="relative">
                                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                                    <input
                                                        type="password"
                                                        value={password}
                                                        onChange={(e) => setPassword(e.target.value)}
                                                        placeholder="Password"
                                                        className="w-full bg-black/50 border border-white/10 rounded-lg py-3 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-white/30 transition-colors"
                                                        required
                                                    />
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
                                                className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50"
                                            >
                                                {isLoading ? 'Signing in...' : 'Log In'}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => setView('choice')}
                                                className="w-full py-2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                                            >
                                                Back to options
                                            </button>
                                        </form>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
