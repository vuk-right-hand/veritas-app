import React from 'react';

interface HexagonProps {
    filledSegments: number; // 0 to 6
}

export default function Hexagon({ filledSegments }: HexagonProps) {
    // Ensure 0-6 range
    const fill = Math.max(0, Math.min(6, filledSegments));

    // Calculate color based on fill (or just green for filled, grey for empty)
    // We'll use 6 SVG paths for the segments to create a true segmented hexagon

    // Segment paths for a flat-topped hexagon (or close approximation)
    // Center is 50, 50. Radius approx 45.
    // 6 Segments.

    const segments = [
        // Top Right
        "M 50 50 L 50 5 L 89 27.5 Z",
        // Right
        "M 50 50 L 89 27.5 L 89 72.5 Z",
        // Bottom Right
        "M 50 50 L 89 72.5 L 50 95 Z",
        // Bottom Left
        "M 50 50 L 50 95 L 11 72.5 Z",
        // Left
        "M 50 50 L 11 72.5 L 11 27.5 Z",
        // Top Left
        "M 50 50 L 11 27.5 L 50 5 Z"
    ];

    return (
        <div className="w-8 h-8 relative">
            <svg viewBox="0 0 100 100" className="w-full h-full transform rotate-30">
                {segments.map((path, index) => (
                    <path
                        key={index}
                        d={path}
                        fill={index < fill ? "#22c55e" : "#333"} // Green if filled, Dark Grey if empty
                        stroke="#000"
                        strokeWidth="2"
                    />
                ))}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4 h-4 bg-black rounded-full flex items-center justify-center">
                    <span className="text-[8px] font-bold text-gray-400">{fill}</span>
                </div>
            </div>
        </div>
    );
}
