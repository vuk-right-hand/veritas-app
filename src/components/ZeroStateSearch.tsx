"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Bell, CheckCircle2 } from 'lucide-react';
import { logPriorityRequest } from '@/app/actions/search-actions';

interface ZeroStateSearchProps {
    searchQuery: string;
    isAuthenticated: boolean;
    requested: boolean;
    onRequestClick: () => void;
    onRequestSuccess: () => void;
}

export default function ZeroStateSearch({
    searchQuery,
    isAuthenticated,
    requested,
    onRequestClick,
    onRequestSuccess,
}: ZeroStateSearchProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showToast, setShowToast] = useState(false);

    const handleClick = async () => {
        if (!isAuthenticated) {
            onRequestClick();
            return;
        }

        setIsSubmitting(true);
        const result = await logPriorityRequest(searchQuery);
        setIsSubmitting(false);

        if (!result.success && result.message === 'Unauthorized') {
            // Stale session — fall back to profile modal
            onRequestClick();
            return;
        }

        if (result.success) {
            onRequestSuccess();
            setShowToast(true);
            setTimeout(() => setShowToast(false), 5000);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="w-full max-w-2xl mx-auto mb-8"
        >
            {/* Priority Request Card */}
            <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-2xl p-6 md:p-8 text-center">
                <div className="mx-auto w-12 h-12 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                    <Search className="w-6 h-6" />
                </div>

                <p className="text-lg font-semibold text-white mb-2">
                    We don&apos;t have a verified video for this topic yet.
                </p>
                <p className="text-sm text-gray-400 mb-1">
                    You searched: <span className="text-red-400 font-medium">&ldquo;{searchQuery}&rdquo;</span>
                </p>
                <p className="text-sm text-gray-500 mb-6">
                    We can log your search as a Priority Request.
                </p>

                <button
                    onClick={handleClick}
                    disabled={requested || isSubmitting}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all transform active:scale-95 ${
                        requested
                            ? 'bg-red-600/50 text-white/60 cursor-default'
                            : 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]'
                    }`}
                >
                    {isSubmitting ? (
                        <span className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin block" />
                    ) : (
                        <>
                            <Bell className="w-4 h-4" />
                            Yes, Notify Me When It&apos;s Available!
                        </>
                    )}
                </button>

                {/* Success Toast */}
                <AnimatePresence>
                    {showToast && (
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25 }}
                            className="absolute left-1/2 -translate-x-1/2 -bottom-14 md:-bottom-12 w-max max-w-[90%] px-4 py-2.5 rounded-xl bg-black/90 border border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)]"
                        >
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                                <span className="text-sm text-green-300 font-medium">
                                    Request locked in. We&apos;ll email you the second this video drops.
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Visual Bridge Divider */}
            <div className="flex items-center gap-4 mt-12 mb-2">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                <span className="text-xs text-gray-500 text-center max-w-xs">
                    While we hunt for that, videos below match your current goals &amp; obstacles:
                </span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            </div>
        </motion.div>
    );
}
