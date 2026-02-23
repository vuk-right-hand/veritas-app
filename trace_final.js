const Jimp = require('jimp');
const potrace = require('potrace');
const fs = require('fs');

const inputPath = 'c:/Antigravity/veritas-app/designinspo/Screenshot 2026-02-13 111729.png';
const outputPath = 'c:/Antigravity/veritas-app/public/veritas-heart.svg';

async function processAndTrace() {
    try {
        console.log(`Reading ${inputPath}...`);
        const image = await Jimp.read(inputPath);

        // Manual Thresholding for "Red Lines on Dark BG"
        // Target: Black Lines on White BG for Potrace

        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];

            // Heuristic: If pixel has significant color (Red lines), make it BLACK (foreground).
            // If pixel is dark (Background), make it WHITE (background).

            // Adjust threshold as needed. Assuming Red lines are bright enough.
            if (r > 50 || g > 50 || b > 50) {
                // Foreground -> Black
                this.bitmap.data[idx + 0] = 0;
                this.bitmap.data[idx + 1] = 0;
                this.bitmap.data[idx + 2] = 0;
            } else {
                // Background -> White
                this.bitmap.data[idx + 0] = 255;
                this.bitmap.data[idx + 1] = 255;
                this.bitmap.data[idx + 2] = 255;
            }
            this.bitmap.data[idx + 3] = 255; // Alpha full
        });

        // Get buffer
        const buffer = await image.getBufferAsync(Jimp.MIME_BMP);

        console.log('Tracing...');

        const params = {
            threshold: 128,
            color: '#ff0000', // Output Red SVG
            optCurve: true,
            optTolerance: 0.2,
            turdSize: 50,
            turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY
        };

        potrace.trace(buffer, params, function (err, svg) {
            if (err) throw err;
            fs.writeFileSync(outputPath, svg);
            console.log(`Success! Saved to ${outputPath}`);
        });

    } catch (err) {
        console.error('Error:', err);
    }
}

processAndTrace();
