const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'lists.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Helper to read data
function readData() {
    if (!fs.existsSync(DATA_FILE)) {
        return {};
    }
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Error reading data file:', err);
        return {};
    }
}

// Helper to write data
function writeData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error writing data file:', err);
    }
}

// API Routes

// Get items for a specific list
app.get('/api/items/:listId', (req, res) => {
    const { listId } = req.params;
    const data = readData();
    const items = data[listId] || [];
    res.json(items);
});

// Save items for a specific list
app.post('/api/items/:listId', (req, res) => {
    const { listId } = req.params;
    const items = req.body;

    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid data format. Expected an array of items.' });
    }

    const data = readData();
    data[listId] = items;
    writeData(data);

    res.json({ success: true, count: items.length });
});

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
