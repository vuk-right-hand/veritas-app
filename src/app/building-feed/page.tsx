'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const PHASES = [
    'Scanning latest verified videos...',
    'Matching with your goals & obstacles...',
    'Generating your custom curriculum...',
]

const PHASE_DURATION = 1500  // ms per phase
const TOTAL_DURATION = PHASE_DURATION * PHASES.length  // 4500ms

const textVariants = {
    enter: {
        opacity: 0,
        y: 16,
        filter: 'blur(4px)',
    },
    center: {
        opacity: 1,
        y: 0,
        filter: 'blur(0px)',
        transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
    },
    exit: {
        opacity: 0,
        y: -10,
        filter: 'blur(2px)',
        transition: { duration: 0.3, ease: 'easeIn' },
    },
}

export default function BuildingFeedPage() {
    const [phaseIndex, setPhaseIndex] = useState(0)

    useEffect(() => {
        // Advance phases at 1.5s intervals
        const phaseTimers = PHASES.slice(1).map((_, i) =>
            setTimeout(() => setPhaseIndex(i + 1), PHASE_DURATION * (i + 1))
        )

        // At 4.5s: set 7-day cookie and redirect
        // Must use window.location (not router.push) so the proxy sees the fresh cookie
        const redirectTimer = setTimeout(() => {
            document.cookie = 'user_welcomed_weekly=true; path=/; max-age=604800; SameSite=Lax'
            window.location.href = '/dashboard'
        }, TOTAL_DURATION)

        return () => {
            phaseTimers.forEach(clearTimeout)
            clearTimeout(redirectTimer)
        }
    }, [])

    return (
        <div className="min-h-screen bg-[#08080f] flex flex-col items-center justify-center px-6 relative overflow-hidden pb-16 md:pb-0">
            {/* Ambient glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[600px] h-[600px] rounded-full bg-white/[0.015] blur-3xl" />
            </div>

            {/* Wordmark */}
            <div className="fixed top-8 left-1/2 -translate-x-1/2 z-10">
                <span className="text-white/25 text-sm font-light tracking-[0.3em] uppercase select-none">
                    Vibe Coders HQ
                </span>
            </div>

            {/* Swapping text — one phrase at a time */}
            <div className="relative w-full max-w-md mx-auto text-center min-h-[120px] flex items-center justify-center">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={phaseIndex}
                        variants={textVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        className="text-2xl md:text-3xl font-bold text-white/85 leading-relaxed tracking-wide"
                    >
                        {PHASES[phaseIndex]}
                    </motion.p>
                </AnimatePresence>
            </div>

            {/* Progress bar */}
            <div className="fixed bottom-0 left-0 w-full h-[1px] bg-white/[0.08]">
                <motion.div
                    className="h-full bg-white/40"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: TOTAL_DURATION / 1000, ease: 'linear' }}
                />
            </div>
        </div>
    )
}
