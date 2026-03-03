"use client";

import React, { useState, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Target, Zap, Eye, EyeOff, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { saveMission } from '../actions/saveMission';
import { savePendingMission } from '../actions/pending-data-actions';
import { OAuthButtons } from '@/components/OAuthButtons';

export default function OnboardingWrapper() {
    return (
        <Suspense>
            <Onboarding />
        </Suspense>
    );
}

function Onboarding() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        goal: '',
        struggle: '',
        name: '',
        email: '',
        password: '',
    });

    const [customGoal, setCustomGoal] = useState('');
    const [customStruggle, setCustomStruggle] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    // Display OAuth callback errors
    const callbackError = searchParams.get('error');
    const callbackProvider = searchParams.get('provider');

    const GOALS = [
        "Make $10,000/m Online",
        "Master VibeCoding",
        "Build a Personal Brand",
        "Other..."
    ];

    const STRUGGLES = [
        "Procrastination",
        "Lack of Focus",
        "Don't Know Where to Start",
        "Other..."
    ];

    const handleGoalSelect = (selected: string) => {
        if (selected === "Other...") {
            setFormData({ ...formData, goal: "Other" });
        } else {
            setFormData({ ...formData, goal: selected });
            handleNext();
        }
    };

    const handleStruggleSelect = (selected: string) => {
        if (selected === "Other...") {
            setFormData({ ...formData, struggle: "Other" });
        } else {
            setFormData({ ...formData, struggle: selected });
            handleNext();
        }
    };

    const handleNext = async () => {
        setError('');
        if (step < 4) {
            setStep(step + 1);
        } else {
            // Step 4 validation (email path)
            if (!formData.name.trim() || !formData.email.trim() || !formData.password) {
                setError('Please fill in all fields to continue.');
                return;
            }
            if (formData.password.length < 6) {
                setError('Password must be at least 6 characters.');
                return;
            }

            setLoading(true);
            const finalData = {
                ...formData,
                goal: formData.goal === "Other" ? customGoal : formData.goal,
                struggle: formData.struggle === "Other" ? customStruggle : formData.struggle
            };

            try {
                const result = await saveMission(finalData);
                if (result.success) {
                    router.push('/dashboard');
                } else {
                    setError('Error: ' + result.message);
                }
            } catch (e) {
                console.error(e);
                setError('Something went wrong. Please try again.');
            } finally {
                setLoading(false);
            }
        }
    };

    /** Persist goal/struggle to cookie before OAuth redirect */
    const handleBeforeOAuthRedirect = async () => {
        const goal = formData.goal === "Other" ? customGoal : formData.goal;
        const struggle = formData.struggle === "Other" ? customStruggle : formData.struggle;
        await savePendingMission(goal, struggle);
    };

    const getCallbackErrorMessage = () => {
        switch (callbackError) {
            case 'no_email':
                return callbackProvider === 'github'
                    ? 'Your GitHub email is private. Please make it public in GitHub Settings → Emails, or sign up with email instead.'
                    : 'Could not retrieve your email. Please try again or use email sign-up.';
            case 'session_expired':
                return 'Your session expired. Please select your goal and obstacle again.';
            case 'mission_failed':
                return 'Failed to save your profile. Please try again.';
            case 'exchange_failed':
                return 'Authentication failed. Please try again.';
            default:
                return callbackError ? 'Something went wrong. Please try again.' : null;
        }
    };

    const callbackErrorMsg = getCallbackErrorMessage();

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Background Ambience */}
            <div className="absolute top-[-20%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-red-900/10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-red-950/20 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

            <div className="w-full max-w-lg relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 text-center"
                >
                    {step < 3 && (
                        <div className="mb-6">
                            <p className="text-sm text-gray-400">
                                Have a profile?{' '}
                                <Link href="/login" className="text-red-400 hover:text-red-300 transition-colors font-medium">
                                    Sign in.
                                </Link>
                            </p>
                        </div>
                    )}
                    <div className="inline-block p-4 rounded-3xl bg-white/5 border border-white/5 mb-6 backdrop-blur-xl shadow-2xl">
                        <img src="/veritas-heart.svg" alt="Veritas" className="w-12 h-12 object-contain animate-heartbeat fill-red-600" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight text-white">Customize Your Feed</h1>
                    <p className="text-gray-400 text-base md:text-lg">Let&apos;s curate the perfect content diet for you.</p>
                </motion.div>

                {/* Card */}
                <motion.div
                    className="bg-[#0f0f0f] border border-white/5 backdrop-blur-md rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-2xl relative overflow-hidden"
                    initial={{ height: 'auto' }}
                    animate={{ height: 'auto' }}
                >
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-red-600 to-red-900 transition-all duration-500" style={{ width: `${(step / 4) * 100}%` }} />

                    {/* Callback error banner */}
                    {callbackErrorMsg && step <= 3 && (
                        <div className="mb-4 p-3 rounded-lg bg-red-900/20 border border-red-500/30 text-red-300 text-sm">
                            {callbackErrorMsg}
                        </div>
                    )}

                    {/* STEP 1: GOAL */}
                    {step === 1 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            key="step1"
                        >
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <span className="text-red-500">01.</span> Your main goal in the next 3-6 months?
                            </h2>
                            <div className="space-y-3">
                                {GOALS.map((goal) => {
                                    const isOther = goal === "Other...";
                                    const isSelected = formData.goal === goal || (isOther && formData.goal === "Other");
                                    return (
                                        <button
                                            key={goal}
                                            onClick={() => handleGoalSelect(goal)}
                                            className={`w-full text-left p-4 rounded-xl border transition-all group flex items-center justify-between ${isSelected
                                                ? "bg-red-900/20 border-red-500/50"
                                                : "bg-[#1a1a1a] border-white/5 hover:bg-[#202020] hover:border-red-500/30"
                                                }`}
                                        >
                                            <span className={`font-medium ${isOther ? 'text-red-500' : 'text-gray-200'} group-hover:text-white`}>{goal}</span>
                                            <ArrowRight className="w-4 h-4 text-white/0 group-hover:text-red-500 transition-all transform -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100" />
                                        </button>
                                    );
                                })}

                                {formData.goal === "Other" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <input
                                            type="text"
                                            placeholder="Type your specific goal..."
                                            autoFocus
                                            className="w-full bg-transparent border-b border-red-500 p-2 focus:outline-none text-white mt-2 placeholder:text-gray-600"
                                            value={customGoal}
                                            onChange={(e) => setCustomGoal(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                        />
                                        <button onClick={handleNext} className="mt-2 text-xs text-red-500 font-bold uppercase tracking-wider hover:text-red-400">
                                            Confirm
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: STRUGGLE */}
                    {step === 2 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            key="step2"
                        >
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <span className="text-red-500">02.</span> What are you currently struggling with?
                            </h2>
                            <div className="space-y-3">
                                {STRUGGLES.map((item) => {
                                    const isOther = item === "Other...";
                                    const isSelected = formData.struggle === item || (isOther && formData.struggle === "Other");
                                    return (
                                        <button
                                            key={item}
                                            onClick={() => handleStruggleSelect(item)}
                                            className={`w-full text-left p-4 rounded-xl border transition-all group flex items-center justify-between ${isSelected
                                                ? "bg-red-900/20 border-red-500/50"
                                                : "bg-[#1a1a1a] border-white/5 hover:bg-[#202020] hover:border-red-500/30"
                                                }`}
                                        >
                                            <span className={`font-medium ${isOther ? 'text-red-500' : 'text-gray-200'} group-hover:text-white`}>{item}</span>
                                            <Zap className="w-4 h-4 text-white/0 group-hover:text-red-500 transition-all opacity-0 group-hover:opacity-100" />
                                        </button>
                                    );
                                })}

                                {formData.struggle === "Other" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <input
                                            type="text"
                                            placeholder="Type your specific obstacle..."
                                            autoFocus
                                            className="w-full bg-transparent border-b border-red-500 p-2 focus:outline-none text-white mt-2 placeholder:text-gray-600"
                                            value={customStruggle}
                                            onChange={(e) => setCustomStruggle(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                        />
                                        <button onClick={handleNext} className="mt-2 text-xs text-red-500 font-bold uppercase tracking-wider hover:text-red-400">
                                            Confirm
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                            <button onClick={() => setStep(1)} className="mt-6 text-sm text-gray-500 hover:text-white transition-colors">Back</button>
                        </motion.div>
                    )}

                    {/* STEP 3: AUTH METHOD */}
                    {step === 3 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            key="step3"
                        >
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <span className="text-red-500">03.</span> How would you like to sign up?
                            </h2>

                            <OAuthButtons
                                flow="onboarding"
                                onBeforeRedirect={handleBeforeOAuthRedirect}
                            />

                            {/* Divider */}
                            <div className="relative flex items-center my-6">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="px-4 text-sm text-gray-500">or</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>

                            {/* Email option */}
                            <button
                                onClick={() => setStep(4)}
                                className="w-full text-left p-4 rounded-xl border bg-[#1a1a1a] border-white/5 hover:bg-[#202020] hover:border-red-500/30 transition-all group flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-gray-400 group-hover:text-red-500 transition-colors" />
                                    <span className="font-medium text-gray-200 group-hover:text-white">Continue with Email</span>
                                </div>
                                <ArrowRight className="w-4 h-4 text-white/0 group-hover:text-red-500 transition-all transform -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100" />
                            </button>

                            <button onClick={() => setStep(2)} className="mt-6 text-sm text-gray-500 hover:text-white transition-colors">Back</button>
                        </motion.div>
                    )}

                    {/* STEP 4: EMAIL REGISTRATION */}
                    {step === 4 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            key="step4"
                        >
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <span className="text-red-500">04.</span> Claim your Veritas profile:
                            </h2>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-2 tracking-wider">Name</label>
                                    <input
                                        type="text"
                                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-gray-600"
                                        placeholder="Your Name"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-2 tracking-wider">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-gray-600"
                                        placeholder="your@email.com"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-2 tracking-wider">Password</label>
                                    <div className="relative">
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            className="w-full bg-[#1a1a1a] border border-white/10 rounded-xl p-4 pr-12 text-white focus:outline-none focus:border-white/30 transition-colors placeholder:text-gray-600"
                                            placeholder="Create a password (min. 6 characters)"
                                            value={formData.password}
                                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </div>

                                {error && (
                                    <div className="text-red-500 text-sm font-medium text-center animate-pulse">
                                        {error}
                                    </div>
                                )}

                                <button
                                    onClick={handleNext}
                                    disabled={loading}
                                    className="w-full bg-white text-black font-bold py-4 rounded-xl mt-2 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Analyzing...' : 'Build My Feed'} <CheckCircle2 className="w-5 h-5" />
                                </button>
                                <button onClick={() => setStep(3)} className="w-full text-center mt-4 text-sm text-gray-500 hover:text-white transition-colors">Back</button>

                                <div className="text-center mt-4 pt-4 border-t border-white/10">
                                    <p className="text-sm text-gray-400">
                                        Already have a profile?{' '}
                                        <Link href="/login" className="text-red-400 hover:text-red-300 transition-colors font-medium">
                                            Log In
                                        </Link>
                                    </p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                </motion.div>
            </div>
        </div>
    );
}
