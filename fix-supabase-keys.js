const fs = require('fs');
const files = [
    'src/app/actions/video-actions.ts',
    'src/app/actions/profile-actions.ts',
    'src/app/actions/interest-actions.ts',
    'src/app/actions/feature-actions.ts',
    'src/app/actions/creator-actions.ts',
    'src/app/actions/channel-actions.ts',
    'src/app/actions/auth-actions.ts'
];
for (const f of files) {
    if (!fs.existsSync(f)) continue;
    let content = fs.readFileSync(f, 'utf8');
    content = content.replace(
        "const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'dummy_key';",
        "const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;"
    );
    fs.writeFileSync(f, content);
    console.log('Fixed', f);
}
