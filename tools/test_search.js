// Node 18+ has global fetch

async function testSearch(query) {
    console.log(`\n=== Testing Search: "${query}" ===`);

    const response = await fetch('http://localhost:3000/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
    });

    const data = await response.json();
    console.log(`Status: ${response.status}`);

    if (data.error) {
        console.log(`Error: ${data.error}`);
    } else if (data.matches) {
        console.log(`Matches found: ${data.matches.length}`);
        data.matches.forEach((m, i) => {
            console.log(`  ${i + 1}. ${m.title} (Score: ${m.human_score}, Similarity: ${m.similarity?.toFixed(3)})`);
        });
    } else {
        console.log("Response:", JSON.stringify(data, null, 2));
    }
}

async function run() {
    await testSearch("business");
    await testSearch("great products");
    await testSearch("marketing");
}

run();
