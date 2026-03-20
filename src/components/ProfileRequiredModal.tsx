"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { OAuthButtons } from '@/components/OAuthButtons';

interface ProfileRequiredModalProps {
    isOpen: boolean;
    onClose: () => void;
    source?: 'default' | 'profile' | 'comment' | 'quiz';
    videoSlug?: string;
}

export default function ProfileRequiredModal({ isOpen, onClose, source = 'default', videoSlug }: ProfileRequiredModalProps) {
    const router = useRouter();

    // Build return URL for stateless auth routing
    const nextUrl = source === 'quiz' && videoSlug
        ? `/v/${videoSlug}?autoQuiz=true`
        : videoSlug
            ? `/v/${videoSlug}`
            : null;

    const loginUrl = nextUrl
        ? `/login?next=${encodeURIComponent(nextUrl)}`
        : '/login';

    const onboardingUrl = nextUrl
        ? `/onboarding?next=${encodeURIComponent(nextUrl)}`
        : '/onboarding';

    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isOpen]);

    const handleClose = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
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
                        className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 50 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 50 }}
                        onClick={(e) => e.stopPropagation()}
                        className="fixed bottom-0 md:top-1/2 left-0 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 z-[201] w-full md:max-w-sm bg-[#111] border border-red-900/50 rounded-t-[2rem] md:rounded-[2rem] shadow-2xl shadow-red-900/20 overflow-y-auto max-h-[90vh] md:max-h-none overscroll-contain pb-safe"
                    >
                        {/* Header Accent */}
                        <div className="h-1 w-full bg-gradient-to-r from-red-600 to-red-900" />

                        <div className="p-6 text-center relative pointer-events-auto">
                            {/* Close Button */}
                            <button
                                onClick={handleClose}
                                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5 pointer-events-none" />
                            </button>

                            {/* Icon */}
                            <div className="mx-auto w-12 h-12 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-4 border border-red-500/20">
                                <UserPlus className="w-6 h-6" />
                            </div>

                            {/* Conditional Content */}
                            {source !== 'profile' && (
                                <>
                                    <h2 className="text-xl font-bold text-white mb-2">Unlock All Features!</h2>
                                    <p className="text-gray-400 mb-4 text-sm leading-relaxed">
                                        Customize the feed and claim your profile in 30 seconds.
                                    </p>
                                </>
                            )}

                            {/* OAuth Buttons */}
                            <OAuthButtons flow="login" size="sm" className="mb-3" next={nextUrl || undefined} />

                            {/* Divider */}
                            <div className="relative flex items-center mb-2">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="px-3 text-xs text-gray-500">or</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            {/* Email Login */}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onClose();
                                    router.push(loginUrl);
                                }}
                                className="w-full py-2.5 px-6 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer relative z-10 mb-2"
                            >
                                <Mail className="w-4 h-4" />
                                Login with email
                            </button>

                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onClose();
                                    router.push(onboardingUrl);
                                }}
                                className="w-full py-2.5 px-6 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer relative z-10"
                            >
                                Claim profile
                            </button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
