import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import ListItem from '../components/ListItem';
import { Plus } from 'lucide-react';
import DashboardItem from '../components/DashboardItem';
import { processSlashCommand } from '../utils/slashCommands';
import {
    getDeviceId, getNickname, setNickname, wasNicknameAsked,
    getMyLists, addMyList, getAdminToken, setAdminToken
} from '../utils/device';
import { shareList, removeListFromDevice, deleteListForEveryone } from '../utils/listActions';


const API_URL = '/api/items';

const sectionTitleStyle = { fontSize: '1rem', marginBottom: '12px', color: 'var(--text-primary)', fontWeight: '600' };

export default function Home() {
    // 1. State Hooks
    const [items, setItems] = useState([]);
    const [inputText, setInputText] = useState('');
    const location = useLocation();
    const configMode = location.pathname === '/config-lists' ? 'lists' : null;
    const [sortDirection, setSortDirection] = useState(null);
    const [dashboardLists, setDashboardLists] = useState([]);
    const [newListName, setNewListName] = useState('');
    const [listError, setListError] = useState(null);
    const [adminNeeded, setAdminNeeded] = useState(false);
    const [adminInput, setAdminInput] = useState('');
    const [askNickname, setAskNickname] = useState(() => !wasNicknameAsked());
    const [nicknameInput, setNicknameInput] = useState('');

    // 2. Router/Context Hooks
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    // 3. Derived State / Constants
    const listId = configMode ? null : searchParams.get('list');

    // 4. Core Logic Helpers

    // Dashboard: the lists on this device, with name and item count from the server
    const loadDashboard = useCallback(async () => {
        const local = getMyLists();
        const lists = await Promise.all(local.map(async entry => {
            try {
                const r = await fetch(`/api/lists/${encodeURIComponent(entry.id)}`);
                if (r.ok) {
                    const details = await r.json();
                    if (details.displayName && details.displayName !== entry.name) {
                        addMyList(entry.id, details.displayName);
                    }
                    return { ...details, status: 'active' };
                }
                return {
                    name: entry.id,
                    displayName: entry.name || 'Unknown List',
                    itemCount: 0,
                    status: r.status === 410 ? 'deleted' : 'missing'
                };
            } catch {
                return { name: entry.id, displayName: entry.name || 'Unknown List', itemCount: 0, status: 'offline' };
            }
        }));
        setDashboardLists(lists);
    }, []);

    const loadAdminLists = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/lists?t=${Date.now()}`, {
                headers: { Authorization: `Bearer ${getAdminToken()}` }
            });
            if (res.status === 401 || res.status === 404) {
                setAdminNeeded(res.status === 401);
                setListError(res.status === 404 ? 'Admin mode is not enabled on this server' : null);
                setItems([]);
                return;
            }
            if (res.ok) {
                const data = await res.json();
                setAdminNeeded(false);
                setListError(null);
                setItems(data.map(l => ({
                    id: l.name,
                    text: l.displayName || l.name,
                    completed: false,
                    amount: l.itemCount,
                    creatorName: l.creatorName,
                    updatedAt: l.updatedAt,
                    deletedAt: l.deletedAt
                })));
            }
        } catch (e) { console.error(e); }
    }, []);

    const loadItems = useCallback(async () => {
        if (configMode === 'lists') {
            await loadAdminLists();
            return;
        }

        if (!listId) {
            await loadDashboard();
            return;
        }

        try {
            const [itemsRes, listRes] = await Promise.all([
                fetch(`${API_URL}/${encodeURIComponent(listId)}?t=${Date.now()}`),
                fetch(`/api/lists/${encodeURIComponent(listId)}?t=${Date.now()}`)
            ]);

            if (listRes.ok) {
                const listData = await listRes.json();
                // Opening a list link adds the list to this device
                addMyList(listId, listData.displayName);
            }

            if (itemsRes.ok) {
                const data = await itemsRes.json();
                setItems(prev => {
                    const isDiff = JSON.stringify(prev) !== JSON.stringify(data);
                    return isDiff ? data : prev;
                });
                setListError(null);
            } else {
                setItems([]);
                setListError(itemsRes.status === 410 ? 'deleted' : 'List not found');
            }
        } catch (e) {
            console.error(e);
            setListError('Error loading list');
        }
    }, [listId, configMode, loadDashboard, loadAdminLists]);

    // 5. Slash Command Helpers
    const handleClearList = async () => {
        if (!listId) return;
        if (!window.confirm('Delete all items in this list?')) return;
        await fetch(`${API_URL}/${encodeURIComponent(listId)}`, { method: 'DELETE' });
        loadItems();
        showToast('List cleared', 'success');
    };

    const slashCommandContext = {
        clearCache: handleClearList,
        showToast
    };

    // 6. Effects
    useEffect(() => {
        const handleChange = () => { if (!listId && !configMode) loadDashboard(); };
        window.addEventListener('myListsChanged', handleChange);
        return () => window.removeEventListener('myListsChanged', handleChange);
    }, [listId, configMode, loadDashboard]);

    useEffect(() => {
        loadItems();

        // After a reconnect, reload to get the changes that were missed while offline.
        let hasConnected = false;
        let eventSource;
        let retryTimer;
        let retryDelay = 1000;
        let stopped = false;

        const connect = () => {
            eventSource = new EventSource('/api/events');
            eventSource.onmessage = (e) => {
                const data = JSON.parse(e.data);
                const isReconnect = data.type === 'connected' && hasConnected;
                if (data.type === 'connected') {
                    hasConnected = true;
                    retryDelay = 1000;
                }
                if (data.type === 'update' || isReconnect) {
                    loadItems();
                }
            };
            // The browser retries only network errors. An HTTP error, such as a 502 from
            // the reverse proxy during a deploy or a 429, closes the stream for good.
            eventSource.onerror = () => {
                if (stopped || eventSource.readyState !== EventSource.CLOSED) return;
                retryTimer = setTimeout(connect, retryDelay);
                retryDelay = Math.min(retryDelay * 2, 30000);
            };
        };
        connect();

        return () => {
            stopped = true;
            clearTimeout(retryTimer);
            eventSource.close();
        };
    }, [loadItems]);


    // 7. Handlers
    const handleCreateNewList = async () => {
        const name = newListName.trim();
        if (!name) return;
        try {
            const res = await fetch('/api/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ displayName: name, creatorName: getNickname() || null })
            });
            if (res.ok) {
                const data = await res.json();
                addMyList(data.listId, data.displayName);
                setNewListName('');
                navigate(`/?list=${encodeURIComponent(data.listId)}`);
            } else {
                const data = await res.json().catch(() => ({}));
                showToast(data.error || 'Error creating list', 'error');
            }
        } catch { showToast('Error creating list', 'error'); }
    };

    const handleSaveNickname = (skip) => {
        setNickname(skip ? '' : nicknameInput);
        setAskNickname(false);
    };

    const handleAdminLogin = (e) => {
        e.preventDefault();
        setAdminToken(adminInput.trim());
        setAdminInput('');
        loadAdminLists();
    };

    const handleRestoreList = async () => {
        try {
            const res = await fetch(`/api/lists/${encodeURIComponent(listId)}/restore`, { method: 'POST' });
            if (!res.ok) throw new Error(res.statusText);
            showToast('List restored', 'success');
            loadItems();
        } catch { showToast('Failed to restore list', 'error'); }
    };

    const handleAddItem = async () => {
        const text = inputText.trim();
        if (!text) return;

        if (text.startsWith('/')) {
            const handled = await processSlashCommand(text, navigate, slashCommandContext);
            if (handled) {
                setInputText('');
                return;
            }
        }

        if (configMode === 'lists') {
            try {
                const res = await fetch('/api/lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: text, creatorName: getNickname() || null })
                });
                if (res.ok) {
                    showToast(`List "${text}" created`, 'success');
                    loadItems();
                    setInputText('');
                }
            } catch { showToast('Error creating list', 'error'); }
            return;
        }

        const existing = items.find(i => i.text.toLowerCase() === text.toLowerCase());
        if (existing) {
            handleIncrement(existing.id);
            setInputText('');
            return;
        }

        try {
            const res = await fetch(`${API_URL}/${encodeURIComponent(listId)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    addedBy: getDeviceId(),
                    authorName: getNickname() || null
                })
            });
            if (res.ok) {
                loadItems();
                setInputText('');
            } else {
                const data = await res.json().catch(() => ({}));
                showToast(data.error || 'Failed to add item', 'error');
            }
        } catch { showToast('Failed to add item', 'error'); }
    };

    const itemUrl = (id) => `${API_URL}/${encodeURIComponent(listId)}/${encodeURIComponent(id)}`;

    const handleToggle = async (id) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        try {
            await fetch(itemUrl(id), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: !item.completed })
            });
            loadItems();
        } catch { /* The next SSE update shows the real state */ }
    };

    // The server changes the amount, so taps from two people at once both count
    const handleIncrement = async (id) => {
        try {
            await fetch(`${itemUrl(id)}/increment`, { method: 'POST' });
            loadItems();
        } catch { /* The next SSE update shows the real state */ }
    };

    const handleDecrement = async (id) => {
        const item = items.find(i => i.id === id);
        if (!item || (item.amount || 1) <= 1) return;
        try {
            await fetch(`${itemUrl(id)}/decrement`, { method: 'POST' });
            loadItems();
        } catch { /* The next SSE update shows the real state */ }
    };

    const handleDelete = async (id) => {
        if (configMode === 'lists') {
            const list = items.find(i => i.id === id);
            if (list && list.deletedAt) return;
            if (await deleteListForEveryone(id, list ? list.text : '', showToast)) loadItems();
            return;
        }

        await fetch(itemUrl(id), { method: 'DELETE' });
        loadItems();
    };

    const handleDeleteCompleted = async () => {
        await fetch(`${API_URL}/${encodeURIComponent(listId)}/completed`, { method: 'DELETE' });
        loadItems();
    };


    const sortItems = () => {
        if (!sortDirection) return items;
        return [...items].sort((a, b) => {
            const tA = a.text.toLowerCase();
            const tB = b.text.toLowerCase();
            return sortDirection === 'asc' ? tA.localeCompare(tB) : tB.localeCompare(tA);
        });
    };

    const filteredItems = sortItems();
    const hasCompleted = items.some(i => i.completed);

    // 8. Render
    return (
        <>
            {/* Dashboard View (No List ID and not config) */}
            {!listId && !configMode && (
                <div style={{ width: '100%', padding: '0 4px' }}>
                    {/* Create List Section */}
                    <div style={{ marginTop: '20px', marginBottom: '32px' }}>
                        <h3 style={sectionTitleStyle}>Create New List</h3>
                        <div className="input-wrapper" style={{ marginBottom: 0 }}>
                            <input
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                        if (newListName.startsWith('/')) {
                                            const handled = await processSlashCommand(newListName, navigate, slashCommandContext);
                                            if (handled) {
                                                setNewListName('');
                                                return;
                                            }
                                        }
                                        handleCreateNewList();
                                    }
                                }}
                                placeholder="Create a new list ..."
                                autoComplete="off"
                                maxLength={20}
                            />
                            <button
                                onClick={handleCreateNewList}
                                className="btn-primary"
                                aria-label="Create list"
                            >
                                <Plus size={24} />
                            </button>
                        </div>
                    </div>

                    {/* My Lists Section */}
                    <div style={{ marginTop: '20px' }}>
                        <h3 style={sectionTitleStyle}>Your lists</h3>
                        {dashboardLists.length === 0 ? (
                            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', opacity: 0.7 }}>
                                Create your first list, or open a list link somebody shared with you.
                            </p>
                        ) : (
                            <ul className="shopping-list">
                                {dashboardLists.map(list => (
                                    <DashboardItem
                                        key={list.name}
                                        list={list}
                                        onOpen={(l) => navigate(`/?list=${encodeURIComponent(l.name)}`)}
                                        onShare={(id) => shareList(id, list.displayName, showToast)}
                                        onRemove={(id) => removeListFromDevice(id, showToast)}
                                    />
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}

            {/* List View (If listId exists) OR Config Mode */}
            {(listId || configMode) && (
                <>
                    {/* Nickname prompt: once per device, optional */}
                    {listId && !listError && askNickname && (
                        <section className="input-area" style={{ marginBottom: '12px' }}>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                                Your name, shown next to the items you add (optional)
                            </p>
                            <div className="input-wrapper" style={{ marginBottom: 0 }}>
                                <input
                                    type="text"
                                    id="nickname-input"
                                    value={nicknameInput}
                                    onChange={(e) => setNicknameInput(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveNickname(false)}
                                    placeholder="e.g., John D."
                                    maxLength={32}
                                    autoComplete="off"
                                />
                                <button onClick={() => handleSaveNickname(false)} className="sort-btn" style={{ width: 'auto', padding: '0 12px' }}>
                                    Save
                                </button>
                                <button onClick={() => handleSaveNickname(true)} className="sort-btn" style={{ width: 'auto', padding: '0 12px' }}>
                                    Skip
                                </button>
                            </div>
                        </section>
                    )}

                    {/* Admin token prompt for config mode */}
                    {configMode && adminNeeded && (
                        <form onSubmit={handleAdminLogin} className="input-area">
                            <div className="input-wrapper">
                                <input
                                    type="password"
                                    value={adminInput}
                                    onChange={(e) => setAdminInput(e.target.value)}
                                    placeholder="Admin token"
                                    autoComplete="off"
                                />
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    style={{ width: 'auto', padding: '0 16px', fontWeight: '600', fontSize: '1rem' }}
                                >
                                    Login
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Input Area */}
                    {!listError && !adminNeeded && (
                        <section className="input-area">
                            <div className="input-wrapper">
                                <input
                                    type="text"
                                    id="item-input"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                                    placeholder={configMode === 'lists' ? "Add new list..." : "Add a new item..."}
                                    autoComplete="off"
                                />
                                <button
                                    id="add-btn"
                                    onClick={handleAddItem}
                                    aria-label="Add item"
                                >
                                    <Plus size={24} strokeWidth={2} />
                                </button>

                            </div>
                        </section>
                    )}

                    {/* List Area */}
                    <section className="list-area">
                        {listError ? (
                            <div id="empty-state" className="empty-state">
                                <p style={{ color: '#ef4444', marginBottom: '1rem' }}>
                                    {listError === 'deleted' ? 'This list was deleted. You can restore it for 30 days.' : listError}
                                </p>
                                {listError === 'deleted' && (
                                    <button
                                        className="btn-primary"
                                        onClick={handleRestoreList}
                                        style={{ width: 'auto', padding: '8px 16px', marginBottom: '12px' }}
                                    >
                                        Restore list
                                    </button>
                                )}
                                <button
                                    className="btn-primary"
                                    onClick={() => navigate('/')}
                                    style={{ width: 'auto', padding: '8px 16px' }}
                                >
                                    Go to Dashboard
                                </button>
                            </div>
                        ) : adminNeeded ? null : filteredItems.length === 0 ? (
                            <div id="empty-state" className="empty-state">
                                <p>{configMode ? 'No items found' : 'Your list is empty'}</p>
                            </div>
                        ) : (
                            <ul id="shopping-list" className="shopping-list">
                                {filteredItems.map(item => (
                                    <ListItem
                                        key={item.id}
                                        item={item}
                                        configMode={configMode}
                                        onToggle={handleToggle}
                                        onIncrement={handleIncrement}
                                        onDecrement={handleDecrement}
                                        onDelete={handleDelete}
                                        onOpenList={(item) => navigate(`/?list=${encodeURIComponent(item.id)}`)}
                                    />
                                ))}
                            </ul>
                        )}


                    </section>

                    {/* List Controls */}
                    {!configMode && listId && items.length > 0 && (
                        <div id="list-controls" className="list-controls">
                            <div className="sort-controls">
                                <button onClick={() => setSortDirection('asc')} className="sort-btn">
                                    A-Z
                                </button>
                                <button onClick={() => setSortDirection('desc')} className="sort-btn">
                                    Z-A
                                </button>
                            </div>

                            {hasCompleted && (
                                <button
                                    id="delete-completed-btn"
                                    onClick={handleDeleteCompleted}
                                >
                                    Delete completed
                                </button>
                            )}
                        </div>
                    )}

                    {!configMode && filteredItems.length > 0 && (
                        <div style={{ textAlign: 'center', marginTop: '24px', marginBottom: '24px', color: 'var(--text-secondary)', fontSize: '1.0rem', fontStyle: 'italic', opacity: 0.8 }}>
                            Happy shopping
                        </div>
                    )}
                </>
            )
            }
        </>
    );
}
