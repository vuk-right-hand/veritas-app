"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Trophy, ChevronRight } from 'lucide-react';

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

// Normalize the database slugs for robust matching
const normalizeToSlug = (topic: string) => {
    return topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
};

const getSkillStyling = (score: number) => {
    if (score === 0) return { tier: '', color: 'text-gray-500', barColor: 'bg-transparent', glow: '' };
    if (score <= 25) return { tier: 'UNCOMMON', color: 'text-green-500', barColor: 'bg-green-500', glow: 'shadow-[0_0_10px_rgba(34,197,94,0.3)]' };
    if (score <= 50) return { tier: 'RARE', color: 'text-blue-500', barColor: 'bg-blue-500', glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]' };
    if (score <= 75) return { tier: 'EPIC', color: 'text-purple-500', barColor: 'bg-purple-500', glow: 'shadow-[0_0_20px_rgba(168,85,247,0.4)]' };
    if (score <= 99) return { tier: 'LEGENDARY', color: 'text-orange-500', barColor: 'bg-orange-500', glow: 'shadow-[0_0_25px_rgba(249,115,22,0.4)]' };
    return { tier: 'MYTHICAL', color: 'text-red-600', barColor: 'bg-red-600', glow: 'shadow-[0_0_30px_rgba(220,38,38,0.5)]' };
};

export default function SkillProgressCard({ skillsMatrix }: SkillProgressCardProps) {
    // Generate the ordered array
    const orderedSkills = PREDEFINED_SKILLS.map(skill => {
        // Find if this skill is in the matrix. Map handles varying slugs
        // Also check if they mapped 'vibecoding' vs 'vibecoding_architecture'
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
        <div className="space-y-6">
            <div className="flex flex-col gap-6">
                {orderedSkills.map((skill, index) => {
                    const score = Math.min(100, Math.max(0, skill.data.quiz_score || 0));
                    const style = getSkillStyling(score);

                    return (
                        <div key={skill.slug} className="flex flex-col gap-2">
                            {/* Header: Skill Name & Rank & Score */}
                            <div className="flex items-end justify-between">
                                <div className="flex items-baseline gap-3">
                                    <span className="text-xl font-bold text-white tracking-wide">
                                        {skill.name}
                                    </span>
                                    {style.tier && (
                                        <span className={`text-sm font-light tracking-widest uppercase ${style.color} ${style.glow ? 'drop-shadow-md' : ''}`}>
                                            ({style.tier})
                                        </span>
                                    )}
                                </div>
                                <span className={`text-xs font-mono font-bold ${score > 0 ? style.color : 'text-gray-600'}`}>
                                    {score > 0 ? `${score}/100` : ''}
                                </span>
                            </div>

                            {/* Progress bar line */}
                            <div className="relative h-1.5 w-full bg-gray-600 rounded-full overflow-hidden flex shadow-inner">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${score}%` }}
                                    transition={{ duration: 1, ease: 'easeOut', delay: index * 0.1 }}
                                    className={`h-full rounded-r-full shadow-lg ${style.barColor}`}
                                />
                            </div>

                            {/* Portfolio preview (if any high-confidence answers feature here) */}
                            {skill.data.portfolio && skill.data.portfolio.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-white/5 bg-white/[0.02] p-3 rounded-xl border-l-[3px]" style={{ borderLeftColor: score > 0 ? style.color.replace('text-', '') : 'transparent' }}>
                                    <span className="text-[10px] text-gray-400 uppercase tracking-widest font-bold flex items-center gap-1.5 mb-2">
                                        <Trophy className={`w-3 h-3 ${style.color}`} />
                                        Best Answers
                                    </span>
                                    {skill.data.portfolio.slice(0, 2).map((entry, i) => (
                                        <div key={i} className="mb-2 last:mb-0 pl-1">
                                            <p className="text-xs text-gray-500 truncate mb-0.5">
                                                <span className="text-gray-600 font-bold mr-1">Q:</span>{entry.question}
                                            </p>
                                            <p className="text-xs text-gray-300 truncate">
                                                <span className={`${style.color} font-bold mr-1`}>A:</span>{entry.user_answer}
                                            </p>
                                        </div>
                                    ))}
                                    {skill.data.portfolio.length > 2 && (
                                        <span className="text-[10px] text-gray-600 flex items-center gap-1 mt-1 pl-1">
                                            +{skill.data.portfolio.length - 2} more <ChevronRight className="w-3 h-3" />
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
