
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import ListItem from '../components/ListItem';
import { Plus, Star, ArrowRight } from 'lucide-react';
import DashboardItem from '../components/DashboardItem';


const API_URL = '/api/items';

export default function Home() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const location = useLocation();
    const [configMode, setConfigMode] = useState(() => {
        if (location.pathname === '/config-lists') return 'lists';
        if (location.pathname === '/config-users') return 'users';
        return null;
    });

    useEffect(() => {
        if (location.pathname === '/config-lists') setConfigMode('lists');
        else if (location.pathname === '/config-users') setConfigMode('users');
        else setConfigMode(null);
    }, [location.pathname]);
    const [sortDirection, setSortDirection] = useState(null);

    const [previousListId, setPreviousListId] = useState(null);
    const [previousListName, setPreviousListName] = useState(null);

    const [isFavorite, setIsFavorite] = useState(false);

    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const getListId = useCallback(() => {
        return searchParams.get('list');
    }, [searchParams]);

    const listId = configMode === 'lists' || configMode === 'users' ? null : getListId();
    const user = localStorage.getItem('username');

    useEffect(() => {
        const urlList = searchParams.get('list');
        const urlUser = searchParams.get('user');

        if (urlList) localStorage.setItem('currentListId', urlList);
        if (urlUser) localStorage.setItem('username', urlUser);

        // DO NOT clear searchParams for list, we need it to stay on the URL
        if (urlUser) setSearchParams({ list: urlList });

        if (!urlList && !configMode && user) {
            loadFavorites(user);
        }
    }, [searchParams, setSearchParams, configMode, user]);

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
        if (!currentId) {
            setLoading(false);
            return;
        }

        try {
            const res = await fetch(`${API_URL}/${currentId}`);
            if (res.ok) {
                const data = await res.json();
                setItems(prev => {
                    const isDiff = JSON.stringify(prev) !== JSON.stringify(data);
                    return isDiff ? data : prev;
                });
                // Update local storage name for Header access? 
                // Better: Update state or rely on App.jsx fetching it?
                // For now, let's set it in localStorage so App header might ensure it's synced if it reads it.
                if (data.length > 0 && data[0].displayName) { // This logic assumes list items carry list metadata? NO.
                    // The API returns items. It does NOT return list metadata in this endpoint usually?
                    // Wait, checking server.js... GET /api/items/:listId returns items array.
                    // It does NOT return list name. 
                    // The list name is usually embedded in items? 
                    // server.js: 
                    // app.get('/api/items/:listId', ...) -> returns FilteredItems.
                    // Item has `listId` but maybe not name.
                    // So how did we get list name before? 
                    // input text was list name in create.
                    // When opening list, we set currentListName.
                }
                checkFavoriteStatus(currentId);
            }
        } catch (e) { console.error(e); }
    }, [getListId, configMode]);

    const [favorites, setFavorites] = useState([]);
    const [newListName, setNewListName] = useState('');

    const loadFavorites = useCallback(async (u) => {
        if (!u) return;
        try {
            const res = await fetch(`/api/favorites/${u}`);
            if (res.ok) {
                const favIds = await res.json();
                const listPromises = favIds.map(id => fetch(`/api/lists/${id}`)
                    .then(r => r.ok ? r.json() : { name: id, displayName: 'Unknown List', itemCount: 0, isDeleted: true })
                    .catch(() => ({ name: id, displayName: 'Error', itemCount: 0, isDeleted: true }))
                );
                const lists = await Promise.all(listPromises);
                setFavorites(lists);
            }
        } catch (e) { console.error(e); }
    }, []);

    const handleCreateNewList = async () => {
        if (!newListName.trim()) return;
        if (!user) { showToast('Please login first', 'error'); return; }
        try {
            // Create List
            const res = await fetch('/api/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: newListName,
                    createdBy: user,
                    creatorName: localStorage.getItem('displayName') || user
                })
            });
            if (res.ok) {
                const data = await res.json();
                // Auto-favorite
                await fetch(`/api/favorites/${user}/${data.listId}`, { method: 'POST' });
                setNewListName('');
                // Navigate to list
                localStorage.setItem('currentListName', newListName); // Store for header
                navigate(`/?list=${data.listId}`);
            }
        } catch (e) { showToast('Error creating list', 'error'); }
    };

    // Toggle Fav from Dashboard
    const toggleFavDashboard = async (lid) => {
        try {
            await fetch(`/api/favorites/${user}/${lid}`, { method: 'POST' });
            loadFavorites(user);
        } catch (e) { }
    };

    const deleteListDashboard = async (lid) => {
        try {
            await fetch(`/api/lists/${lid}`, { method: 'DELETE' });
            loadFavorites(user);
            showToast('List deleted', 'success');
        } catch (e) { }
    };

    const handleShareList = async (listId) => {
        const shareUrl = `${window.location.origin}/?list=${listId}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `Shopping List`, // access name if possible, or just generic
                    url: shareUrl
                });
            } catch (err) {
                if (err.name !== 'AbortError') console.error(err);
            }
        } else {
            try {
                await navigator.clipboard.writeText(shareUrl);
                showToast('Link copied to clipboard', 'success');
            } catch (e) { showToast('Failed to copy', 'error'); }
        }
    };

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
                navigate('/config-lists'); // Update URL to trigger App header and Home useEffect
                setInputText('');
                return;
            } else if (text === '/config-users') {
                const currentId = getListId();
                setPreviousListId(currentId);
                setPreviousListName(localStorage.getItem('currentListName') || currentId);
                navigate('/config-users'); // Update URL
                setInputText('');
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
            try {
                const res = await fetch(`/api/lists/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error(res.statusText);
                showToast('List deleted successfully', 'success');
                loadItems();
            } catch (e) {
                console.error(e);
                showToast('Error deleting list', 'error');
            }
            return;
        } else if (configMode === 'users') {
            try {
                const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
                if (!res.ok) throw new Error(res.statusText);
                showToast('User deleted successfully', 'success');
                loadItems();
            } catch (e) {
                console.error(e);
                showToast('Error deleting user', 'error');
            }
            return;
        }

        // Normal item deletion
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
            {/* Dashboard View (No List ID and not config) */}
            {!listId && !configMode && (
                <div style={{ width: '100%', padding: '0 4px' }}>
                    {/* Create List Section */}
                    <div style={{ marginTop: '20px', marginBottom: '32px' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>Create New List</h3>
                        <div className="input-wrapper" style={{ marginBottom: 0 }}>
                            <input
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateNewList()}
                                placeholder="Create a new list ..."
                                autoComplete="off"
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

                    {/* Favorites Section */}
                    <div style={{ marginTop: '20px' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: 'var(--text-primary)', fontWeight: '600' }}>Your lists</h3>
                        {(!favorites || favorites.length === 0) ? (
                            <p style={{ color: 'var(--text-secondary)', fontStyle: 'italic', opacity: 0.7 }}>Create your first list</p>
                        ) : (
                            <ul className="shopping-list">
                                {favorites.map(list => (
                                    <DashboardItem
                                        key={list.name}
                                        list={list}
                                        onOpen={(l) => {
                                            localStorage.setItem('currentListName', l.displayName || l.name);
                                            navigate(`/?list=${l.name}`);
                                        }}
                                        onShare={handleShareList}
                                        onToggleFav={toggleFavDashboard}
                                        onDelete={deleteListDashboard}
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
                                        onOpenList={(item) => {
                                            localStorage.setItem('currentListId', item.id);
                                            localStorage.setItem('currentListName', item.text);
                                            setConfigMode(null);
                                            setPreviousListId(null);
                                            navigate(`/?list=${item.id}`);
                                        }}
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
