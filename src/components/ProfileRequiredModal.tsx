"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface ProfileRequiredModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ProfileRequiredModal({ isOpen, onClose }: ProfileRequiredModalProps) {
    const router = useRouter();

    const handleLoginClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        router.push('/login');
    };

    const handleClose = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
                    onClick={onClose}
                >
                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
                        className="bg-[#111] border border-red-900/50 w-full max-w-sm rounded-[2rem] shadow-2xl shadow-red-900/20 overflow-hidden relative"
                    >
                        {/* Header Accent */}
                        <div className="h-1 w-full bg-gradient-to-r from-red-600 to-red-900" />

                        <div className="p-8 text-center relative pointer-events-auto">
                            {/* Close Button */}
                            <button
                                onClick={handleClose}
                                className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5 pointer-events-none" />
                            </button>

                            {/* Icon */}
                            <div className="mx-auto w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                                <UserPlus className="w-8 h-8" />
                            </div>

                            {/* Content */}
                            <h2 className="text-2xl font-bold text-white mb-3">Unlock All Features!</h2>
                            <p className="text-gray-400 mb-8 leading-relaxed">
                                Customize the feed and claim your profile in 30 seconds.
                            </p>

                            {/* Action Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    router.push('/onboarding');
                                }}
                                className="w-full py-4 px-6 bg-white hover:bg-gray-200 text-black font-bold rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer relative z-10"
                            >
                                Customize Your Feed
                            </button>

                            <button
                                onClick={handleLoginClick}
                                className="mt-4 text-sm text-gray-500 hover:text-white transition-colors cursor-pointer relative z-10 p-2"
                            >
                                Log in
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
