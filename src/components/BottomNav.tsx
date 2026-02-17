"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, User } from 'lucide-react';

const TABS = [
    { id: 'feed', label: 'Feed', icon: Home, href: '/dashboard' },
    { id: 'profile', label: 'Profile', icon: User, href: '#' },
];

export default function BottomNav() {
    const pathname = usePathname();

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-[90] md:hidden bg-black/90 backdrop-blur-xl border-t border-white/5 bottom-safe">
            <div className="flex items-center justify-around h-[var(--bottom-nav-height)] px-4 max-w-lg mx-auto">
                {TABS.map((tab) => {
                    const isActive = (tab.href === '/dashboard' && pathname === '/dashboard') ||
                        (tab.href !== '/dashboard' && tab.href !== '#' && pathname.startsWith(tab.href));
                    return (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`flex flex-col items-center justify-center gap-1 flex-1 py-2 transition-colors ${isActive
                                ? 'text-red-500'
                                : 'text-gray-500 active:text-gray-300'
                                }`}
                        >
                            <tab.icon className={`w-6 h-6 ${isActive ? 'text-red-500' : ''}`} />
                            <span className="text-[10px] font-semibold tracking-wide">{tab.label}</span>
                            {isActive && (
                                <div className="absolute bottom-1 w-1 h-1 rounded-full bg-red-500" />
                            )}
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
