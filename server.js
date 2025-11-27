const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'lists.json');

// Simple in-memory rate limiter
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100;

function rateLimiter(req, res, next) {
    const ip = req.ip;
    const now = Date.now();

    if (!rateLimit.has(ip)) {
        rateLimit.set(ip, { count: 1, startTime: now });
        return next();
    }

    const userData = rateLimit.get(ip);

    if (now - userData.startTime > RATE_LIMIT_WINDOW) {
        // Reset window
        userData.count = 1;
        userData.startTime = now;
        return next();
    }

    if (userData.count >= MAX_REQUESTS) {
        return res.status(429).json({ error: 'Too many requests, please try again later.' });
    }

    userData.count++;
    next();
}

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/api', rateLimiter); // Apply rate limiting to API routes

// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Helper to read data
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return {};
        }
        console.error('Error reading data file:', err);
        return {};
    }
}

// Helper to write data
async function writeData(data) {
    // Enqueue write requests and process them sequentially to avoid
    // read-modify-write race conditions when multiple requests come in
    // at the same time.
    return enqueueWrite(data);
}

// Simple write queue to serialize writes to disk
const writeQueue = [];
let writeInProgress = false;

function enqueueWrite(data) {
    return new Promise((resolve, reject) => {
        writeQueue.push({ data, resolve, reject });
        processWriteQueue().catch(err => {
            // processWriteQueue handles errors per item; log as a fallback
            console.error('Error processing write queue:', err);
        });
    });
}

async function processWriteQueue() {
    if (writeInProgress) return;
    writeInProgress = true;

    while (writeQueue.length > 0) {
        const { data, resolve, reject } = writeQueue.shift();
        try {
            await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
            // Notify clients after successful write
            broadcastChange();
            resolve();
        } catch (err) {
            console.error('Error writing data file:', err);
            reject(err);
        }
    }

    writeInProgress = false;
}

// SSE Clients
let clients = [];

// Generate unique client ID
function generateClientId() {
    return crypto.randomUUID();
}

// SSE Endpoint
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const clientId = generateClientId();
    const newClient = {
        id: clientId,
        res,
        lastSeen: Date.now()
    };

    clients.push(newClient);
    console.log(`SSE client connected: ${clientId} (${clients.length} total)`);

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
        console.log(`SSE client disconnected: ${clientId} (${clients.length} remaining)`);
    });
});

function broadcastChange() {
    const message = `data: ${JSON.stringify({ type: 'update' })}\n\n`;

    clients = clients.filter(client => {
        try {
            client.res.write(message);
            client.lastSeen = Date.now();
            return true;
        } catch (error) {
            console.error('Failed to broadcast to client:', client.id, error.message);
            return false; // Remove dead connection
        }
    });
}

// Heartbeat to detect stale connections
setInterval(() => {
    const now = Date.now();
    const timeout = 60000; // 1 minute

    clients = clients.filter(client => {
        try {
            // Send heartbeat
            client.res.write(': heartbeat\n\n');

            // Check if client is stale
            if (now - client.lastSeen > timeout) {
                console.log(`Removing stale client: ${client.id}`);
                return false;
            }

            return true;
        } catch (error) {
            console.log(`Removing dead client: ${client.id}`);
            return false;
        }
    });
}, 30000); // Every 30 seconds

// Input validation helpers
function validateItemData(item) {
    if (!item || typeof item !== 'object') {
        return { valid: false, error: 'Invalid item data' };
    }
    if (!item.text || typeof item.text !== 'string' || item.text.trim() === '') {
        return { valid: false, error: 'Item text is required' };
    }
    if (item.text.length > 128) {
        return { valid: false, error: 'Item text must be 128 characters or less' };
    }
    if (item.amount !== undefined && (typeof item.amount !== 'number' || item.amount < 1)) {
        return { valid: false, error: 'Invalid amount' };
    }
    return { valid: true };
}

function sanitizeUpdates(updates) {
    const allowedFields = ['text', 'completed', 'amount'];
    return Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
            obj[key] = updates[key];
            return obj;
        }, {});
}

// API Routes

// Get items for a specific list
app.get('/api/items/:listId', async (req, res) => {
    try {
        const { listId } = req.params;
        const data = await readData();
        const items = data[listId] || [];
        res.json(items);
    } catch (error) {
        console.error('Error getting items:', error);
        res.status(500).json({ error: 'Failed to retrieve items' });
    }
});

// Add a single item
app.post('/api/items/:listId', async (req, res) => {
    try {
        const { listId } = req.params;
        const incoming = req.body;

        // Build a normalized item for validation (don't trust client-provided id)
        const candidate = {
            text: incoming && incoming.text,
            amount: incoming && incoming.amount,
            completed: !!(incoming && incoming.completed),
            addedBy: incoming && incoming.addedBy ? String(incoming.addedBy) : 'Guest'
        };

        const validation = validateItemData(candidate);
        if (!validation.valid) {
            return res.status(400).json({ error: validation.error });
        }

        const data = await readData();
        if (!data[listId]) {
            data[listId] = [];
        }

        // Ensure a unique server-generated id if none provided or if collision
        let id = incoming && incoming.id ? String(incoming.id) : null;
        if (!id || data[listId].some(it => it.id === id)) {
            id = crypto.randomUUID();
        }

        const newItem = {
            id,
            text: String(candidate.text).trim(),
            completed: !!candidate.completed,
            amount: typeof candidate.amount === 'number' ? candidate.amount : 1,
            addedBy: String(candidate.addedBy)
        };

        data[listId].push(newItem);
        await writeData(data);

        res.json({ success: true, item: newItem });
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(500).json({ error: 'Failed to add item' });
    }
});

// Update a single item
app.patch('/api/items/:listId/:itemId', async (req, res) => {
    try {
        const { listId, itemId } = req.params;
        const updates = req.body;

        const data = await readData();
        if (!data[listId]) {
            return res.status(404).json({ error: 'List not found' });
        }

        // Use String() comparison to handle legacy number IDs
        const itemIndex = data[listId].findIndex(item => String(item.id) === itemId);
        if (itemIndex === -1) {
            return res.status(404).json({ error: 'Item not found' });
        }

        // Sanitize and apply updates
        const sanitizedUpdates = sanitizeUpdates(updates);
        // Validate partial updates
        if (sanitizedUpdates.text !== undefined) {
            if (typeof sanitizedUpdates.text !== 'string' || sanitizedUpdates.text.trim() === '' || sanitizedUpdates.text.length > 128) {
                return res.status(400).json({ error: 'Invalid text for update' });
            }
            sanitizedUpdates.text = sanitizedUpdates.text.trim();
        }

        if (sanitizedUpdates.amount !== undefined) {
            if (typeof sanitizedUpdates.amount !== 'number' || sanitizedUpdates.amount < 1) {
                return res.status(400).json({ error: 'Invalid amount for update' });
            }
        }

        data[listId][itemIndex] = { ...data[listId][itemIndex], ...sanitizedUpdates };

        await writeData(data);

        res.json({ success: true, item: data[listId][itemIndex] });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
});

// Delete all completed items (MUST BE BEFORE /:itemId)
app.delete('/api/items/:listId/completed', async (req, res) => {
    try {
        const { listId } = req.params;

        const data = await readData();
        if (!data[listId]) {
            return res.status(404).json({ error: 'List not found' });
        }

        data[listId] = data[listId].filter(item => !item.completed);
        await writeData(data);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting completed items:', error);
        res.status(500).json({ error: 'Failed to delete completed items' });
    }
});

// Delete a single item
app.delete('/api/items/:listId/:itemId', async (req, res) => {
    try {
        const { listId, itemId } = req.params;

        const data = await readData();
        if (!data[listId]) {
            return res.status(404).json({ error: 'List not found' });
        }

        // Use String() comparison to handle legacy number IDs
        data[listId] = data[listId].filter(item => String(item.id) !== itemId);
        await writeData(data);

        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize and start server
async function startServer() {
    await ensureDataDir();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer().catch(console.error);
