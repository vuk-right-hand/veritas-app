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

    const GOALS = [
        "Make Money Online",
        "Master Video Editing",
        "Learn to Code",
        "Build a Personal Brand",
        "Other..."
    ];

    const STRUGGLES = [
        "Procrastination",
        "Lack of Focus",
        "Overwhelm / Anxiety",
        "Don't Know Where to Start",
        "Other..."
    ];

    const handleGoalSelect = (selected: string) => {
        if (selected === "Other...") {
            setFormData({ ...formData, goal: "Other" });
            // Don't auto-advance, let them type
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
        if (step < 3) {
            setStep(step + 1);
        } else {
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
                    alert('Error: ' + result.message);
                }
            } catch (e) {
                console.error(e);
                alert('Something went wrong.');
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Ambience */}
            <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-900/20 rounded-full blur-[120px] pointer-events-none" />

            <div className="w-full max-w-lg relative z-10">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8 text-center"
                >
                    <div className="inline-block p-3 rounded-2xl bg-white/5 border border-white/10 mb-6 backdrop-blur-xl shadow-2xl">
                        <div className="w-12 h-12 bg-gradient-to-tr from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                            <Target className="w-6 h-6 text-white" />
                        </div>
                    </div>
                    <h1 className="text-4xl font-bold mb-2 tracking-tight">Customize Your Feed</h1>
                    <p className="text-gray-400 text-lg">Let's curate the perfect content diet for you.</p>
                </motion.div>

                {/* Card */}
                <motion.div
                    className="bg-zinc-900/40 border border-white/5 backdrop-blur-md rounded-3xl p-8 shadow-2xl relative overflow-hidden"
                    initial={{ height: 'auto' }}
                    animate={{ height: 'auto' }}
                >
                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 h-1 bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500" style={{ width: `${(step / 3) * 100}%` }} />

                    {/* STEP 1: GOAL */}
                    {step === 1 && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            key="step1"
                        >
                            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                                <span className="text-purple-400">01.</span> What is your main goal?
                            </h2>
                            <div className="space-y-3">
                                {GOALS.map((goal) => (
                                    <button
                                        key={goal}
                                        onClick={() => handleGoalSelect(goal)}
                                        className={`w-full text-left p-4 rounded-xl border transition-all group flex items-center justify-between ${formData.goal === goal || (goal === "Other..." && formData.goal === "Other")
                                                ? "bg-purple-500/20 border-purple-500"
                                                : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-purple-500/50"
                                            }`}
                                    >
                                        <span className="font-medium text-gray-200 group-hover:text-white">{goal}</span>
                                        <ArrowRight className="w-4 h-4 text-white/0 group-hover:text-purple-400 transition-all transform -translate-x-2 group-hover:translate-x-0 opacity-0 group-hover:opacity-100" />
                                    </button>
                                ))}

                                {formData.goal === "Other" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <input
                                            type="text"
                                            placeholder="Type your specific goal..."
                                            autoFocus
                                            className="w-full bg-transparent border-b border-purple-500 p-2 focus:outline-none text-white mt-2"
                                            value={customGoal}
                                            onChange={(e) => setCustomGoal(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                        />
                                        <button onClick={handleNext} className="mt-2 text-xs text-purple-400 font-bold uppercase tracking-wider hover:text-purple-300">
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
                                <span className="text-blue-400">02.</span> What is your biggest obstacle?
                            </h2>
                            <div className="space-y-3">
                                {STRUGGLES.map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => handleStruggleSelect(item)}
                                        className={`w-full text-left p-4 rounded-xl border transition-all group flex items-center justify-between ${formData.struggle === item || (item === "Other..." && formData.struggle === "Other")
                                                ? "bg-blue-500/20 border-blue-500"
                                                : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-blue-500/50"
                                            }`}
                                    >
                                        <span className="font-medium text-gray-200 group-hover:text-white">{item}</span>
                                        <Zap className="w-4 h-4 text-white/0 group-hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100" />
                                    </button>
                                ))}

                                {formData.struggle === "Other" && (
                                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                                        <input
                                            type="text"
                                            placeholder="Type your specific obstacle..."
                                            autoFocus
                                            className="w-full bg-transparent border-b border-blue-500 p-2 focus:outline-none text-white mt-2"
                                            value={customStruggle}
                                            onChange={(e) => setCustomStruggle(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleNext()}
                                        />
                                        <button onClick={handleNext} className="mt-2 text-xs text-blue-400 font-bold uppercase tracking-wider hover:text-blue-300">
                                            Confirm
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                            <button onClick={() => setStep(1)} className="mt-6 text-sm text-gray-500 hover:text-white">Back</button>
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
                            <h2 className="text-xl font-semibold mb-6">
                                <span className="text-green-400">03.</span> Where should we send your curated plan?
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Name</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase text-gray-500 font-bold mb-2">Email</label>
                                    <input
                                        type="email"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-green-500 transition-colors"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>

                                <button
                                    onClick={handleNext}
                                    disabled={loading}
                                    className="w-full bg-white text-black font-bold py-4 rounded-xl mt-4 hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {loading ? 'Saving...' : 'Build My Feed'} <CheckCircle2 className="w-5 h-5" />
                                </button>
                            </div>
                        </motion.div>
                    )}

                </motion.div>
            </div>
        </div>
    );
}
