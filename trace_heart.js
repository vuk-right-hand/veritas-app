const fs = require('fs');
const ImageTracer = require('imagetracerjs');

// Options for detailed tracing
const options = {
    ltres: 0.1,    // Linear error threshold (lower = more detailed)
    qtres: 0.1,    // Quadratic error threshold (lower = more detailed)
    pathomit: 1, // Path omission (lower = keep small details)
    colorsampling: 2, // 0=disabled, 1=random, 2=deterministic
    numberofcolors: 16, // Reduce color complexity a bit but keep detail
    mincolorratio: 0.02,
    colorquantcycles: 3,
    scale: 1,
    simplify: 0, // Simplify (0=disabled)
    roundcoords: 1, // Round coordinates to 1 decimal place
    lcpr: 0,
    qcpr: 0,
    desc: false, // Show descriptions
    viewbox: true, // Use ViewBox
    blurradius: 0, // Blur radius
    blurdelta: 20 // Blur delta
};

// Input and Output Paths
const inputPath = 'c:/Antigravity/veritas-app/designinspo/Screenshot 2026-02-13 111729.png';
const outputPath = 'c:/Antigravity/veritas-app/public/veritas-heart.svg';

console.log(`Tracing ${inputPath}...`);

// Read file as buffer
const buffer = fs.readFileSync(inputPath);

// Convert to SVG
ImageTracer.imageToSVG(
    inputPath,
    function (svgstr) {
        fs.writeFileSync(outputPath, svgstr);
        console.log(`Saved SVG to ${outputPath}`);
    },
    options
);
