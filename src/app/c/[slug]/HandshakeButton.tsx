"use client";

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Handshake, X } from 'lucide-react';
import { toggleHandshake } from '@/app/actions/handshake-actions';
import { useUser } from '@/components/UserContext';
import ProfileRequiredModal from '@/components/ProfileRequiredModal';

interface HandshakeButtonProps {
    creatorId: string;
    initialHandshaked: boolean;
    initialCount: number;
}

export default function HandshakeButton({ creatorId, initialHandshaked, initialCount }: HandshakeButtonProps) {
    const { userProfile } = useUser();
    const [handshaked, setHandshaked] = useState(initialHandshaked);
    const [count, setCount] = useState(initialCount);
    const [loading, setLoading] = useState(false);
    const [showToast, setShowToast] = useState(false);
    const [showProfileModal, setShowProfileModal] = useState(false);
    const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleClick = async () => {
        if (!userProfile) {
            setShowProfileModal(true);
            return;
        }
        if (loading) return;

        const optimistic = !handshaked;
        setHandshaked(optimistic);
        setCount(prev => prev + (optimistic ? 1 : -1));
        setLoading(true);

        const result = await toggleHandshake(creatorId);
        if (result.error) {
            setHandshaked(!optimistic);
            setCount(prev => prev + (optimistic ? -1 : 1));
        } else {
            setHandshaked(result.handshaked);
            setCount(result.count);
            if (result.handshaked) {
                setShowToast(true);
                if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
                toastTimerRef.current = setTimeout(() => setShowToast(false), 4000);
            }
        }
        setLoading(false);
    };

    return (
        <>
            <button
                onClick={handleClick}
                disabled={loading}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-medium group ${
                    handshaked
                        ? 'bg-gradient-to-br from-red-900/20 via-black to-black border border-red-500/20 hover:border-red-500/40'
                        : 'bg-gradient-to-br from-gray-900/40 via-black to-black border border-white/5 hover:border-white/15'
                }`}
            >
                <Handshake className={`w-4 h-4 transition-colors ${
                    handshaked ? 'text-red-400' : 'text-gray-500 group-hover:text-white'
                }`} />
                <span className={`transition-colors ${
                    handshaked ? 'text-white' : 'text-gray-400 group-hover:text-white'
                }`}>
                    {handshaked ? 'Handshaked' : 'Handshake'}
                </span>
                {count > 0 && (
                    <>
                        <span className="text-gray-600">·</span>
                        <span className="text-gray-400 text-xs tabular-nums">
                            {count.toLocaleString()}
                        </span>
                    </>
                )}
            </button>

            {/* Handshake Toast */}
            <AnimatePresence>
                {showToast && (
                    <motion.div
                        key="handshake-toast-profile"
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 bg-[#111] border border-red-500/30 px-5 py-3.5 rounded-xl shadow-2xl shadow-black/50 max-w-sm"
                    >
                        <Handshake className="w-5 h-5 text-red-400 flex-shrink-0" />
                        <span className="text-sm text-gray-200 leading-snug">
                            We&apos;ll honor the handshake by customizing your feed
                        </span>
                        <button
                            onClick={() => setShowToast(false)}
                            className="ml-1 p-1 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors flex-shrink-0"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Profile Required Modal */}
            <ProfileRequiredModal
                isOpen={showProfileModal}
                onClose={() => setShowProfileModal(false)}
            />
        </>
    );
}
