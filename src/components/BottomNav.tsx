"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User, Sparkles, Youtube } from 'lucide-react';
import AuthChoiceModal from './AuthChoiceModal';
import { checkIsCreator } from '@/app/actions/creator-actions';

export default function BottomNav() {
    const pathname = usePathname();
    const [isCreator, setIsCreator] = useState<boolean | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);

    useEffect(() => {
        checkIsCreator().then(res => setIsCreator(res.isCreator));
    }, []);

    const isFeedActive = pathname === '/dashboard';
    const isProfileActive = pathname === '/profile';
    const isCreatorActive = pathname === '/creator-dashboard';

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[90] md:hidden bg-black/90 backdrop-blur-xl border-t border-white/5 bottom-safe">
            <div className="flex items-center justify-around h-[var(--bottom-nav-height)] px-4 max-w-lg mx-auto">
                {/* Feed Tab */}
                <Link
                    href={'/dashboard'}
                    className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${isFeedActive
                        ? 'text-red-500'
                        : 'text-gray-500 active:text-gray-300'
                        }`}
                >
                    <Home className={`w-6 h-6 ${isFeedActive ? 'text-red-500' : ''}`} />
                    <span className="text-[10px] font-semibold tracking-wide">Feed</span>
                    {isFeedActive && (
                        <div className="absolute bottom-1 w-1 h-1 rounded-full bg-red-500" />
                    )}
                </Link>

                {/* Dynamic Creator / Claim Tab */}
                {isCreator === true ? (
                    <Link
                        href={'/creator-dashboard'}
                        className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${isCreatorActive
                            ? 'text-red-500'
                            : 'text-gray-500 active:text-gray-300'
                            }`}
                    >
                        <Youtube className={`w-6 h-6 ${isCreatorActive ? 'text-red-500' : ''}`} />
                        <span className="text-[10px] font-semibold tracking-wide">Creator</span>
                        {isCreatorActive && (
                            <div className="absolute bottom-1 w-1 h-1 rounded-full bg-red-500" />
                        )}
                    </Link>
                ) : (
                    <button
                        onClick={() => setShowAuthModal(true)}
                        className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors text-white/90 active:scale-95`}
                    >
                        <Sparkles className={`w-6 h-6 ${isCreator === null ? 'opacity-0' : 'animate-pulse text-white/80'}`} />
                        <span className={`text-[10px] font-bold tracking-widest uppercase shadow-sm ${isCreator === null ? 'opacity-0' : ''}`}>Claim channel</span>
                    </button>
                )}

                {/* Profile Tab */}
                <Link
                    href={'/profile'}
                    className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${isProfileActive
                        ? 'text-red-500'
                        : 'text-gray-500 active:text-gray-300'
                        }`}
                >
                    <User className={`w-6 h-6 ${isProfileActive ? 'text-red-500' : ''}`} />
                    <span className="text-[10px] font-semibold tracking-wide">Profile</span>
                    {isProfileActive && (
                        <div className="absolute bottom-1 w-1 h-1 rounded-full bg-red-500" />
                    )}
                </Link>
            </div>

            <AuthChoiceModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </nav>
    );
}
