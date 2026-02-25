async function testAnalyze() {
    console.log("Testing analyze API...");
    try {
        const response = await fetch('http://localhost:3000/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url: 'https://www.youtube.com/watch?v=X5zgFLgFwXE'
            })
        });

        const data = await response.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}

testAnalyze();
