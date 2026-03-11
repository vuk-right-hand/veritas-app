'use client';

import { motion } from 'framer-motion';
import { Play, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface WatchNextCardProps {
    videoId: string;
    title: string;
    channelTitle: string;
    reason: string;
    slug: string | null;
    variant: 'fullscreen' | 'half' | 'compact';
}

export default function WatchNextCard({ videoId, title, channelTitle, reason, slug, variant }: WatchNextCardProps) {
    const router = useRouter();
    const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

    const handleClick = () => {
        if (slug) {
            router.push(`/v/${slug}`);
        }
    };

    // === COMPACT: small horizontal card ===
    if (variant === 'compact') {
        return (
            <motion.button
                onClick={handleClick}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red-500/30 rounded-xl transition-all group text-left"
            >
                <div className="relative w-20 h-12 rounded-lg overflow-hidden flex-shrink-0">
                    <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center group-hover:bg-black/10 transition-colors">
                        <Play className="w-4 h-4 text-white fill-white" />
                    </div>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{title}</p>
                    <p className="text-[10px] text-gray-500 truncate">{channelTitle}</p>
                    <p className="text-[10px] text-red-400 mt-0.5 truncate">{reason}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-600 group-hover:text-red-400 transition-colors flex-shrink-0" />
            </motion.button>
        );
    }

    // === HALF: takes ~50% of container height ===
    if (variant === 'half') {
        return (
            <motion.button
                onClick={handleClick}
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35 }}
                className="w-full flex-1 relative rounded-2xl overflow-hidden group text-left min-h-0"
            >
                {/* Thumbnail background */}
                <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />

                {/* Dark overlay — 30% on mobile for text readability */}
                <div className="absolute inset-0 bg-black/40 md:bg-black/25" />
                {/* Gradient for bottom text */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Top-left: label + reason */}
                <div className="absolute top-3 left-3 right-3">
                    <p className="text-[9px] uppercase tracking-widest text-gray-300 font-bold">Watch this next:</p>
                    <p className="text-[10px] text-red-400 mt-0.5 italic line-clamp-1">{reason}</p>
                </div>

                {/* Centered play button */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-red-600/90 group-hover:bg-red-500 flex items-center justify-center shadow-lg shadow-black/30 transition-colors">
                        <Play className="w-4 h-4 md:w-5 md:h-5 text-white fill-white ml-0.5" />
                    </div>
                </div>

                {/* Bottom: title (mobile), title + creator (desktop) */}
                <div className="absolute bottom-0 left-0 right-0 p-3">
                    <p className="text-xs font-bold text-white line-clamp-2 leading-tight">{title}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 hidden md:block">{channelTitle}</p>
                </div>
            </motion.button>
        );
    }

    // === FULLSCREEN: fills entire container (aspect-video) ===
    return (
        <motion.button
            onClick={handleClick}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full aspect-video relative rounded-2xl overflow-hidden group text-left"
        >
            {/* Thumbnail background */}
            <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />

            {/* Dark overlay — stronger on mobile for readability */}
            <div className="absolute inset-0 bg-black/40 md:bg-black/25" />
            {/* Gradient for bottom text area */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

            {/* Top-left: label + reason */}
            <div className="absolute top-3 left-3 md:top-4 md:left-4 right-3 md:right-4">
                <p className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-300 font-bold">Watch this next:</p>
                <p className="text-[10px] md:text-xs text-red-400 mt-0.5 italic line-clamp-1">{reason}</p>
            </div>

            {/* Centered play button */}
            <div className="absolute inset-0 flex items-center justify-center">
                <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2, duration: 0.3, type: 'spring' }}
                    className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-red-600/90 group-hover:bg-red-500 flex items-center justify-center shadow-xl shadow-black/40 transition-colors"
                >
                    <Play className="w-5 h-5 md:w-7 md:h-7 text-white fill-white ml-0.5 md:ml-1" />
                </motion.div>
            </div>

            {/* Bottom: title + creator (desktop only) */}
            <div className="absolute bottom-0 left-0 right-0 p-3 md:p-5">
                <p className="text-xs md:text-base font-bold text-white line-clamp-2 leading-snug">{title}</p>
                {/* Creator name — desktop only */}
                <p className="text-sm text-gray-400 mt-1 hidden md:block">{channelTitle}</p>
            </div>
        </motion.button>
    );
}
