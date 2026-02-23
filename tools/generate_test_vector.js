// Generate a 3072-dim test vector for SQL testing
const testVector = Array(3072).fill(0).map(() => Math.random() * 0.1);
const sqlVector = `'[${testVector.join(',')}]'::vector(3072)`;

console.log("Copy this entire line into Supabase SQL Editor:");
console.log("\nSELECT * FROM match_videos(");
console.log(sqlVector + ",");
console.log("0.0::double precision,");
console.log("5");
console.log(");");
