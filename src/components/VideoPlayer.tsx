"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Maximize2, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils"; // Assuming you have a utils file for clsx/tailwind-merge, if not I'll create it inline or use a simpler import

// If you don't have a utils file, we can define a simple helper here or I can create standard shadcn utils later.
// For now, I'll assume standard shadcn setup or just use template literals if simple.
// Actually, let's stick to standard imports assuming you might have shadcn.
// If not, I will remove `cn` usage in a fix.
// Checking package.json earlier, I saw `clsx` and `tailwind-merge` installed, so `lib/utils` likely exists or I should create it.
// I will create it in a separate step if it fails, but for now let's write the player.

interface VideoPlayerProps {
    videoId: string; // YouTube ID
    title: string;
    humanScore?: number;
    onQuizStart?: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
    videoId,
    title,
    humanScore = 98,
    onQuizStart,
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    return (
        <div className="relative w-full max-w-4xl mx-auto my-8 perspective-1000">
            {/* The "Hollow" Frame / Floating Card */}
            <motion.div
                layout
                className={cn(
                    "relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-black/40 backdrop-blur-sm group cursor-pointer",
                    isPlaying ? "scale-100" : "hover:scale-[1.02] hover:-translate-y-2"
                )}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                onClick={() => !isPlaying && setIsPlaying(true)}
            >
                {!isPlaying ? (
                    <>
                        {/* Thumbnail Image (High Res) */}
                        <img
                            src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
                            alt={title}
                            className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity duration-500"
                        />

                        {/* Overlay Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />

                        {/* "Floating" Play Button */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <motion.div
                                className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-[0_0_40px_rgba(255,255,255,0.1)]"
                                whileHover={{ scale: 1.1, backgroundColor: "rgba(255,255,255,0.2)" }}
                                whileTap={{ scale: 0.95 }}
                            >
                                <Play className="w-8 h-8 fill-white ml-1" />
                            </motion.div>
                        </div>

                        {/* Meta Info (Title + Human Score) */}
                        <div className="absolute bottom-0 left-0 p-8 w-full transform transition-transform duration-300 group-hover:translate-y-[-10px]">
                            <div className="flex items-center gap-3 mb-3">
                                <span className="px-3 py-1 rounded-full bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium backdrop-blur-md flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3" />
                                    Human Score: {humanScore}/100
                                </span>
                                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 text-xs font-medium backdrop-blur-md">
                                    12 Key Takeaways
                                </span>
                            </div>
                            <h3 className="text-3xl font-bold text-white leading-tight tracking-tight drop-shadow-lg">
                                {title}
                            </h3>
                        </div>
                    </>
                ) : (
                    <div className="relative w-full h-full bg-black">
                        {/* Close/Minimize Button */}
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsPlaying(false); }}
                            className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white/50 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Actual YouTube Embed */}
                        <iframe
                            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&modestbranding=1&rel=0`}
                            title={title}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                )}
            </motion.div>

            {/* Quiz / Interactive Side-Action (Only shows when playing or hovered) */}
            <AnimatePresence>
                {(isPlaying || isHovered) && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: 0.2 }}
                        className="absolute top-0 -right-24 h-full flex flex-col justify-center gap-4"
                    >
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onQuizStart?.();
                            }}
                            className="group relative w-16 h-16 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 backdrop-blur-md flex flex-col items-center justify-center gap-1 transition-all duration-300 hover:w-40 hover:items-start hover:px-4 hover:rounded-2xl"
                        >
                            <div className="absolute inset-0 rounded-full border border-white/20 animate-pulse-slow" />
                            <Sparkles className="w-6 h-6 text-purple-400 group-hover:mb-1" />
                            <span className="hidden group-hover:inline-block text-xs text-white font-medium whitespace-nowrap">
                                Quiz Me
                            </span>
                            <span className="absolute right-0 top-0 -mr-1 -mt-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default VideoPlayer;
