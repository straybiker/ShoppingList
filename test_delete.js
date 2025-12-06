// Using native fetch
const API_URL = 'http://localhost:3000/api';

async function testDelete() {
    try {
        // 1. Create a list
        console.log('Creating list...');
        const res = await fetch(`${API_URL}/lists`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ displayName: 'DeleteTest', createdBy: 'TestScript', creatorName: 'Tester' })
        });

        if (!res.ok) throw new Error(`Create failed: ${res.status}`);
        const data = await res.json();
        const listId = data.listId; // server returns listId
        console.log(`List created with ID: ${listId}`);

        // 2. Delete the list
        console.log(`Deleting list ${listId}...`);
        const delRes = await fetch(`${API_URL}/lists/${listId}`, {
            method: 'DELETE'
        });

        if (!delRes.ok) throw new Error(`Delete failed: ${delRes.status}`);
        console.log('Delete successful');

    } catch (e) {
        console.error('Test failed:', e);
        process.exit(1);
    }
}

testDelete();
