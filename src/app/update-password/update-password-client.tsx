"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updatePasswordFromReset } from '../actions/auth-actions';

export default function UpdatePasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setError('');
        setIsLoading(true);

        const result = await updatePasswordFromReset(password);

        if (result.success) {
            setSuccess(true);
            setTimeout(() => {
                router.push('/dashboard');
                router.refresh();
            }, 1500);
        } else {
            setError(result.message || 'Failed to update password.');
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-[100dvh] bg-black text-white flex p-4 md:p-6 relative overflow-x-hidden overflow-y-auto font-sans">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10 m-auto py-8">
                <Link href="/login" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors group">
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Back to Login
                </Link>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0f0f0f] border border-white/5 backdrop-blur-md rounded-3xl p-5 md:p-10 shadow-2xl"
                >
                    <div className="text-center mb-6 md:mb-8">
                        <div className="hidden md:inline-block p-4 rounded-3xl bg-white/5 border border-white/5 mb-6 backdrop-blur-xl shadow-2xl">
                            <Lock className="w-10 h-10 text-red-400" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-bold mb-2">Set New Password</h1>
                        <p className="text-sm md:text-base text-gray-400">Enter your new password below.</p>
                    </div>

                    {success ? (
                        <div className="text-center py-4">
                            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-900/30 border border-green-500/30 mb-4">
                                <CheckCircle2 className="w-7 h-7 text-green-400" />
                            </div>
                            <p className="text-white font-medium mb-1">Password updated!</p>
                            <p className="text-sm text-gray-400">Redirecting to your dashboard...</p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-1 md:space-y-2">
                                <label className="block text-[10px] md:text-xs uppercase text-gray-500 font-bold mb-1 tracking-wider">New Password</label>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="New password (min. 6 characters)"
                                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl py-3 md:py-4 pl-11 md:pl-12 pr-11 md:pr-12 text-sm md:text-base text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600"
                                        required
                                        autoFocus
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                    >
                                        {showPassword ? <EyeOff className="w-4 h-4 md:w-5 md:h-5" /> : <Eye className="w-4 h-4 md:w-5 md:h-5" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 md:p-4 rounded-xl bg-red-900/20 border border-red-500/30 text-red-200 text-sm font-medium flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <div>
                                        <p>{error}</p>
                                        {error.includes('expired') && (
                                            <Link href="/login" className="text-red-400 hover:text-red-300 underline text-xs mt-1 inline-block">
                                                Request a new reset link
                                            </Link>
                                        )}
                                    </div>
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
                                    'Update Password'
                                )}
                            </button>
                        </form>
                    )}
                </motion.div>
            </div>
        </div>
    );
}
