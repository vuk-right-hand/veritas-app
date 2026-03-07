require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

async function run() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Use Postgres REST API API endpoint to execute rpc or raw query if available.
    // The easiest way to force creation safely if we don't have direct SQL is using the local CLI
    // Since local CLI keeps hanging, we must bypass interactive prompts successfully.
    
    // Instead of raw query which might need an RPC, let's use standard node exec for supabase
    // and pipe "y\n" to it properly through stdin explicitly, avoiding windows pipe issues.

    const { exec } = require('child_process');
    console.log("Starting supabase db push through node spawn...");
    
    const { spawn } = require('child_process');
    const child = spawn('npx.cmd', ['supabase', 'db', 'push', '--linked'], {
      stdio: ['pipe', 'inherit', 'inherit'],
      shell: true
    });
    
    setTimeout(() => {
       console.log("Writing yes into stdin...");
       child.stdin.write('y\n');
    }, 2000); // 2 second delay to wait for prompt

    setTimeout(() => {
       console.log("Writing second yes into stdin...");
       child.stdin.write('y\n');
       child.stdin.end();
    }, 4000);
    
    child.on('exit', code => {
      console.log(`Child exited with code ${code}`);
      process.exit(code);
    });

  } catch (err) {
    console.error('Error', err);
  }
}

run();
