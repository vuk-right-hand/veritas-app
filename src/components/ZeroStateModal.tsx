"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, CheckCircle2, Search } from 'lucide-react';
import { logPriorityRequest } from '@/app/actions/search-actions';

interface ZeroStateModalProps {
    searchQuery: string;
    isAuthenticated: boolean;
    requested: boolean;
    onClose: () => void;
    onRequestClick: () => void;
    onRequestSuccess: () => void;
}

export default function ZeroStateModal({
    searchQuery,
    isAuthenticated,
    requested,
    onClose,
    onRequestClick,
    onRequestSuccess,
}: ZeroStateModalProps) {
    const [phase, setPhase] = useState<'scanning' | 'ready'>('scanning');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [succeeded, setSucceeded] = useState(false);

    // 1.5s scanning animation → then reveal card
    useEffect(() => {
        const t = setTimeout(() => setPhase('ready'), 1500);
        return () => clearTimeout(t);
    }, []);

    // Prevent body scroll while modal is open
    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = prev; };
    }, []);

    // Auto-close 3s after success
    useEffect(() => {
        if (!succeeded) return;
        const t = setTimeout(onClose, 3000);
        return () => clearTimeout(t);
    }, [succeeded, onClose]);

    const handleRequest = async () => {
        if (!isAuthenticated) {
            onRequestClick();
            return;
        }

        setIsSubmitting(true);
        const result = await logPriorityRequest(searchQuery);
        setIsSubmitting(false);

        if (!result.success && result.message === 'Unauthorized') {
            onRequestClick();
            return;
        }

        if (result.success) {
            setSucceeded(true);
            onRequestSuccess();
        }
    };

    return (
        // Semi-transparent backdrop — feed remains visible behind it
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[150] flex items-center justify-center px-4 bg-black/60"
            style={{ touchAction: 'none' }}
            onTouchMove={(e) => e.preventDefault()}
        >
            <AnimatePresence mode="wait">
                {phase === 'scanning' ? (
                    /* ── PHASE 1: Sonar scan ── */
                    <motion.div
                        key="scanning"
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.75, transition: { duration: 0.2 } }}
                        transition={{ duration: 0.3 }}
                        className="flex flex-col items-center gap-5"
                        style={{ touchAction: 'auto' }}
                        onTouchMove={(e) => e.stopPropagation()}
                    >
                        {/* Sonar rings */}
                        <div className="relative w-16 h-16 flex items-center justify-center">
                            {[0, 1, 2].map(i => (
                                <motion.div
                                    key={i}
                                    className="absolute inset-0 rounded-full border border-red-500/35"
                                    animate={{ scale: [1, 3.2], opacity: [0.65, 0] }}
                                    transition={{
                                        duration: 1.4,
                                        repeat: Infinity,
                                        delay: i * 0.46,
                                        ease: 'easeOut',
                                    }}
                                />
                            ))}
                            <div className="relative z-10 w-12 h-12 rounded-full bg-red-950/40 border border-red-500/25 flex items-center justify-center">
                                <Search className="w-5 h-5 text-red-400" />
                            </div>
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-sm font-light text-gray-400 tracking-wide">
                                Scanning verified library&hellip;
                            </p>
                            <p className="text-xs text-gray-600">&ldquo;{searchQuery}&rdquo;</p>
                        </div>
                    </motion.div>

                ) : (
                    /* ── PHASE 2: Result card ── */
                    <motion.div
                        key="card"
                        initial={{ opacity: 0, scale: 0.90, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.90, y: 20 }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                        style={{ touchAction: 'auto' }}
                        onTouchMove={(e) => e.stopPropagation()}
                        className="relative w-full max-w-sm bg-[#111111] border border-white/[0.09] rounded-2xl p-7 text-center shadow-[0_24px_80px_rgba(0,0,0,0.8)]"
                    >
                        {/* X */}
                        <button
                            onClick={onClose}
                            aria-label="Close"
                            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-gray-500 hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Icon */}
                        <div className="mx-auto w-12 h-12 bg-red-900/20 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                            <Search className="w-5 h-5 text-red-400" />
                        </div>

                        {/* Copy */}
                        <p className="text-base font-semibold text-white mb-2 leading-snug">
                            No verified video for this topic yet.
                        </p>
                        <p className="text-sm text-gray-400 mb-1">
                            You searched:{' '}
                            <span className="text-red-400 font-medium">&ldquo;{searchQuery}&rdquo;</span>
                        </p>
                        <p className="text-sm text-gray-600 mb-6">
                            Want us to log a Priority Request?
                        </p>

                        {/* CTA */}
                        <button
                            onClick={handleRequest}
                            disabled={requested || isSubmitting || succeeded}
                            className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-[0.97] ${
                                succeeded
                                    ? 'bg-green-700/30 text-green-300 cursor-default'
                                    : requested
                                        ? 'bg-red-600/30 text-white/40 cursor-default'
                                        : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]'
                            }`}
                        >
                            {isSubmitting ? (
                                <>
                                    <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                                    Logging&hellip;
                                </>
                            ) : succeeded ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Request Secured
                                </>
                            ) : (
                                <>
                                    <Bell className="w-4 h-4" />
                                    Yes, Log Priority Request
                                </>
                            )}
                        </button>

                        {succeeded && (
                            <p className="text-[11px] text-gray-700 mt-3 tracking-wide">
                                Closing in 3 seconds&hellip;
                            </p>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
