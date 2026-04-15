#!/usr/bin/env node
// Classification health check. Manual run during launch week.
// Reads classification_daily_stats view + a few sanity counters.
//
// Alerts (prints "ALERT:" lines, non-zero exit) if:
//   - Any classification_status='failed' in last 24h
//   - Rejected rate > 40% of total in last 24h
//   - Any feed_category missing (all three should have rows in last 7d)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(2);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

function fmtRow(day, cat, status, n) {
  return `  ${day.slice(0, 10)}  ${(cat ?? '—').padEnd(9)}  ${(status ?? '—').padEnd(16)}  ${n}`;
}

let alerts = 0;

async function main() {
  console.log('=== Classification health (last 7d) ===\n');

  const { data: stats, error: statsErr } = await supabase
    .from('classification_daily_stats')
    .select('*');
  if (statsErr) {
    console.error('Failed to read stats view:', statsErr.message);
    process.exit(2);
  }

  console.log('  day         category   status            n');
  console.log('  ----------- ---------  ----------------  --');
  for (const row of stats ?? []) {
    console.log(fmtRow(row.day, row.feed_category, row.classification_status, row.videos));
  }

  // Per-category coverage (7d)
  const seen = new Set((stats ?? []).map((r) => r.feed_category));
  for (const cat of ['pulse', 'forge', 'alchemy']) {
    if (!seen.has(cat)) {
      console.log(`\nALERT: no ${cat} videos in the last 7 days`);
      alerts++;
    }
  }

  // Last-24h failure + reject counters
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: recent, error: recErr } = await supabase
    .from('videos')
    .select('classification_status')
    .gte('created_at', since);
  if (recErr) {
    console.error('\nFailed to read recent rows:', recErr.message);
    process.exit(2);
  }

  const total = recent?.length ?? 0;
  const failed = (recent ?? []).filter((r) => r.classification_status === 'failed').length;
  const rejected = (recent ?? []).filter((r) => r.classification_status === 'rejected').length;

  console.log(`\n24h totals: ${total} rows  (failed: ${failed}, rejected: ${rejected})`);

  if (failed > 0) {
    console.log(`ALERT: ${failed} rows with classification_status='failed' in last 24h`);
    alerts++;
  }
  if (total > 0 && rejected / total > 0.4) {
    console.log(`ALERT: reject rate ${(100 * rejected / total).toFixed(1)}% > 40% threshold`);
    alerts++;
  }

  if (alerts === 0) {
    console.log('\nAll health checks green.');
    process.exit(0);
  } else {
    console.log(`\n${alerts} alert(s) raised.`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Health check crashed:', e);
  process.exit(2);
});
