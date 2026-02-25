"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, X } from 'lucide-react';

interface SkillData {
    quiz_score: number;
    tier: string;
    portfolio: Array<{
        video_id: string;
        question: string;
        user_answer: string;
        ai_feedback: string;
    }>;
}

interface SkillProgressCardProps {
    skillsMatrix: Record<string, SkillData>;
}

// Ordered predefined skills
const PREDEFINED_SKILLS = [
    { name: 'Sales', slug: 'sales' },
    { name: 'Copywriting', slug: 'copywriting' },
    { name: 'Marketing Psychology', slug: 'marketing_psychology' },
    { name: 'AI/Automation', slug: 'ai_automation' },
    { name: 'Content Creation', slug: 'content_creation' },
    { name: 'Outreach', slug: 'outreach' },
    { name: 'Time Management', slug: 'time_management' },
    { name: 'VibeCoding', slug: 'vibecoding_architecture' }, // Or just vibecoding, we map what we have
];

const getSkillStyling = (score: number) => {
    if (score === 0) return { tier: '', color: 'text-white/30', barColor: 'bg-transparent', glowColor: 'transparent' };
    if (score <= 25) return { tier: 'UNCOMMON', color: 'text-green-500', barColor: 'bg-green-500', glowColor: 'rgba(34,197,94,0.4)' };
    if (score <= 50) return { tier: 'RARE', color: 'text-blue-500', barColor: 'bg-blue-500', glowColor: 'rgba(59,130,246,0.4)' };
    if (score <= 75) return { tier: 'EPIC', color: 'text-purple-500', barColor: 'bg-purple-500', glowColor: 'rgba(168,85,247,0.4)' };
    if (score <= 99) return { tier: 'LEGENDARY', color: 'text-orange-500', barColor: 'bg-orange-500', glowColor: 'rgba(249,115,22,0.4)' };
    return { tier: 'MYTHICAL', color: 'text-red-500', barColor: 'bg-red-500', glowColor: 'rgba(239,68,68,0.5)' };
};

export default function SkillProgressCard({ skillsMatrix }: SkillProgressCardProps) {
    const [showBestAnswers, setShowBestAnswers] = React.useState(false);

    // Generate the ordered array
    const orderedSkills = PREDEFINED_SKILLS.map(skill => {
        // Find if this skill is in the matrix. Map handles varying slugs
        const possibleSlugs = [
            skill.slug,
            skill.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            skill.name === 'VibeCoding' ? 'vibecoding' : '',
            skill.name === 'AI/Automation' ? 'ai' : '',
        ].filter(Boolean);

        let data: SkillData = { quiz_score: 0, tier: 'Uncommon', portfolio: [] };

        for (const slug of possibleSlugs) {
            if (skillsMatrix[slug]) {
                data = skillsMatrix[slug];
                break;
            }
        }

        return {
            ...skill,
            data
        };
    });

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-6">
                {orderedSkills.map((skill, index) => {
                    const score = Math.min(100, Math.max(0, skill.data.quiz_score || 0));
                    const style = getSkillStyling(score);

                    return (
                        <div key={skill.slug} className="relative flex flex-col gap-3">
                            <div className="flex items-start justify-between">
                                {/* Sharper, luxurious skill name */}
                                <span className="text-xl md:text-2xl font-light tracking-wide text-white">
                                    {skill.name}
                                </span>

                                {/* Rank name above score, aligned right */}
                                <div className="flex flex-col items-end gap-0.5">
                                    {style.tier && (
                                        <span className={`text-[7.5px] md:text-[9px] font-bold tracking-[0.15em] uppercase ${style.color}`}>
                                            {style.tier}
                                        </span>
                                    )}
                                    <span className={`text-xs md:text-[13px] font-light tracking-widest ${score > 0 ? 'text-white' : 'text-white/30'}`}>
                                        {score > 0 ? `${score}/100` : '0/100'}
                                    </span>
                                </div>
                            </div>

                            {/* Progress bar line - black bg with white/10 edge styling to remove the "cheap grey" */}
                            <div className="relative h-1 w-full bg-black border border-white/20 rounded-full overflow-hidden flex">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${score}%` }}
                                    transition={{ duration: 1, ease: 'easeOut', delay: index * 0.1 }}
                                    className={`h-full ${style.barColor}`}
                                    style={{
                                        boxShadow: score > 0 ? `0 0 12px ${style.glowColor}, 0 0 4px ${style.glowColor}` : undefined
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Aggregated Best Answers at the bottom */}
            {(() => {
                const allBestAnswers = orderedSkills.flatMap(skill =>
                    (skill.data.portfolio || []).map(entry => ({ ...entry, skillName: skill.name, score: skill.data.quiz_score }))
                );

                if (allBestAnswers.length === 0) return null;

                return (
                    <div className="mt-10 flex border-t border-white/5 pt-8 justify-center pb-4">
                        <button
                            onClick={() => setShowBestAnswers(true)}
                            className="flex items-center gap-2 text-xs text-white/70 hover:text-white uppercase tracking-[0.2em] font-light transition-all bg-black border border-white/20 hover:border-white/50 px-8 py-4 rounded-md"
                        >
                            <Trophy className="w-4 h-4 text-red-500" />
                            Best Answers
                        </button>

                        <AnimatePresence>
                            {showBestAnswers && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md"
                                    onClick={() => setShowBestAnswers(false)}
                                >
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95, y: 10 }}
                                        transition={{ duration: 0.2 }}
                                        className="bg-black border border-white/20 p-6 sm:p-8 max-w-lg w-full max-h-[85vh] flex flex-col relative"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <button
                                            onClick={() => setShowBestAnswers(false)}
                                            className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>

                                        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-white/10">
                                            <Trophy className="w-5 h-5 text-red-500" />
                                            <h3 className="text-white font-light text-sm uppercase tracking-[0.2em]">Curated Best Answers</h3>
                                        </div>
                                        <div className="space-y-8 overflow-y-auto no-scrollbar flex-1 pb-4 pr-2">
                                            {allBestAnswers.map((entry, i) => {
                                                const style = getSkillStyling(Math.min(100, Math.max(0, entry.score || 0)));
                                                return (
                                                    <div key={i} className="flex flex-col gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`w-1.5 h-1.5 rounded-full ${style.barColor}`} style={{ boxShadow: `0 0 8px ${style.glowColor}` }} />
                                                            <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
                                                                {entry.skillName}
                                                            </span>
                                                        </div>
                                                        <div className="pl-3.5 border-l border-white/10 flex flex-col gap-2">
                                                            <p className="text-sm text-white/80 font-light leading-relaxed">
                                                                <span className="text-white/40 font-mono text-xs mr-2">Q</span>
                                                                {entry.question}
                                                            </p>
                                                            <p className="text-sm text-white font-light leading-relaxed">
                                                                <span className={`${style.color} font-mono text-xs mr-2`}>A</span>
                                                                {entry.user_answer}
                                                            </p>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                );
            })()}
        </div>
    );
}

