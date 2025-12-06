
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import ListItem from '../components/ListItem';
import { Plus, Star } from 'lucide-react';

const API_URL = '/api/items';

export default function Home() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const [configMode, setConfigMode] = useState(null);
    const [sortDirection, setSortDirection] = useState(null);

    const [previousListId, setPreviousListId] = useState(null);
    const [previousListName, setPreviousListName] = useState(null);

    const [isFavorite, setIsFavorite] = useState(false);

    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const getListId = useCallback(() => {
        const urlList = searchParams.get('list');
        if (urlList) return urlList;
        return localStorage.getItem('currentListId') || 'default';
    }, [searchParams]);

    const listId = configMode === 'lists' || configMode === 'users' ? null : getListId();
    const user = localStorage.getItem('username');

    useEffect(() => {
        const urlList = searchParams.get('list');
        const urlUser = searchParams.get('user');

        if (urlList) localStorage.setItem('currentListId', urlList);
        if (urlUser) localStorage.setItem('username', urlUser);

        if (urlList || urlUser) setSearchParams({});
    }, [searchParams, setSearchParams]);

    const loadItems = useCallback(async () => {
        // ... same logic as before, omitting to save space if logic matches, but writing full file so:

        if (configMode === 'lists') {
            try {
                const res = await fetch(`/api/lists?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    const mapped = data.map(l => ({
                        id: l.name,
                        text: l.displayName || l.name,
                        completed: false,
                        amount: l.itemCount,
                        creatorName: l.creatorName,
                        updatedAt: l.updatedAt
                    }));
                    setItems(mapped);
                }
            } catch (e) { console.error(e); }
            return;
        }

        if (configMode === 'users') {
            try {
                const res = await fetch(`/api/users?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    const mapped = data.map(u => ({
                        id: u.name,
                        text: `${u.name} / ${u.displayName || u.name}`,
                        updatedAt: u.lastSeen,
                        completed: false
                    }));
                    setItems(mapped);
                }
            } catch (e) { console.error(e); }
            return;
        }

        const currentId = getListId();
        try {
            const res = await fetch(`${API_URL}/${currentId}`);
            if (res.ok) {
                const data = await res.json();
                setItems(prev => {
                    const isDiff = JSON.stringify(prev) !== JSON.stringify(data);
                    return isDiff ? data : prev;
                });
                checkFavoriteStatus(currentId);
            }
        } catch (e) { console.error(e); }
    }, [getListId, configMode]);

    useEffect(() => {
        loadItems();
        setLoading(false);

        const eventSource = new EventSource('/api/events');
        eventSource.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'update') loadItems();
        };
        eventSource.onerror = () => eventSource.close();
        return () => eventSource.close();
    }, [loadItems]);

    const checkFavoriteStatus = async (lid) => {
        if (!user) {
            setIsFavorite(false);
            return;
        }
        try {
            const res = await fetch(`/api/favorites/${user}`);
            if (res.ok) {
                const favs = await res.json();
                setIsFavorite(favs.includes(lid));
            }
        } catch (e) { }
    };

    const handleToggleFavorite = async () => {
        if (!user) return;
        const currentId = getListId();
        try {
            const res = await fetch(`/api/favorites/${user}/${currentId}`, { method: 'POST' });
            if (res.ok) {
                const data = await res.json();
                const newStatus = data.favorites.includes(currentId);
                setIsFavorite(newStatus);
                showToast(newStatus ? 'List added to favorites' : 'List removed from favorites', 'success');
            }
        } catch (e) {
            showToast('Failed to toggle favorite', 'error');
        }
    };

    const handleAddItem = async () => {
        const text = inputText.trim();
        if (!text) return;

        if (text.startsWith('/')) {
            if (text === '/clear-cache') {
                await handleClearList();
                setInputText('');
                return;
            } else if (text === '/config-lists') {
                const currentId = getListId();
                setPreviousListId(currentId);
                setPreviousListName(localStorage.getItem('currentListName') || currentId);
                setConfigMode('lists');
                setInputText('');
                loadItems();
                return;
            } else if (text === '/config-users') {
                const currentId = getListId();
                setPreviousListId(currentId);
                setPreviousListName(localStorage.getItem('currentListName') || currentId);
                setConfigMode('users');
                setInputText('');
                loadItems();
                return;
            } else {
                showToast('Unknown command', 'error');
                return;
            }
        }

        if (configMode === 'lists') {
            const displayName = localStorage.getItem('displayName') || user;
            try {
                const res = await fetch('/api/lists', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ displayName: text, createdBy: user, creatorName: displayName })
                });
                if (res.ok) {
                    showToast(`List "${text}" created`, 'success');
                    loadItems();
                    setInputText('');
                }
            } catch (e) { showToast('Error creating list', 'error'); }
            return;
        }

        const existing = items.find(i => i.text.toLowerCase() === text.toLowerCase());
        if (existing) {
            handleIncrement(existing.id);
            setInputText('');
            return;
        }

        const currentId = getListId();
        const displayName = localStorage.getItem('displayName') || user;

        try {
            const res = await fetch(`${API_URL}/${currentId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    addedBy: user,
                    authorName: displayName,
                    displayName: localStorage.getItem('currentListName')
                })
            });
            if (res.ok) {
                loadItems();
                setInputText('');
            }
        } catch (e) { showToast('Failed to add item', 'error'); }
    };

    const handleToggle = async (id) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        try {
            await fetch(`${API_URL}/${getListId()}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ completed: !item.completed })
            });
            loadItems();
        } catch (e) { }
    };

    const handleIncrement = async (id) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        try {
            await fetch(`${API_URL}/${getListId()}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: (item.amount || 1) + 1 })
            });
            loadItems();
        } catch (e) { }
    };

    const handleDecrement = async (id) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        if ((item.amount || 1) <= 1) return;
        try {
            await fetch(`${API_URL}/${getListId()}/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount: (item.amount || 1) - 1 })
            });
            loadItems();
        } catch (e) { }
    };

    const handleDelete = async (id) => {
        if (configMode === 'lists') {
            if (!confirm('This cannot be undone. Delete list?')) return;
            try {
                await fetch(`/api/lists/${id}`, { method: 'DELETE' });
                showToast('List deleted', 'success');
                loadItems();
            } catch (e) { showToast('Error deleting list', 'error'); }
            return;
        } else if (configMode === 'users') {
            if (!confirm('Delete user?')) return;
            try {
                await fetch(`/api/users/${id}`, { method: 'DELETE' });
                showToast('User deleted', 'success');
                loadItems();
            } catch (e) { showToast('Error deleting user', 'error'); }
            return;
        }

        await fetch(`${API_URL}/${getListId()}/${id}`, { method: 'DELETE' });
        loadItems();
    };

    const handleDeleteCompleted = async () => {
        await fetch(`${API_URL}/${getListId()}/completed`, { method: 'DELETE' });
        loadItems();
    };

    const handleClearList = async () => {
        await fetch(`${API_URL}/${getListId()}`, { method: 'DELETE' });
        loadItems();
        showToast('List cleared', 'success');
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

    return (
        <>
            {configMode && (
                <div className="text-center mb-4 text-accent font-medium">
                    {configMode === 'lists' ? 'Configuration: Manage Lists' : 'Configuration: Manage Users'}
                </div>
            )}
            {!configMode && user && (
                <div className="flex justify-end mb-2 px-1">
                    <button onClick={handleToggleFavorite} className={`icon-btn ${isFavorite ? 'text-yellow-400' : ''}`} style={{ marginBottom: 0 }}>
                        <Star size={24} fill={isFavorite ? "currentColor" : "none"} />
                    </button>
                </div>
            )}

            {/* Input Area */}
            <section className="input-area">
                <div className="input-wrapper">
                    <input
                        type="text"
                        id="item-input"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                        placeholder={configMode === 'lists' ? "Add new list..." : configMode === 'users' ? "Search users..." : "Add a new item..."}
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

            {/* List Area */}
            <section className="list-area">
                {filteredItems.length === 0 ? (
                    <div id="empty-state" className="empty-state">
                        <p>{configMode ? 'No items found' : 'Your list is empty.'}</p>
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
                                onOpenList={(item) => {
                                    localStorage.setItem('currentListId', item.id);
                                    localStorage.setItem('currentListName', item.text);
                                    setConfigMode(null);
                                    setPreviousListId(null);
                                    navigate('/');
                                    window.location.reload();
                                }}
                            />
                        ))}
                    </ul>
                )}

                {configMode && (
                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={() => {
                                setConfigMode(null);
                                localStorage.setItem('currentListId', previousListId || 'default');
                                window.location.reload();
                            }}
                            className="btn-primary w-full"
                            style={{ width: '100%', borderRadius: '4px' }}
                        >
                            Return to {previousListName || 'List'}
                        </button>
                    </div>
                )}

                {!configMode && items.length > 0 && (
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
            </section>
        </>
    );
}
