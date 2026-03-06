'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'

const PHASES = [
    'Unlocking public access to trending videos...',
    'Set your goals & obstacles to build a customized feed...',
]

const PHASE_DURATION = 1200  // ms per phase
const TOTAL_DURATION = 3600  // ms total

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

export default function GuestLoadingPage() {
    const router = useRouter()
    const [phaseIndex, setPhaseIndex] = useState(0)

    useEffect(() => {
        // Advance to phase 1 at 1.2s
        const phaseTimer = setTimeout(() => setPhaseIndex(1), PHASE_DURATION)

        // At 3.6s: set 24h cookie and redirect
        const redirectTimer = setTimeout(() => {
            document.cookie = 'guest_welcomed=true; path=/; max-age=86400; SameSite=Lax'
            router.push('/dashboard')
        }, TOTAL_DURATION)

        return () => {
            clearTimeout(phaseTimer)
            clearTimeout(redirectTimer)
        }
    }, [router])

    return (
        <div className="min-h-screen bg-[#08080f] flex flex-col items-center justify-center px-6 relative overflow-hidden">
            {/* Ambient glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[600px] h-[600px] rounded-full bg-white/[0.015] blur-3xl" />
            </div>

            {/* Wordmark */}
            <div className="fixed top-8 left-1/2 -translate-x-1/2 z-10">
                <span className="text-white/25 text-sm font-light tracking-[0.3em] uppercase select-none">
                    Veritas
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
                        className={[
                            'text-2xl md:text-3xl font-light text-white/85 leading-relaxed tracking-wide',
                            phaseIndex === 1 ? 'animate-pulse' : '',
                        ].join(' ').trim()}
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
