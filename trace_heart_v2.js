const potrace = require('potrace');
const Jimp = require('jimp');
const fs = require('fs');

const inputPath = 'c:/Antigravity/veritas-app/designinspo/Screenshot 2026-02-13 111729.png';
const outputPath = 'c:/Antigravity/veritas-app/public/veritas-heart.svg';

console.log(`Processing ${inputPath}...`);

// 1. Preprocess with Jimp
Jimp.read(inputPath)
    .then(image => {
        // Strategy: Assume corners are background. Make background WHITE, foreground BLACK.
        // Potrace traces BLACK shapes on WHITE background.

        const width = image.bitmap.width;
        const height = image.bitmap.height;

        // Get background color from top-left pixel
        const bgColor = image.getPixelColor(0, 0);
        const bgRGBA = Jimp.intToRGBA(bgColor);

        console.log('Background Color detected:', bgRGBA);

        // Scan every pixel
        image.scan(0, 0, width, height, function (x, y, idx) {
            const red = this.bitmap.data[idx + 0];
            const green = this.bitmap.data[idx + 1];
            const blue = this.bitmap.data[idx + 2];
            const alpha = this.bitmap.data[idx + 3];

            // Simple distance check from background color
            const dist = Math.sqrt(
                Math.pow(red - bgRGBA.r, 2) +
                Math.pow(green - bgRGBA.g, 2) +
                Math.pow(blue - bgRGBA.b, 2)
            );

            // If close to background, make it WHITE (transparent for potrace)
            // If far from background (foreground), make it BLACK (to be traced)
            if (dist < 50) { // Tolerance
                // Set to White
                this.bitmap.data[idx + 0] = 255;
                this.bitmap.data[idx + 1] = 255;
                this.bitmap.data[idx + 2] = 255;
                this.bitmap.data[idx + 3] = 255; // Full opacity
            } else {
                // Set to Black
                this.bitmap.data[idx + 0] = 0;
                this.bitmap.data[idx + 1] = 0;
                this.bitmap.data[idx + 2] = 0;
                this.bitmap.data[idx + 3] = 255; // Full opacity
            }
        });

        // Get buffer for potrace
        return image.getBufferAsync(Jimp.MIME_BMP);
    })
    .then(buffer => {
        console.log('Image processed. Tracing...');

        const params = {
            threshold: 128,
            steps: 4,
            turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
            turdSize: 100,
            optCurve: true,
            alphaMax: 1,
            optTolerance: 0.2,
            color: '#ff0000', // RED Lines
            background: 'transparent' // Transparent background
        };

        potrace.trace(buffer, params, function (err, svg) {
            if (err) {
                console.error('Error tracing:', err);
                return;
            }

            fs.writeFileSync(outputPath, svg);
            console.log(`Saved Refined SVG to ${outputPath}`);
        });
    })
    .catch(err => {
        console.error('Error processing image:', err);
    });
