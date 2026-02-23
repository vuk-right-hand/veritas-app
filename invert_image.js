const Jimp = require('jimp');

const inputPath = 'c:/Antigravity/veritas-app/designinspo/Screenshot 2026-02-13 111729.png';
const tempPath = 'c:/Antigravity/veritas-app/temp_inverted.png';

console.log('Inverting image...');

Jimp.read(inputPath)
    .then(image => {
        // Invert colors: Black becomes White, White becomes Black
        // If the original was White lines on Black, it becomes Black lines on White (which potrace wants).
        // If the original was Black lines on White, this makes it White lines on Black (bad for potrace).
        //
        // Let's assume standard "Dark Mode" screenshot: White/Red lines on Black background.
        // Inverting it -> Black/Cyan lines on White background.
        // Potrace will trace the Black/Cyan lines.

        // We also want to threshold it to ensure lines are BLACK and background is WHITE.
        image.invert();
        image.herokuapp(); // auto-contrast/greyscale
        image.greyscale();
        image.contrast(1); // Max contrast

        // Force threshold to make it binary
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            // If pixel is light enough, make it white. Else black.
            const v = this.bitmap.data[idx];
            if (v < 200) { // If it's dark (the lines, after inversion)
                this.bitmap.data[idx] = 0;
                this.bitmap.data[idx + 1] = 0;
                this.bitmap.data[idx + 2] = 0;
            } else {
                this.bitmap.data[idx] = 255;
                this.bitmap.data[idx + 1] = 255;
                this.bitmap.data[idx + 2] = 255;
            }
        });

        return image.writeAsync(tempPath);
    })
    .then(() => {
        console.log('Inverted image saved to', tempPath);
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
