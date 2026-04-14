// Diagnose why overlap_score = 0 for a specific user.
// Run: node --env-file=.env.local scripts/diagnose-personalization.mjs <user_id>
import { createClient } from '@supabase/supabase-js';

const userId = process.argv[2] || '06187afa-06aa-4c8e-b502-f9ca81d90fb2';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, svc, { auth: { persistSession: false } });

console.log(`\n=== PERSONALIZATION DIAGNOSTIC for ${userId} ===\n`);

// 1. Does this user have interest scores at all?
const { data: scores, error: se } = await admin
  .from('user_interest_scores')
  .select('tag, score, last_updated')
  .eq('user_id', userId)
  .order('score', { ascending: false });

if (se) { console.error('user_interest_scores query error:', se); process.exit(1); }
console.log(`1. user_interest_scores rows for this user: ${scores?.length ?? 0}`);
if (scores && scores.length > 0) {
  console.log('   top 10:', scores.slice(0, 10).map(s => `${s.tag}=${s.score}`).join(', '));
}

// 2. What tags exist on the 11 classified videos?
const { data: vids } = await admin
  .from('videos')
  .select('id, feed_category, title')
  .in('feed_category', ['pulse', 'forge', 'alchemy']);

console.log(`\n2. Classified videos: ${vids?.length ?? 0}`);

const videoIds = (vids ?? []).map(v => v.id);
const { data: tags, error: te } = await admin
  .from('video_tags')
  .select('video_id, tag, weight')
  .in('video_id', videoIds);

if (te) { console.error('video_tags query error:', te); process.exit(1); }
console.log(`3. video_tags rows for classified videos: ${tags?.length ?? 0}`);

// Per-video tag count
const tagsByVideo = {};
(tags ?? []).forEach(t => { tagsByVideo[t.video_id] = (tagsByVideo[t.video_id] || 0) + 1; });
const taggedVideos = (vids ?? []).filter(v => tagsByVideo[v.id] > 0);
const untaggedVideos = (vids ?? []).filter(v => !tagsByVideo[v.id]);
console.log(`   - videos WITH tags: ${taggedVideos.length}`);
console.log(`   - videos WITHOUT tags: ${untaggedVideos.length}`);
if (untaggedVideos.length > 0) {
  console.log(`   - untagged (first 5): ${untaggedVideos.slice(0,5).map(v=>`${v.id} [${v.feed_category}] "${v.title?.slice(0,40)}"`).join('\n                        ')}`);
}

// 4. Unique tags in video_tags
const videoTagSet = new Set((tags ?? []).map(t => t.tag));
console.log(`\n4. Unique tags across classified videos: ${videoTagSet.size}`);
if (videoTagSet.size > 0 && videoTagSet.size <= 30) {
  console.log(`   tags: ${[...videoTagSet].join(', ')}`);
}

// 5. Overlap: which user tags match any video tag?
const userTagSet = new Set((scores ?? []).map(s => s.tag));
const overlap = [...userTagSet].filter(t => videoTagSet.has(t));
console.log(`\n5. TAG OVERLAP (user ∩ video_tags): ${overlap.length} tags`);
if (overlap.length > 0) console.log(`   matching: ${overlap.join(', ')}`);

// 6. Verdict
console.log('\n=== VERDICT ===');
if (!scores || scores.length === 0) {
  console.log('❌ User has ZERO interest scores — nothing to rank against. User needs to watch a video first (/api/watch-progress scores their tags).');
} else if (tags.length === 0) {
  console.log('❌ Classified videos have ZERO video_tags — tagging pipeline never ran on them. See /api/analyze output shape.');
} else if (untaggedVideos.length === vids.length) {
  console.log('❌ NONE of the classified videos are tagged. Run /api/analyze against them (or re-approve) to populate video_tags.');
} else if (overlap.length === 0) {
  console.log(`⚠️  User has ${scores.length} scores and videos have ${videoTagSet.size} tags, but ZERO overlap. User\'s interests don\'t match any classified video — expected to fall back to chronological.`);
} else {
  console.log(`✅ Overlap exists (${overlap.length} matching tags). If overlap_score is still 0 in the app, the RPC is misfiring — file a bug.`);
}
