"use client";

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Share, Plus, ChevronDown } from 'lucide-react';

interface InstallPromptProps {
    videoViewCount: number;
}

export default function InstallPrompt({ videoViewCount }: InstallPromptProps) {
    const [show, setShow] = useState(false);
    const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
    const [isStandalone, setIsStandalone] = useState(false);
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

    // Detect platform and standalone mode
    useEffect(() => {
        // Check standalone
        const standalone = window.matchMedia('(display-mode: standalone)').matches ||
            (window.navigator as any).standalone === true;
        setIsStandalone(standalone);

        // Detect platform
        const ua = navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(ua) && !window.MSStream) {
            setPlatform('ios');
        } else if (/android/.test(ua)) {
            setPlatform('android');
        }

        // Android: capture the beforeinstallprompt event
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    // Trigger: show after at least 1 video view, not immediately, not if standalone, not if dismissed
    useEffect(() => {
        if (isStandalone) return;
        if (platform === 'other') return;
        if (videoViewCount < 1) return;

        const dismissed = localStorage.getItem('veritas-install-dismissed');
        if (dismissed) return;

        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
    }, [videoViewCount, isStandalone, platform]);

    const handleDismiss = () => {
        setShow(false);
        localStorage.setItem('veritas-install-dismissed', 'true');
    };

    const handleAndroidInstall = async () => {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                setShow(false);
            }
            setDeferredPrompt(null);
        }
    };

    if (!show) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="fixed bottom-0 left-0 right-0 z-[300] md:hidden"
            >
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={handleDismiss}
                />

                {/* Bottom Sheet */}
                <div className="relative bg-gradient-to-t from-[#0a0a0a] to-[#1a1a1a] rounded-t-3xl border-t border-white/10 px-6 pt-8 pb-10 bottom-safe">
                    {/* Drag Handle */}
                    <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20" />

                    {/* Close Button */}
                    <button
                        onClick={handleDismiss}
                        className="absolute top-4 right-4 p-2 rounded-full bg-white/5 text-gray-400 active:bg-white/10"
                    >
                        <X className="w-4 h-4" />
                    </button>

                    {/* Content */}
                    <div className="flex flex-col items-center text-center">
                        {/* Heart Icon */}
                        <img
                            src="/veritas-heart.svg"
                            alt="Veritas"
                            className="w-16 h-16 object-contain animate-heartbeat mb-4"
                        />

                        <h2 className="text-xl font-bold text-white mb-2">
                            Unlock Full Veritas Experience
                        </h2>

                        {platform === 'ios' ? (
                            /* iOS Flow */
                            <>
                                <p className="text-sm text-gray-400 mb-6 max-w-xs">
                                    To enable premium features and instant access, add Veritas app to your home screen.
                                </p>

                                {/* Step-by-step instructions */}
                                <div className="w-full max-w-xs space-y-4 mb-6">
                                    <div className="flex items-center gap-4 bg-white/5 rounded-xl p-3 border border-white/5">
                                        <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                                            <Share className="w-5 h-5 text-blue-400" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-white">1. Tap Share</p>
                                            <p className="text-[11px] text-gray-500">Square with arrow at the bottom</p>
                                        </div>
                                        {/* Animated arrow pointing down */}
                                        <motion.div
                                            animate={{ y: [0, 6, 0] }}
                                            transition={{ repeat: Infinity, duration: 1.5 }}
                                            className="ml-auto"
                                        >
                                            <ChevronDown className="w-5 h-5 text-blue-400" />
                                        </motion.div>
                                    </div>

                                    <div className="flex items-center gap-4 bg-white/5 rounded-xl p-3 border border-white/5">
                                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                                            <Plus className="w-5 h-5 text-green-400" />
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-white">2. Add to Home Screen</p>
                                            <p className="text-[11px] text-gray-500">Scroll down and tap the plus icon</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 bg-white/5 rounded-xl p-3 border border-white/5">
                                        <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-lg font-bold text-red-400">✓</span>
                                        </div>
                                        <div className="text-left">
                                            <p className="text-sm font-semibold text-white">3. Tap "Add"</p>
                                            <p className="text-[11px] text-gray-500">Top right corner — you're done!</p>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            /* Android Flow */
                            <>
                                <p className="text-sm text-gray-400 mb-6 max-w-xs">
                                    Tap below to enable premium features and instant access. Add Veritas app to your home screen.
                                </p>

                                <button
                                    onClick={handleAndroidInstall}
                                    className="w-full max-w-xs py-4 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-[0_0_30px_rgba(220,38,38,0.3)] text-center"
                                >
                                    Add Veritas to Home Screen
                                </button>
                            </>
                        )}

                        <button
                            onClick={handleDismiss}
                            className="mt-4 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                        >
                            Maybe later
                        </button>
                    </div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}

// Type augmentation for MSStream detection
declare global {
    interface Window {
        MSStream?: any;
    }
}
