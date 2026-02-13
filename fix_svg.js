const fs = require('fs');

const svgPath = 'c:/Antigravity/veritas-app/public/veritas-heart.svg';

try {
    let svgContent = fs.readFileSync(svgPath, 'utf8');

    // Extract the 'd' attribute
    const pathMatch = svgContent.match(/d="([^"]+)"/);
    if (!pathMatch) {
        throw new Error('No path data found');
    }

    const fullPathData = pathMatch[1];

    // Split by 'M' command (absolute move), preserving the 'M'
    // Regex lookahead to split before 'M'
    const subPaths = fullPathData.split(/(?=M )/);

    console.log(`Found ${subPaths.length} subpaths.`);

    // Filter out bounding boxes.
    // Heuristic: Bounding boxes start near (0,0) or (0, y).
    // The main heart shape starts around 651, 201.

    const validSubPaths = subPaths.filter((sp, index) => {
        const trimmed = sp.trim();
        // Check start coordinates
        // Format: M x y ...
        const parts = trimmed.split(/[ ,]+/);
        const x = parseFloat(parts[1]);
        const y = parseFloat(parts[2]);

        console.log(`Subpath ${index}: Starts at (${x}, ${y})`);

        // Remove if it starts at 0 or very close to 0 (the bounding box)
        if (x < 10) {
            console.log(`  -> Removing Subpath ${index} (Bounding Box candidate)`);
            return false;
        }

        console.log(`  -> Keeping Subpath ${index}`);
        return true;
    });

    if (validSubPaths.length === 0) {
        throw new Error('All paths were filtered out!');
    }

    const newPathData = validSubPaths.join(' ');

    // Replace in content
    const newSvgContent = svgContent.replace(fullPathData, newPathData);

    fs.writeFileSync(svgPath, newSvgContent);
    console.log('SVG updated successfully. Bounding box removed.');

} catch (err) {
    console.error('Error fixing SVG:', err);
    process.exit(1);
}
