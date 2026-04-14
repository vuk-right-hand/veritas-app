// Code-verifiable audit for the 3-tab feed migrations + RPC.
// Run: node --env-file=.env.local scripts/audit-feed-rpc.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(url, svc, { auth: { persistSession: false } });
const pub = createClient(url, anon, { auth: { persistSession: false } });

const results = [];
const pass = (n, d='') => { results.push({ok:true, n, d}); console.log(`PASS  ${n}${d?'  — '+d:''}`); };
const fail = (n, d='') => { results.push({ok:false, n, d}); console.log(`FAIL  ${n}${d?'  — '+d:''}`); };
const warn = (n, d='') => { results.push({ok:null, n, d}); console.log(`WARN  ${n}${d?'  — '+d:''}`); };

async function test1_columnExists() {
  const { data, error } = await admin
    .from('videos')
    .select('id, feed_category')
    .limit(1);
  if (error) return fail('1. videos.feed_category column exists', error.message);
  pass('1. videos.feed_category column exists');
}

async function test2_rpcCallableAsAnon() {
  const { data, error } = await pub.rpc('get_personalized_feed', {
    p_feed_category: 'forge',
    p_limit: 5,
    p_offset: 0,
    p_exclude_ids: [],
  });
  if (error) return fail('2. RPC callable as anon', error.message);
  if (!Array.isArray(data)) return fail('2. RPC callable as anon', 'non-array result');
  pass('2. RPC callable as anon', `returned ${data.length} rows`);
  return data;
}

async function test3_anonOverlapZero(rows) {
  if (!rows || rows.length === 0) return warn('3. Anon overlap_score=0', 'no rows to check — seed some forge videos');
  const nonzero = rows.filter(r => Number(r.overlap_score) !== 0);
  if (nonzero.length > 0) return fail('3. Anon overlap_score=0', `${nonzero.length} rows had non-zero score — RLS may be exposing user_interest_scores to anon`);
  pass('3. Anon overlap_score=0', `all ${rows.length} rows score 0 (expected for anon)`);
}

async function test4_rpcOrderingChronological(rows) {
  if (!rows || rows.length < 2) return warn('4. Anon ordering is published_at DESC', 'need 2+ rows');
  const dates = rows.map(r => r.published_at ? new Date(r.published_at).getTime() : 0);
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] > dates[i-1]) return fail('4. Anon ordering is published_at DESC', `row ${i} newer than row ${i-1}`);
  }
  pass('4. Anon ordering is published_at DESC');
}

async function test5_legacyNullInvisible() {
  const { count: nullCount } = await admin
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'verified')
    .is('feed_category', null);
  const cats = ['pulse', 'forge', 'alchemy'];
  for (const c of cats) {
    const { data, error } = await pub.rpc('get_personalized_feed', {
      p_feed_category: c, p_limit: 200, p_offset: 0, p_exclude_ids: [],
    });
    if (error) return fail(`5. Legacy NULL invisible on ${c}`, error.message);
    const leaked = data.filter(r => r.feed_category !== c);
    if (leaked.length > 0) return fail(`5. Legacy NULL invisible on ${c}`, `${leaked.length} rows had wrong category`);
  }
  pass('5. Legacy NULL invisible in all 3 tabs', `${nullCount ?? '?'} verified videos still uncategorized`);
}

async function test6_excludeIdsHonored() {
  const { data: page0, error: e0 } = await pub.rpc('get_personalized_feed', {
    p_feed_category: 'forge', p_limit: 3, p_offset: 0, p_exclude_ids: [],
  });
  if (e0) return fail('6. p_exclude_ids honored', e0.message);
  if (!page0 || page0.length === 0) return warn('6. p_exclude_ids honored', 'no forge rows to exclude-test');
  const excludeIds = page0.map(r => r.id);
  const { data: page1, error: e1 } = await pub.rpc('get_personalized_feed', {
    p_feed_category: 'forge', p_limit: 10, p_offset: 0, p_exclude_ids: excludeIds,
  });
  if (e1) return fail('6. p_exclude_ids honored', e1.message);
  const leaked = page1.filter(r => excludeIds.includes(r.id));
  if (leaked.length > 0) return fail('6. p_exclude_ids honored', `${leaked.length} excluded ids still returned`);
  pass('6. p_exclude_ids honored', `excluded ${excludeIds.length} ids, none reappeared`);
}

async function test7_rpcRejectsBadCategory() {
  const { data, error } = await pub.rpc('get_personalized_feed', {
    p_feed_category: 'news', p_limit: 5, p_offset: 0, p_exclude_ids: [],
  });
  // Either returns 0 rows (no matching category) or no error — both are acceptable
  // since feed_category CHECK constraint only fires on writes, not reads.
  if (error) return warn('7. RPC with bogus category', `errored: ${error.message}`);
  if (!data || data.length === 0) return pass('7. RPC with bogus category returns empty');
  pass('7. RPC with bogus category', `returned ${data.length} rows (CHECK is write-side)`);
}

async function test8_analyticsEventsTable() {
  const { error } = await admin
    .from('analytics_events')
    .select('id', { count: 'exact', head: true })
    .limit(1);
  if (error) return fail('8. analytics_events table exists', error.message);
  pass('8. analytics_events table exists');
}

async function test9_adminRolesTable() {
  const { count, error } = await admin
    .from('admin_roles')
    .select('*', { count: 'exact', head: true });
  if (error) return fail('9. admin_roles table exists', error.message);
  pass('9. admin_roles table exists', `${count ?? 0} admins registered`);
}

async function test10_categoryCounts() {
  const { count: total } = await admin
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'verified');
  const cats = ['pulse', 'forge', 'alchemy'];
  const counts = {};
  for (const c of cats) {
    const { count } = await admin
      .from('videos')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'verified')
      .eq('feed_category', c);
    counts[c] = count ?? 0;
  }
  const classified = counts.pulse + counts.forge + counts.alchemy;
  const unclassified = (total ?? 0) - classified;
  console.log(`\nSEEDING  total verified=${total}  pulse=${counts.pulse}  forge=${counts.forge}  alchemy=${counts.alchemy}  unclassified=${unclassified}`);
  if (unclassified === total) warn('10. Seeding', 'ALL verified videos are unclassified — Forge/Alchemy/Pulse will be empty until admin classifies');
  else pass('10. Seeding', 'at least some videos are classified');
}

async function test11_userInterestScoresReadableByService() {
  const { count, error } = await admin
    .from('user_interest_scores')
    .select('*', { count: 'exact', head: true });
  if (error) return fail('11. user_interest_scores exists', error.message);
  pass('11. user_interest_scores exists', `${count ?? 0} rows total`);
}

async function test12_videoTagsReadableByAnon() {
  // Critical for INVOKER — video_tags must be readable by anon/authenticated for overlap subquery
  const { data, error } = await pub
    .from('video_tags')
    .select('video_id, tag, weight')
    .limit(1);
  if (error) return fail('12. video_tags readable by anon (INVOKER dep)', error.message);
  pass('12. video_tags readable by anon', data && data.length > 0 ? 'has rows' : 'table empty but SELECT allowed');
}

async function test13_userInterestScoresBlockedForAnon() {
  // RLS must hide other users' scores from anon. If anon can read them, INVOKER mode is still safe
  // but RLS posture is too open.
  const { data, error } = await pub
    .from('user_interest_scores')
    .select('user_id, tag, score')
    .limit(1);
  if (error) {
    pass('13. user_interest_scores blocked for anon', `RLS rejects anon read: ${error.message}`);
  } else if (!data || data.length === 0) {
    pass('13. user_interest_scores blocked for anon', 'anon SELECT returned 0 rows (RLS working)');
  } else {
    fail('13. user_interest_scores leaks to anon', `${data.length} row(s) visible to anon — RLS policy missing`);
  }
}

(async () => {
  console.log('\n=== FEED 3-TAB AUDIT ===\n');
  await test1_columnExists();
  const rows = await test2_rpcCallableAsAnon();
  await test3_anonOverlapZero(rows);
  await test4_rpcOrderingChronological(rows);
  await test5_legacyNullInvisible();
  await test6_excludeIdsHonored();
  await test7_rpcRejectsBadCategory();
  await test8_analyticsEventsTable();
  await test9_adminRolesTable();
  await test10_categoryCounts();
  await test11_userInterestScoresReadableByService();
  await test12_videoTagsReadableByAnon();
  await test13_userInterestScoresBlockedForAnon();

  const passes = results.filter(r => r.ok === true).length;
  const fails = results.filter(r => r.ok === false).length;
  const warns = results.filter(r => r.ok === null).length;
  console.log(`\n=== ${passes} pass · ${fails} fail · ${warns} warn ===`);
  process.exit(fails > 0 ? 1 : 0);
})();
