const http = require('http');

// Configuration
const HOST = process.argv[2] || 'localhost';
const PORT = process.argv[3] || 80; // Default to 80 (Node) or 8081 (Docker)

console.log(`Checking health of http://${HOST}:${PORT}...`);

const options = {
    hostname: HOST,
    port: PORT,
    path: '/api/items/health-check-test',
    method: 'GET',
    timeout: 2000 // 2s timeout
};

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);

    if (res.statusCode === 200) {
        console.log('✅ Server is reachable and API is responding.');

        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
            try {
                const data = JSON.parse(body);
                if (Array.isArray(data)) {
                    console.log('✅ API returned valid JSON array.');
                } else {
                    console.log('⚠️ API returned unexpected data format:', body);
                }
            } catch (e) {
                console.log('❌ API returned invalid JSON:', body);
            }
        });
    } else {
        console.log('❌ Server returned an error status.');
    }
});

req.on('error', (e) => {
    console.error(`❌ Connection failed: ${e.message}`);
    console.log('\nTroubleshooting tips:');
    console.log('1. Is the server running?');
    console.log('2. Is the port correct? (Try 8081 for Docker, 80 for npm start)');
    console.log('3. Are you using the correct IP address?');
});

req.on('timeout', () => {
    req.destroy();
    console.error('❌ Connection timed out.');
});

req.end();
