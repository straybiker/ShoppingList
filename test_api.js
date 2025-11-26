const http = require('http');

function request(options, data) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });
        req.on('error', reject);
        if (data) req.write(data);
        req.end();
    });
}

async function test() {
    const listId = 'test-list-' + Date.now();
    const item = { id: 1, text: 'Milk', completed: false, amount: 1 };

    console.log('Testing List ID:', listId);

    // 1. Save items
    console.log('Saving items...');
    const saveRes = await request({
        hostname: 'localhost',
        port: 80,
        path: `/api/items/${listId}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify([item]));

    console.log('Save Response:', saveRes.statusCode, saveRes.body);

    // 2. Get items
    console.log('Getting items...');
    const getRes = await request({
        hostname: 'localhost',
        port: 80,
        path: `/api/items/${listId}`,
        method: 'GET'
    });

    console.log('Get Response:', getRes.statusCode, getRes.body);

    const fetchedItems = JSON.parse(getRes.body);
    if (fetchedItems.length === 1 && fetchedItems[0].text === 'Milk') {
        console.log('SUCCESS: Items saved and retrieved correctly.');
    } else {
        console.log('FAILURE: Items mismatch.');
    }
}

test().catch(console.error);
