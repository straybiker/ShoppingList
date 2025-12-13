import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import ListItem from '../components/ListItem';
import { Plus, Star, ArrowRight, ChevronLeft } from 'lucide-react';
import DashboardItem from '../components/DashboardItem';
import { processSlashCommand } from '../utils/slashCommands';


const API_URL = '/api/items';

export default function Home() {
    // 1. State Hooks
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const location = useLocation();
    const [configMode, setConfigMode] = useState(() => {
        if (location.pathname === '/config-lists') return 'lists';
        if (location.pathname === '/config-users') return 'users';
        return null;
    });
    const [sortDirection, setSortDirection] = useState(null);
    const [previousListId, setPreviousListId] = useState(null);
    const [previousListName, setPreviousListName] = useState(null);
    const [isFavorite, setIsFavorite] = useState(false);
    const [favorites, setFavorites] = useState([]);
    const [newListName, setNewListName] = useState('');
    const [listError, setListError] = useState(null);

    // 2. Router/Context Hooks
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const { showToast } = useToast();

    const user = localStorage.getItem('username');

    // 3. Derived State / Constants
    const getListId = useCallback(() => {
        return searchParams.get('list');
    }, [searchParams]);

    const listId = configMode === 'lists' || configMode === 'users' ? null : getListId();

    // 4. Core Logic Helpers (defined early for dependencies)

    // loadItems definition
    const loadItems = useCallback(async () => {
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
            const [itemsRes, listRes] = await Promise.all([
                fetch(`${API_URL}/${currentId}?t=${Date.now()}`),
                fetch(`/api/lists/${currentId}?t=${Date.now()}`)
            ]);

            if (itemsRes.ok) {
                const data = await itemsRes.json();
                setItems(prev => {
                    const isDiff = JSON.stringify(prev) !== JSON.stringify(data);
                    return isDiff ? data : prev;
                });
                setListError(null);
            } else if (itemsRes.status === 404) {
                setItems([]);
                setListError('List not found');
                return;
            }

            if (listRes.ok) {
                const listData = await listRes.json();
                if (listData.displayName) {
                    const currentName = localStorage.getItem('currentListName');
                    if (currentName !== listData.displayName) {
                        localStorage.setItem('currentListName', listData.displayName);
                        window.dispatchEvent(new Event('listNameUpdated'));
                    }
                }
            }
        } catch (e) {
            console.error(e);
            setListError('Error loading list');
        }
    }, [getListId, configMode]);

    // To fix the checkFavoriteStatus dependency in loadItems, we'll define it inside or move it up.
    // It uses `user`, `getListId`. 
    // Let's define it here.
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

    // We need to call checkFavoriteStatus in loadItems? The original code called it.
    // So we should add it to the useEffect or ensure it's called.
    // Original code had `checkFavoriteStatus(currentId)` inside `loadItems`.
    // Let's rely on the useEffect for checking status or accept that we call it here.
    // If I call checkFavoriteStatus inside loadItems, I need to add it to dependencies.

    // 5. Slash Command Helpers
    const saveCurrentListState = useCallback(() => {
        const currentId = getListId();
        setPreviousListId(currentId);
        setPreviousListName(localStorage.getItem('currentListName') || currentId);
    }, [getListId]);

    const handleClearList = async () => {
        await fetch(`${API_URL}/${getListId()}`, { method: 'DELETE' });
        loadItems();
        showToast('List cleared', 'success');
    };

    const slashCommandContext = {
        clearCache: handleClearList,
        saveCurrentListState,
        showToast
    };

    // 6. Other Helpers
    const loadFavorites = useCallback(async (u) => {
        if (!u) return;
        try {
            const res = await fetch(`/api/favorites/${u}?t=${Date.now()}`);
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

    // 7. Effects
    useEffect(() => {
        if (location.pathname === '/config-lists') setConfigMode('lists');
        else if (location.pathname === '/config-users') setConfigMode('users');
        else setConfigMode(null);
    }, [location.pathname]);

    useEffect(() => {
        const urlList = searchParams.get('list');
        const urlUser = searchParams.get('user');

        if (urlList) localStorage.setItem('currentListId', urlList);
        if (urlUser) localStorage.setItem('username', urlUser);

        if (urlUser) setSearchParams({ list: urlList });

        if (!urlList && !configMode && user) {
            loadFavorites(user);
        }
    }, [searchParams, setSearchParams, configMode, user, loadFavorites]);

    useEffect(() => {
        loadItems();
        setLoading(false);
        const currentId = getListId();
        if (currentId) checkFavoriteStatus(currentId);

        const eventSource = new EventSource('/api/events');
        eventSource.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'update') {
                loadItems();
                if (currentId) checkFavoriteStatus(currentId);
            }
        };
        eventSource.onerror = () => eventSource.close();
        return () => eventSource.close();
    }, [loadItems, getListId]);


    // 8. Handlers
    const handleCreateNewList = async () => {
        if (!newListName.trim()) return;
        if (!user) { showToast('Please login first', 'error'); return; }
        try {
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
                await fetch(`/api/favorites/${user}/${data.listId}`, { method: 'POST' });
                setNewListName('');
                localStorage.setItem('currentListName', newListName);
                navigate(`/?list=${data.listId}`);
            }
        } catch (e) { showToast('Error creating list', 'error'); }
    };

    const toggleFavDashboard = async (lid) => {
        try {
            const res = await fetch(`/api/favorites/${user}/${lid}`, { method: 'POST' });
            if (res.ok) {
                await loadFavorites(user);
                showToast('List removed from favorites', 'success');
            } else {
                showToast('Failed to remove favorite', 'error');
            }
        } catch (e) {
            console.error(e);
            showToast('Error removing favorite', 'error');
        }
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
                    title: `Shopping List`,
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
            const handled = await processSlashCommand(text, navigate, slashCommandContext);
            if (handled) {
                setInputText('');
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

        await fetch(`${API_URL}/${getListId()}/${id}`, { method: 'DELETE' });
        loadItems();
    };

    const handleDeleteCompleted = async () => {
        await fetch(`${API_URL}/${getListId()}/completed`, { method: 'DELETE' });
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

    // 9. Render
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
                        {listError ? (
                            <div id="empty-state" className="empty-state">
                                <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{listError}</p>
                                <button
                                    className="btn-primary"
                                    onClick={() => navigate('/')}
                                    style={{ width: 'auto', padding: '8px 16px' }}
                                >
                                    Go to Dashboard
                                </button>
                            </div>
                        ) : filteredItems.length === 0 ? (
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
