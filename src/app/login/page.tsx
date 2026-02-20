"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { LogIn, Mail, Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { viewerLogin } from '../actions/auth-actions';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const result = await viewerLogin(email, password);

        if (result.success) {
            router.push('/dashboard');
            router.refresh(); // Refresh the cache to load feed with auth state
        } else {
            setError(result.message || "Failed to log in.");
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
            <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] left-[-10%] w-[500px] h-[500px] bg-blue-900/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-md relative z-10">
                <Link href="/onboarding" className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors group">
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

                        <div className="space-y-1 md:space-y-2 pb-2">
                            <label className="block text-[10px] md:text-xs uppercase text-gray-500 font-bold mb-1 tracking-wider">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 md:w-5 md:h-5 text-gray-500" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="Enter your password"
                                    className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl py-3 md:py-4 pl-11 md:pl-12 pr-4 text-sm md:text-base text-white focus:outline-none focus:border-red-500/50 transition-colors placeholder:text-gray-600"
                                    required
                                />
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
        </div>
    );
}
