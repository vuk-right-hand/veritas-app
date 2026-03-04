"use client";

import React, { useState, useCallback } from 'react';
import { Share2, Check } from 'lucide-react';

interface ShareButtonProps {
    path: string;
    label?: string;
    className?: string;
    size?: 'sm' | 'md';
}

export default function ShareButton({ path, label, className, size = 'sm' }: ShareButtonProps) {
    const [copied, setCopied] = useState(false);

    const handleClick = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const fullUrl = `${window.location.origin}${path}`;

        try {
            await navigator.clipboard.writeText(fullUrl);
        } catch {
            const textarea = document.createElement('textarea');
            textarea.value = fullUrl;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
        }

        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }, [path]);

    const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

    return (
        <button
            onClick={handleClick}
            className={className || 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all text-xs font-medium'}
        >
            {copied ? (
                <>
                    <Check className={`${iconSize} text-green-400`} />
                    <span className="text-green-400">Copied!</span>
                </>
            ) : (
                <>
                    <Share2 className={iconSize} />
                    {label && <span>{label}</span>}
                </>
            )}
        </button>
    );
}
