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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] grid place-items-center p-4 cursor-pointer"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
                            className="bg-[#111] border border-red-900/50 w-full max-w-sm rounded-[2rem] shadow-2xl shadow-red-900/20 overflow-hidden cursor-default relative"
                        >
                            {/* Header Accent */}
                            <div className="h-1 w-full bg-gradient-to-r from-red-600 to-red-900" />

                            <div className="p-8 text-center">
                                {/* Close Button */}
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                {/* Icon */}
                                <div className="mx-auto w-16 h-16 bg-red-900/20 text-red-500 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
                                    <UserPlus className="w-8 h-8" />
                                </div>

                                {/* Content */}
                                <h2 className="text-2xl font-bold text-white mb-3">Almost there!</h2>
                                <p className="text-gray-400 mb-8 leading-relaxed">
                                    To unlock all features, please claim your profile.
                                </p>

                                {/* Action Button */}
                                <button
                                    onClick={() => router.push('/onboarding')}
                                    className="w-full py-4 px-6 bg-white hover:bg-gray-200 text-black font-bold rounded-xl transition-all transform active:scale-95 flex items-center justify-center gap-2"
                                >
                                    Customize Your Feed
                                </button>

                                <button
                                    onClick={onClose}
                                    className="mt-4 text-sm text-gray-500 hover:text-white transition-colors"
                                >
                                    Maybe later
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
