"use client";

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Send, Check } from 'lucide-react';
import { submitFeatureRequest } from '@/app/actions/feature-actions';

interface FeatureRequestModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function FeatureRequestModal({ isOpen, onClose }: FeatureRequestModalProps) {
    const [thought, setThought] = useState("");
    const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!thought.trim()) return;

        setStatus('submitting');
        const result = await submitFeatureRequest(thought);

        if (result.success) {
            setStatus('success');
            setTimeout(() => {
                onClose();
                setTimeout(() => {
                    setStatus('idle');
                    setThought("");
                }, 300); // Reset after modal closes
            }, 1500);
        } else {
            alert(result.message);
            setStatus('idle');
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
                        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] grid place-items-center p-4 cursor-pointer"
                    >
                        {/* Modal */}
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking content
                            className="bg-[#111] border border-white/10 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden cursor-default relative"
                        >
                            {/* Header Gradient */}
                            <div className="h-2 w-full bg-gradient-to-r from-yellow-500 via-red-500 to-yellow-500 animate-gradient-x" />

                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-yellow-500/10 rounded-lg text-yellow-500">
                                            <Sparkles className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-bold text-white">I have an idea...</h2>
                                            <p className="text-gray-400 text-xs">Help us build the perfect tool for you.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="p-1 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {status === 'success' ? (
                                    <div className="py-12 flex flex-col items-center text-center animate-in zoom-in duration-300">
                                        <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-4">
                                            <Check className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-xl font-bold text-white mb-2">Message Received!</h3>
                                        <p className="text-gray-400">Your feedback has been beamed directly to the founder.</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit} className="space-y-6">
                                        <div className="space-y-2">
                                            <label htmlFor="idea" className="text-sm font-medium text-gray-300 block">
                                                Describe your idea in plain English
                                            </label>
                                            <textarea
                                                id="idea"
                                                value={thought}
                                                onChange={(e) => setThought(e.target.value)}
                                                placeholder="Example: I want to be able to save videos to a private 'Watch Later' list..."
                                                className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500/50 focus:ring-1 focus:ring-yellow-500/20 min-h-[120px] resize-none text-base transition-all"
                                                autoFocus
                                            />
                                        </div>

                                        <div className="flex items-center justify-end gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={!thought.trim() || status === 'submitting'}
                                                className="px-6 py-2 bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-500 hover:to-yellow-600 text-white font-medium rounded-lg shadow-lg shadow-yellow-900/20 flex items-center gap-2 transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {status === 'submitting' ? (
                                                    <>Sending...</>
                                                ) : (
                                                    <>
                                                        Send Idea <Send className="w-4 h-4" />
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
