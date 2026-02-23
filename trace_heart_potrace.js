const potrace = require('potrace');
const fs = require('fs');

const inputPath = 'c:/Antigravity/veritas-app/designinspo/Screenshot 2026-02-13 111729.png';
const outputPath = 'c:/Antigravity/veritas-app/public/veritas-heart.svg';

console.log(`Tracing ${inputPath} with potrace...`);

const params = {
    threshold: 128,
    steps: 4,
    turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
    turdSize: 100,
    optCurve: true,
    alphaMax: 1,
    optTolerance: 0.2,
    color: '#ff0000', // Red color for "heart"
    background: 'transparent'
};

potrace.trace(inputPath, params, function (err, svg) {
    if (err) {
        console.error('Error:', err);
        process.exit(1);
    }

    // Customize SVG: Add neon glow effect manually if potrace doesn't support filters easily
    // We will simple save the path for now, maybe add class later

    // Potrace returns a full SVG string. 
    // Let's inject a class or style if needed, but for now raw SVG is fine.
    // The user wants "Exact shape".

    fs.writeFileSync(outputPath, svg);
    console.log(`Saved SVG to ${outputPath}`);
});
