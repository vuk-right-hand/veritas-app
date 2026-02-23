const fs = require('fs');
const path = require('path');

function processDir(dir) {
    fs.readdirSync(dir).forEach(file => {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            // Fix NEXT_PUBLIC_SUPABASE_URL
            if (content.match(/const supabaseUrl = process\.env\.NEXT_PUBLIC_SUPABASE_URL(!| as string)?;/)) {
                content = content.replace(
                    /const supabaseUrl = process\.env\.NEXT_PUBLIC_SUPABASE_URL(!| as string)?;/g,
                    "const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dummy.supabase.co';"
                );
                modified = true;
            }

            // Fix SUPABASE_SERVICE_ROLE_KEY
            if (content.match(/const supabaseServiceKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY(!| as string)?;/)) {
                content = content.replace(
                    /const supabaseServiceKey = process\.env\.SUPABASE_SERVICE_ROLE_KEY(!| as string)?;/g,
                    "const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';"
                );
                modified = true;
            }

            // Fix NEXT_PUBLIC_SUPABASE_ANON_KEY
            if (content.match(/const supabaseKey = process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY(!| as string)?;/)) {
                content = content.replace(
                    /const supabaseKey = process\.env\.NEXT_PUBLIC_SUPABASE_ANON_KEY(!| as string)?;/g,
                    "const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'dummy_key';"
                );
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed env vars in:', fullPath);
            }
        }
    });
}

processDir(path.join(__dirname, 'src'));
