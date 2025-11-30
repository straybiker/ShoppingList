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
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Trust proxy (required for correct IP detection behind Nginx/Docker/LXC proxies)
app.set('trust proxy', 1);

// Simple in-memory rate limiter
const rateLimit = new Map();
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes default
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX) || 1000; // 1000 requests default

function rateLimiter(req, res, next) {
    // Use IP as the identifier. 
    // Note: In a real multi-user app with auth, you'd use the user ID.
    // Here, we stick to IP to prevent abuse, but we've increased the limit
    // to accommodate multiple users behind the same NAT/Proxy.
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
        console.warn(`Rate limit exceeded for IP: ${ip}`);
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

async function readUsers() {
    try {
        const data = await fs.readFile(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        if (err.code === 'ENOENT') {
            return {};
        }
        console.error('Error reading users file:', err);
        return {};
    }
}

async function writeUsers(users) {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

// Mutex for atomic operations
class Mutex {
    constructor() {
        this.queue = [];
        this.locked = false;
    }

    async run(fn) {
        return new Promise((resolve, reject) => {
            this.queue.push({ fn, resolve, reject });
            this.process();
        });
    }

    async process() {
        if (this.locked || this.queue.length === 0) return;
        this.locked = true;

        const { fn, resolve, reject } = this.queue.shift();
        try {
            const result = await fn();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.locked = false;
            this.process();
        }
    }
}

const dbMutex = new Mutex();

// Helper to write data (direct write, concurrency handled by Mutex)
async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    broadcastChange();
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

// Helper to get list data safely (handles migration from array to object)
function getList(data, listId) {
    if (!data[listId]) return null;
    if (Array.isArray(data[listId])) {
        // Convert legacy array to object structure
        data[listId] = {
            items: data[listId],
            updatedAt: null // Unknown for legacy lists
        };
    }
    return data[listId];
}

// Helper to touch a list (update timestamp)
function touchList(data, listId) {
    const list = getList(data, listId);
    if (list) {
        list.updatedAt = Date.now();
    }
}

// API Routes

// Register/Update User
app.post('/api/users/register', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { username, displayName } = req.body;

            if (!username || typeof username !== 'string' || username.trim() === '') {
                return res.status(400).json({ error: 'Username is required' });
            }

            const safeUsername = username.trim().toLowerCase();
            const safeDisplayName = displayName ? displayName.trim() : safeUsername;

            const users = await readUsers();

            // Check if username exists
            if (users[safeUsername]) {
                // If it exists, we only allow updating if it's the same "session" or we just treat it as a login/update
                // For this simple app, we'll allow updating the display name for the existing username
                users[safeUsername].displayName = safeDisplayName;
                users[safeUsername].lastSeen = Date.now();
            } else {
                // Register new user
                users[safeUsername] = {
                    username: safeUsername,
                    displayName: safeDisplayName,
                    createdAt: Date.now(),
                    lastSeen: Date.now()
                };
            }

            await writeUsers(users);
            res.json({ success: true, user: users[safeUsername] });
        } catch (error) {
            console.error('Error registering user:', error);
            res.status(500).json({ error: 'Failed to register user' });
        }
    });
});

// Get all lists (Config Mode)
app.get('/api/lists', async (req, res) => {
    try {
        const data = await readData();
        const lists = Object.entries(data).map(([name, value]) => {
            const isLegacy = Array.isArray(value);
            return {
                name,
                updatedAt: isLegacy ? null : value.updatedAt,
                itemCount: isLegacy ? value.length : value.items.length
            };
        });
        res.json(lists);
    } catch (error) {
        console.error('Error getting lists:', error);
        res.status(500).json({ error: 'Failed to retrieve lists' });
    }
});

// Delete a specific list (Config Mode)
app.delete('/api/lists/:listId', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId } = req.params;
            const data = await readData();

            if (data[listId]) {
                delete data[listId];
                await writeData(data);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting list:', error);
            res.status(500).json({ error: 'Failed to delete list' });
        }
    });
});

// Get items for a specific list
app.get('/api/items/:listId', async (req, res) => {
    try {
        const { listId } = req.params;
        const data = await readData();
        const list = getList(data, listId);
        const items = list ? list.items : [];
        res.json(items);
    } catch (error) {
        console.error('Error getting items:', error);
        res.status(500).json({ error: 'Failed to retrieve items' });
    }
});

// Add a single item
app.post('/api/items/:listId', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId } = req.params;
            const incoming = req.body;

            // Build a normalized item for validation
            const candidate = {
                text: incoming && incoming.text,
                amount: incoming && incoming.amount,
                completed: !!(incoming && incoming.completed),
                addedBy: incoming && incoming.addedBy ? String(incoming.addedBy) : 'Guest',
                authorName: incoming && incoming.authorName ? String(incoming.authorName) : (incoming && incoming.addedBy ? String(incoming.addedBy) : 'Guest')
            };

            const validation = validateItemData(candidate);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }

            const data = await readData();

            // Initialize list if missing
            if (!data[listId]) {
                data[listId] = { items: [], updatedAt: Date.now() };
            } else {
                // Ensure structure is migrated
                getList(data, listId);
            }

            const list = data[listId];

            // Ensure a unique server-generated id
            let id = incoming && incoming.id ? String(incoming.id) : null;
            if (!id || list.items.some(it => it.id === id)) {
                id = crypto.randomUUID();
            }

            const newItem = {
                id,
                text: String(candidate.text).trim(),
                completed: !!candidate.completed,
                amount: typeof candidate.amount === 'number' ? candidate.amount : 1,
                addedBy: String(candidate.addedBy),
                authorName: String(candidate.authorName)
            };

            list.items.push(newItem);
            list.updatedAt = Date.now();

            await writeData(data);

            res.json({ success: true, item: newItem });
        } catch (error) {
            console.error('Error adding item:', error);
            res.status(500).json({ error: 'Failed to add item' });
        }
    });
});

// Update a single item
app.patch('/api/items/:listId/:itemId', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId, itemId } = req.params;
            const updates = req.body;

            const data = await readData();
            const list = getList(data, listId);

            if (!list) {
                return res.status(404).json({ error: 'List not found' });
            }

            const itemIndex = list.items.findIndex(item => String(item.id) === itemId);
            if (itemIndex === -1) {
                return res.status(404).json({ error: 'Item not found' });
            }

            // Sanitize and apply updates
            const sanitizedUpdates = sanitizeUpdates(updates);
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

            list.items[itemIndex] = { ...list.items[itemIndex], ...sanitizedUpdates };
            list.updatedAt = Date.now();

            await writeData(data);

            res.json({ success: true, item: list.items[itemIndex] });
        } catch (error) {
            console.error('Error updating item:', error);
            res.status(500).json({ error: 'Failed to update item' });
        }
    });
});

// Delete all items in a list (Clear List)
app.delete('/api/items/:listId', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId } = req.params;
            const data = await readData();
            const list = getList(data, listId);

            if (list) {
                list.items = [];
                list.updatedAt = Date.now();
                await writeData(data);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error clearing list:', error);
            res.status(500).json({ error: 'Failed to clear list' });
        }
    });
});

// Delete all completed items
app.delete('/api/items/:listId/completed', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId } = req.params;
            const data = await readData();
            const list = getList(data, listId);

            if (!list) {
                return res.status(404).json({ error: 'List not found' });
            }

            list.items = list.items.filter(item => !item.completed);
            list.updatedAt = Date.now();

            await writeData(data);

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting completed items:', error);
            res.status(500).json({ error: 'Failed to delete completed items' });
        }
    });
});

// Delete a single item
app.delete('/api/items/:listId/:itemId', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId, itemId } = req.params;
            const data = await readData();
            const list = getList(data, listId);

            if (!list) {
                return res.status(404).json({ error: 'List not found' });
            }

            list.items = list.items.filter(item => String(item.id) !== itemId);
            list.updatedAt = Date.now();

            await writeData(data);

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting item:', error);
            res.status(500).json({ error: 'Failed to delete item' });
        }
    });
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

