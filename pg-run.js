const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
});

async function run() {
  try {
    const sql = fs.readFileSync('supabase/migrations/20260307131500_create_platform_updates.sql', 'utf8');
    console.log('Executing migration...');
    const result = await pool.query(sql);
    console.log('Migration executed successfully', result);
  } catch (err) {
    console.error('Error executing migration', err);
  } finally {
    await pool.end();
  }
}

run();
