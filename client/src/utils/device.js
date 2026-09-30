// Everything that identifies this device lives here, in localStorage.
// There are no accounts: a list link gives access, and "My lists" is local to the device.

const KEYS = {
    deviceId: 'deviceId',
    nickname: 'displayName',
    nicknameAsked: 'nicknameAsked',
    myLists: 'myLists',
    legacyUsername: 'username',
    adminToken: 'adminToken'
};

function readJson(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch {
        return fallback;
    }
}

// crypto.getRandomValues also works on plain http (LAN), where crypto.randomUUID does not.
function randomId() {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function getDeviceId() {
    let id = localStorage.getItem(KEYS.deviceId);
    if (!id) {
        id = randomId();
        localStorage.setItem(KEYS.deviceId, id);
    }
    return id;
}

export function getNickname() {
    return localStorage.getItem(KEYS.nickname) || '';
}

export function setNickname(name) {
    const clean = (name || '').trim().slice(0, 32);
    if (clean) localStorage.setItem(KEYS.nickname, clean);
    else localStorage.removeItem(KEYS.nickname);
    localStorage.setItem(KEYS.nicknameAsked, '1');
    window.dispatchEvent(new Event('nicknameChanged'));
    return clean;
}

// True once the user saved or skipped the nickname prompt
export function wasNicknameAsked() {
    return !!localStorage.getItem(KEYS.nicknameAsked) || !!getNickname();
}

// "My lists": [{ id, name, addedAt }], newest first
export function getMyLists() {
    const lists = readJson(KEYS.myLists, []);
    return Array.isArray(lists) ? lists.filter(l => l && typeof l.id === 'string') : [];
}

function saveMyLists(lists) {
    localStorage.setItem(KEYS.myLists, JSON.stringify(lists));
    window.dispatchEvent(new Event('myListsChanged'));
}

// Add a list, or update its name. An existing entry keeps its position.
export function addMyList(id, name) {
    if (!id) return;
    const lists = getMyLists();
    const existing = lists.find(l => l.id === id);
    if (existing) {
        if (name && existing.name !== name) {
            existing.name = name;
            saveMyLists(lists);
        }
        return;
    }
    saveMyLists([{ id, name: name || '', addedAt: Date.now() }, ...lists]);
}

// Remove a list from this device. Returns the entry and its index, for undo.
export function removeMyList(id) {
    const lists = getMyLists();
    const index = lists.findIndex(l => l.id === id);
    if (index === -1) return null;
    const [entry] = lists.splice(index, 1);
    saveMyLists(lists);
    return { entry, index };
}

export function restoreMyList(removed) {
    if (!removed) return;
    const lists = getMyLists().filter(l => l.id !== removed.entry.id);
    lists.splice(Math.min(removed.index, lists.length), 0, removed.entry);
    saveMyLists(lists);
}

export function getMyListName(id) {
    const entry = getMyLists().find(l => l.id === id);
    return entry ? entry.name : '';
}

// One-time import from the old username model: server favorites become local
// "My lists", and the old display name becomes the nickname.
export async function migrateLegacyProfile() {
    const username = localStorage.getItem(KEYS.legacyUsername);
    if (!username) return;
    try {
        // The app waits for this import, so never let it hang
        const res = await fetch(`/api/legacy/favorites/${encodeURIComponent(username)}`, {
            signal: AbortSignal.timeout(5000)
        });
        if (res.ok) {
            const { favorites, displayName } = await res.json();
            // Add oldest first, so the first favorite ends up on top
            [...(favorites || [])].reverse().forEach(id => addMyList(id, ''));
            if (!getNickname() && displayName) setNickname(displayName);
        } else if (res.status !== 404) {
            return; // Server problem: keep the username and try again next time
        }
        localStorage.removeItem(KEYS.legacyUsername);
        localStorage.removeItem('currentListId');
        localStorage.removeItem('currentListName');
    } catch {
        // Offline: try again on the next load
    }
}

// The admin token is kept for this browser tab only
export function getAdminToken() {
    return sessionStorage.getItem(KEYS.adminToken) || '';
}

export function setAdminToken(token) {
    if (token) sessionStorage.setItem(KEYS.adminToken, token);
    else sessionStorage.removeItem(KEYS.adminToken);
}
