"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, CheckCircle2, Target, Zap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { saveMission } from '../actions/saveMission';

export default function Onboarding() {
    const router = useRouter();
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        goal: '',
        struggle: '',
        name: '',
        email: ''
    });

    const [customGoal, setCustomGoal] = useState('');
    const [customStruggle, setCustomStruggle] = useState('');

    const [error, setError] = useState('');

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
        if (step < 3) {
            setStep(step + 1);
        } else {
            // Validation
            if (!formData.name.trim() || !formData.email.trim()) {
                setError('Please provide both name and email to continue.');
                return;
            }

            // Final Submit
            setLoading(true);
            const finalData = {
                ...formData,
                goal: formData.goal === "Other" ? customGoal : formData.goal,
                struggle: formData.struggle === "Other" ? customStruggle : formData.struggle
            };

            console.log("Saving Profile:", finalData);

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

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden font-sans">
            {/* Background Ambience - Red/Dark Theme */}
            <div className="absolute top-[-20%] left-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-red-900/10 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[300px] md:w-[500px] h-[300px] md:h-[500px] bg-red-950/20 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

            <div className="w-full max-w-lg relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 text-center"
                >
                    <div className="inline-block p-4 rounded-3xl bg-white/5 border border-white/5 mb-6 backdrop-blur-xl shadow-2xl">
                        <img src="/veritas-heart.svg" alt="Veritas" className="w-12 h-12 object-contain animate-heartbeat fill-red-600" />
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold mb-2 tracking-tight text-white">Customize Your Feed</h1>
                    <p className="text-gray-400 text-base md:text-lg">Let's curate the perfect content diet for you.</p>
                </motion.div>

                {/* Card */}
                <motion.div
                    className="bg-[#0f0f0f] border border-white/5 backdrop-blur-md rounded-2xl md:rounded-3xl p-5 md:p-8 shadow-2xl relative overflow-hidden"
                    initial={{ height: 'auto' }}
                    animate={{ height: 'auto' }}
                >
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-red-600 to-red-900 transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />

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
                                <span className="text-blue-500">02.</span> What are you currently struggling with?
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
                                                ? "bg-blue-900/20 border-blue-500/50"
                                                : "bg-[#1a1a1a] border-white/5 hover:bg-[#202020] hover:border-blue-500/30"
                                                }`}
                                        >
                                            <span className={`font-medium ${isOther ? 'text-red-500' : 'text-gray-200'} group-hover:text-white`}>{item}</span>
                                            <Zap className="w-4 h-4 text-white/0 group-hover:text-blue-500 transition-all opacity-0 group-hover:opacity-100" />
                                        </button>
                                    );
                                })}

                                {formData.struggle === "Other" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <input
                                            type="text"
                                            placeholder="Type your specific obstacle..."
                                            autoFocus
                                            className="w-full bg-transparent border-b border-blue-500 p-2 focus:outline-none text-white mt-2 placeholder:text-gray-600"
                                            value={customStruggle}
                                            onChange={(e) => setCustomStruggle(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                        />
                                        <button onClick={handleNext} className="mt-2 text-xs text-blue-500 font-bold uppercase tracking-wider hover:text-blue-400">
                                            Confirm
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                            <button onClick={() => setStep(1)} className="mt-6 text-sm text-gray-500 hover:text-white transition-colors">Back</button>
                        </motion.div>
                    )}

                    {/* STEP 3: CONTACT */}
                    {step === 3 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            key="step3"
                        >
                            {/* No Headline here as requested */}
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
                                        onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                    />
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
                                <button onClick={() => setStep(2)} className="w-full text-center mt-4 text-sm text-gray-500 hover:text-white transition-colors">Back</button>
                            </div>
                        </motion.div>
                    )}

                </motion.div>
            </div>
        </div>
    );
}
