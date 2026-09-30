const express = require('express');
const fs = require('fs').promises;
const fsSync = require('fs');
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
    // Use IP as the identifier. There are no user accounts.
    // The limit is high to accommodate multiple users behind the same NAT/Proxy.
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
app.use(express.json());

// Serve static files with caching policy
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        } else {
            // Cache other static assets (JS/CSS/Images) for a long time (1 year)
            // since they are hashed by Vite
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
    }
}));

// SSE reconnects must not count against the limit: a 429 closes the EventSource for good.
app.use('/api', (req, res, next) => req.path === '/events' ? next() : rateLimiter(req, res, next));



// Ensure data directory exists
async function ensureDataDir() {
    try {
        await fs.access(DATA_DIR);
    } catch {
        await fs.mkdir(DATA_DIR, { recursive: true });
    }
}

// Read a JSON store into a null-prototype object.
// Null prototype: keys such as "__proto__" from user input cannot pollute Object.prototype.
// Only a missing file gives an empty store. Any other error is thrown, so that
// a corrupt file never causes the next write to overwrite all data.
async function readStore(file) {
    let raw;
    try {
        raw = await fs.readFile(file, 'utf8');
    } catch (err) {
        if (err.code === 'ENOENT') {
            return Object.create(null);
        }
        throw err;
    }

    let parsed;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        console.error(`Corrupt data file ${file}. Refusing to continue:`, err.message);
        throw err;
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error(`Unexpected content in data file ${file}`);
    }
    return Object.assign(Object.create(null), parsed);
}

// Atomic write: write a temp file, then rename it over the target.
// A crash during the write leaves the old file intact.
async function writeStore(file, content) {
    const tmpFile = `${file}.${process.pid}.tmp`;
    await fs.writeFile(tmpFile, JSON.stringify(content, null, 2));
    await fs.rename(tmpFile, file);
}

async function readData() {
    return readStore(DATA_FILE);
}

async function readUsers() {
    return readStore(USERS_FILE);
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
    await writeStore(DATA_FILE, data);
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
    res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx)
    res.flushHeaders();

    const clientId = generateClientId();
    const newClient = {
        id: clientId,
        res
    };

    clients.push(newClient);
    console.log(`SSE client connected: ${clientId} (${clients.length} total)`);

    // Tell the browser to reconnect after 3 s, then send initial connection message
    res.write('retry: 3000\n\n');
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId })}\n\n`);

    req.on('close', () => {
        clients = clients.filter(client => client.id !== clientId);
        console.log(`SSE client disconnected: ${clientId} (${clients.length} remaining)`);
    });
});

// Write a message to all SSE clients. Drop (and close) connections that are gone.
function sendToClients(message) {
    clients = clients.filter(client => {
        const { res } = client;
        if (res.destroyed || res.writableEnded) {
            console.log(`Removing dead client: ${client.id}`);
            return false;
        }
        try {
            res.write(message);
            return true;
        } catch (error) {
            console.error('Failed to write to client:', client.id, error.message);
            res.end();
            return false;
        }
    });
}

function broadcastChange() {
    sendToClients(`data: ${JSON.stringify({ type: 'update' })}\n\n`);
}

// Heartbeat keeps idle connections open through proxies and detects dead ones
setInterval(() => {
    sendToClients(': heartbeat\n\n');
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

// Amount is not accepted here: it changes only through increment/decrement.
function sanitizeUpdates(updates) {
    const allowedFields = ['text', 'completed'];
    return Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj, key) => {
            obj[key] = updates[key];
            return obj;
        }, {});
}

// A soft-deleted list stays restorable for this period, then it is purged.
const DELETE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

// Knowing the list ID gives full access to the list, so new IDs carry 128 random bits.
// Legacy IDs ("<timestamp>-<random>") match the same pattern and stay valid.
const LIST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

function generateListId() {
    return crypto.randomBytes(16).toString('base64url');
}

// Result of a list lookup: { list } or { status, error }.
// A soft-deleted list answers 410, so that a client can offer a restore.
function findActiveList(data, listId) {
    const list = data[listId];
    if (!list) {
        return { status: 404, error: 'List not found' };
    }
    if (list.deletedAt) {
        return { status: 410, error: 'List deleted', deletedAt: list.deletedAt };
    }
    return { list };
}

function sendLookupError(res, lookup) {
    const body = { error: lookup.error };
    if (lookup.deletedAt) {
        body.deletedAt = lookup.deletedAt;
    }
    return res.status(lookup.status).json(body);
}

// Admin token: from the file in ADMIN_TOKEN_FILE (Docker secret) or from ADMIN_TOKEN.
// Without a token, the admin API does not exist (404).
function loadAdminToken() {
    const file = process.env.ADMIN_TOKEN_FILE;
    if (file) {
        try {
            return fsSync.readFileSync(file, 'utf8').trim() || null;
        } catch (err) {
            console.error(`Cannot read ADMIN_TOKEN_FILE ${file}:`, err.message);
            return null;
        }
    }
    return (process.env.ADMIN_TOKEN || '').trim() || null;
}

const ADMIN_TOKEN = loadAdminToken();

function requireAdmin(req, res, next) {
    if (!ADMIN_TOKEN) {
        return res.status(404).json({ error: 'Not found' });
    }
    const header = req.get('authorization') || '';
    const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
    // Compare hashes: timingSafeEqual needs equal lengths, and the token length does not leak.
    const a = crypto.createHash('sha256').update(supplied).digest();
    const b = crypto.createHash('sha256').update(ADMIN_TOKEN).digest();
    if (!supplied || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Admin token required' });
    }
    next();
}

// API Routes

app.param('listId', (req, res, next, listId) => {
    if (!LIST_ID_PATTERN.test(listId)) {
        return res.status(400).json({ error: 'Invalid list ID' });
    }
    next();
});

// Legacy: favorites of a username from before the no-login model. The client
// calls this once to move them into the device's local "My lists".
// Remove this route together with users.json.
app.get('/api/legacy/favorites/:username', async (req, res) => {
    try {
        const username = req.params.username.toLowerCase();
        const users = await readUsers();
        const user = users[username];

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ favorites: user.favorites || [], displayName: user.displayName || null });
    } catch (error) {
        console.error('Error getting legacy favorites:', error);
        res.status(500).json({ error: 'Failed to get favorites' });
    }
});

// Admin: all lists, including soft-deleted ones
app.get('/api/admin/lists', requireAdmin, async (req, res) => {
    try {
        const data = await readData();
        const lists = Object.entries(data).map(([name, value]) => ({
            name,
            displayName: value.displayName || name,
            creatorName: value.creatorName,
            updatedAt: value.updatedAt,
            deletedAt: value.deletedAt || null,
            itemCount: value.items.length
        }));
        res.json(lists);
    } catch (error) {
        console.error('Error getting lists:', error);
        res.status(500).json({ error: 'Failed to retrieve lists' });
    }
});

// Create a new list
app.post('/api/lists', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { displayName, creatorName } = req.body || {};

            if (!displayName || typeof displayName !== 'string' || displayName.trim() === '') {
                return res.status(400).json({ error: 'Display name is required' });
            }

            if (displayName.length > 20) {
                return res.status(400).json({ error: 'Display name must be 20 characters or less' });
            }

            if (creatorName !== undefined && creatorName !== null &&
                (typeof creatorName !== 'string' || creatorName.length > 32)) {
                return res.status(400).json({ error: 'Creator name must be text of 32 characters or less' });
            }

            const safeName = displayName.trim();
            const data = await readData();

            let listId = generateListId();
            while (data[listId]) {
                listId = generateListId();
            }

            data[listId] = {
                items: [],
                displayName: safeName,
                creatorName: creatorName && creatorName.trim() ? creatorName.trim() : null,
                updatedAt: Date.now()
            };

            await writeData(data);
            res.json({ success: true, listId, displayName: safeName });
        } catch (error) {
            console.error('Error creating list:', error);
            res.status(500).json({ error: 'Failed to create list' });
        }
    });
});

// Get a specific list details
app.get('/api/lists/:listId', async (req, res) => {
    try {
        const { listId } = req.params;
        const data = await readData();
        const lookup = findActiveList(data, listId);

        if (!lookup.list) {
            return sendLookupError(res, lookup);
        }

        res.json({
            name: listId,
            displayName: lookup.list.displayName || listId,
            updatedAt: lookup.list.updatedAt,
            itemCount: lookup.list.items.length
        });
    } catch (error) {
        console.error('Error getting list details:', error);
        res.status(500).json({ error: 'Failed to retrieve list details' });
    }
});

// Soft-delete a list. It stays restorable for DELETE_RETENTION_MS.
app.delete('/api/lists/:listId', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId } = req.params;
            const data = await readData();
            const lookup = findActiveList(data, listId);

            if (!lookup.list) {
                return sendLookupError(res, lookup);
            }

            lookup.list.deletedAt = Date.now();
            await writeData(data);
            res.json({ success: true, deletedAt: lookup.list.deletedAt });
        } catch (error) {
            console.error('Error deleting list:', error);
            res.status(500).json({ error: 'Failed to delete list' });
        }
    });
});

// Restore a soft-deleted list
app.post('/api/lists/:listId/restore', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId } = req.params;
            const data = await readData();
            const list = data[listId];

            if (!list) {
                return res.status(404).json({ error: 'List not found' });
            }

            if (list.deletedAt) {
                delete list.deletedAt;
                list.updatedAt = Date.now();
                await writeData(data);
            }

            res.json({ success: true });
        } catch (error) {
            console.error('Error restoring list:', error);
            res.status(500).json({ error: 'Failed to restore list' });
        }
    });
});

// Get items for a specific list
app.get('/api/items/:listId', async (req, res) => {
    try {
        const { listId } = req.params;
        const data = await readData();
        const lookup = findActiveList(data, listId);

        if (!lookup.list) {
            return sendLookupError(res, lookup);
        }

        res.json(lookup.list.items);
    } catch (error) {
        console.error('Error getting items:', error);
        res.status(500).json({ error: 'Failed to retrieve items' });
    }
});

// Add a single item. The list must exist: this route never creates a list.
app.post('/api/items/:listId', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId } = req.params;
            const incoming = req.body || {};

            const candidate = {
                text: incoming.text,
                amount: incoming.amount,
                completed: !!incoming.completed
            };

            const validation = validateItemData(candidate);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }

            const data = await readData();
            const lookup = findActiveList(data, listId);

            if (!lookup.list) {
                return sendLookupError(res, lookup);
            }

            const authorName = typeof incoming.authorName === 'string' ? incoming.authorName.trim().slice(0, 32) : '';

            const newItem = {
                id: crypto.randomUUID(),
                text: candidate.text.trim(),
                completed: candidate.completed,
                amount: typeof candidate.amount === 'number' ? candidate.amount : 1,
                // addedBy: random device ID, not a person. authorName: optional nickname.
                addedBy: typeof incoming.addedBy === 'string' ? incoming.addedBy.slice(0, 64) : null,
                authorName: authorName || null
            };

            lookup.list.items.push(newItem);
            lookup.list.updatedAt = Date.now();

            await writeData(data);

            res.json({ success: true, item: newItem });
        } catch (error) {
            console.error('Error adding item:', error);
            res.status(500).json({ error: 'Failed to add item' });
        }
    });
});

// Change the amount on the server, so that concurrent taps are never lost.
// The amount never goes below 1.
function amountRoute(delta) {
    return async (req, res) => {
        await dbMutex.run(async () => {
            try {
                const { listId, itemId } = req.params;
                const data = await readData();
                const lookup = findActiveList(data, listId);

                if (!lookup.list) {
                    return sendLookupError(res, lookup);
                }

                const item = lookup.list.items.find(it => String(it.id) === itemId);
                if (!item) {
                    return res.status(404).json({ error: 'Item not found' });
                }

                const current = typeof item.amount === 'number' ? item.amount : 1;
                const next = Math.max(1, current + delta);
                if (next !== current) {
                    item.amount = next;
                    lookup.list.updatedAt = Date.now();
                    await writeData(data);
                }

                res.json({ success: true, item });
            } catch (error) {
                console.error('Error changing amount:', error);
                res.status(500).json({ error: 'Failed to change amount' });
            }
        });
    };
}

app.post('/api/items/:listId/:itemId/increment', amountRoute(1));
app.post('/api/items/:listId/:itemId/decrement', amountRoute(-1));

// Update a single item (text, completed)
app.patch('/api/items/:listId/:itemId', async (req, res) => {
    await dbMutex.run(async () => {
        try {
            const { listId, itemId } = req.params;
            const updates = req.body || {};

            const data = await readData();
            const lookup = findActiveList(data, listId);

            if (!lookup.list) {
                return sendLookupError(res, lookup);
            }

            const list = lookup.list;
            const itemIndex = list.items.findIndex(item => String(item.id) === itemId);
            if (itemIndex === -1) {
                return res.status(404).json({ error: 'Item not found' });
            }

            const sanitizedUpdates = sanitizeUpdates(updates);
            if (sanitizedUpdates.text !== undefined) {
                if (typeof sanitizedUpdates.text !== 'string' || sanitizedUpdates.text.trim() === '' || sanitizedUpdates.text.length > 128) {
                    return res.status(400).json({ error: 'Invalid text for update' });
                }
                sanitizedUpdates.text = sanitizedUpdates.text.trim();
            }

            if (sanitizedUpdates.completed !== undefined) {
                sanitizedUpdates.completed = !!sanitizedUpdates.completed;
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
            const lookup = findActiveList(data, listId);

            if (!lookup.list) {
                return sendLookupError(res, lookup);
            }

            lookup.list.items = [];
            lookup.list.updatedAt = Date.now();
            await writeData(data);

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
            const lookup = findActiveList(data, listId);

            if (!lookup.list) {
                return sendLookupError(res, lookup);
            }

            lookup.list.items = lookup.list.items.filter(item => !item.completed);
            lookup.list.updatedAt = Date.now();

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
            const lookup = findActiveList(data, listId);

            if (!lookup.list) {
                return sendLookupError(res, lookup);
            }

            lookup.list.items = lookup.list.items.filter(item => String(item.id) !== itemId);
            lookup.list.updatedAt = Date.now();

            await writeData(data);

            res.json({ success: true });
        } catch (error) {
            console.error('Error deleting item:', error);
            res.status(500).json({ error: 'Failed to delete item' });
        }
    });
});

// API Root
app.get('/api', (req, res) => {
    res.json({ message: 'Shopping List API is running' });
});

// Unknown API routes answer JSON 404, not the SPA page
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// SPA Fallback: Serve index.html for any unknown routes (non-API)
app.get('*', rateLimiter, (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Remove soft-deleted lists that are older than the retention period
async function purgeDeletedLists() {
    await dbMutex.run(async () => {
        const data = await readData();
        const cutoff = Date.now() - DELETE_RETENTION_MS;
        const expired = Object.keys(data).filter(id => data[id].deletedAt && data[id].deletedAt < cutoff);
        if (expired.length === 0) return;
        for (const id of expired) {
            delete data[id];
        }
        await writeStore(DATA_FILE, data);
        console.log(`Purged ${expired.length} deleted list(s)`);
    });
}

// Initialize and start server
async function startServer() {
    await ensureDataDir();
    await purgeDeletedLists();
    setInterval(() => {
        purgeDeletedLists().catch(err => console.error('Purge failed:', err));
    }, 24 * 60 * 60 * 1000);
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on port ${PORT}${ADMIN_TOKEN ? ' (admin API enabled)' : ''}`);
    });
}

startServer().catch(console.error);
