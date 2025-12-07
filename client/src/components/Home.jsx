
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import ListItem from '../components/ListItem';
import { Plus, ArrowDownAZ, ArrowUpZA, Trash2, RotateCcw, Star } from 'lucide-react';

// API Helpers
const API_URL = '/api/items';

export default function Home() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [inputText, setInputText] = useState('');
    const [configMode, setConfigMode] = useState(() => {
        if (location.pathname === '/config-lists') return 'lists';
        if (location.pathname === '/config-users') return 'users';
        return null;
    }); // 'lists' | 'users' | null

    const [sortDirection, setSortDirection] = useState(null); // 'asc' | 'desc'

    // State for "Return" functionality in config mode
    const [previousListId, setPreviousListId] = useState(null);
    const [previousListName, setPreviousListName] = useState(null);

    const [isFavorite, setIsFavorite] = useState(false);

    // Router
    const [searchParams, setSearchParams] = useSearchParams();
    const navigate = useNavigate();
    const location = useLocation(); // Add useLocation`
    const { showToast } = useToast();

    // Determine current List ID
    // Priority: URL Param > LocalStorage > 'default'
    const getListId = useCallback(() => {
        const urlList = searchParams.get('list');
        if (urlList) return urlList;
        return localStorage.getItem('currentListId') || 'default';
    }, [searchParams]);

    const listId = configMode === 'lists' || configMode === 'users' ? null : getListId();
    const user = localStorage.getItem('username');

    // Handle URL cleanup / persistence
    useEffect(() => {
        const urlList = searchParams.get('list');
        const urlUser = searchParams.get('user');

        if (urlList) {
            localStorage.setItem('currentListId', urlList);
        }
        if (urlUser) {
            localStorage.setItem('username', urlUser);
        }

        if (urlList || urlUser) {
            // Clean URL
            setSearchParams({});
        }
    }, [searchParams, setSearchParams]);

    // Handle Route-based Config Mode
    useEffect(() => {
        if (location.pathname === '/config-lists') {
            setConfigMode('lists');
            // Ensure we have previous list state if navigating directly
            if (!previousListId) {
                const storedId = localStorage.getItem('currentListId') || 'default';
                setPreviousListId(storedId);
                setPreviousListName(localStorage.getItem('currentListName') || storedId);
            }
        } else if (location.pathname === '/config-users') {
            setConfigMode('users');
            if (!previousListId) {
                const storedId = localStorage.getItem('currentListId') || 'default';
                setPreviousListId(storedId);
                setPreviousListName(localStorage.getItem('currentListName') || storedId);
            }
        } else if (location.pathname === '/') {
            // Only reset if we were in a config mode and navigated back to root
            // But we handle explicit "Return" via state reset.
            // If user hits Back button, this ensures we exit config mode.
            if (configMode) setConfigMode(null);
        }
    }, [location.pathname]);

    // Load Items
    const loadItems = useCallback(async () => {
        if (configMode === 'lists') {
            try {
                const res = await fetch(`/api/lists?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    // Map to unified item structure
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
            } catch (e) {
                console.error(e);
            }
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

        // Normal Mode
        const currentId = getListId();
        try {
            const res = await fetch(`${API_URL}/${currentId}`);
            if (res.status === 404 && currentId !== 'default') {
                // List deleted or missing, reset to default
                localStorage.setItem('currentListId', 'default');
                navigate('/');
                // Trigger reload to pick up new ID
                return loadItems();
            }
            if (res.ok) {
                const data = await res.json();
                // simple compare to avoid re-render loop if deep equal? 
                // relying on react setState optimization usually enough if ref check fails, but new array always triggers.
                setItems(prev => {
                    const isDiff = JSON.stringify(prev) !== JSON.stringify(data);
                    return isDiff ? data : prev;
                });
                checkFavoriteStatus(currentId);
            }
        } catch (e) { console.error(e); }
    }, [getListId, configMode]);

    // Initial Load & SSE
    useEffect(() => {
        loadItems();
        setLoading(false);

        // SSE
        const eventSource = new EventSource('/api/events');
        eventSource.onopen = () => console.log('SSE Connected');
        eventSource.onmessage = (e) => {
            const data = JSON.parse(e.data);
            if (data.type === 'update') {
                loadItems();
            }
        };
        eventSource.onerror = (e) => {
            console.error('SSE Error', e);
            eventSource.close();
            // Reconnect logic could go here
        };

        return () => {
            eventSource.close();
        };
    }, [loadItems]);

    // Check Favorite Status
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

    // Actions
    const handleAddItem = async () => {
        const text = inputText.trim();
        if (!text) return;

        // Slash Commands
        if (text.startsWith('/')) {
            if (text === '/clear-cache') {
                // Logic to clear list
                await handleClearList();
                setInputText('');
                return;
            } else if (text === '/config-lists') {
                const currentId = getListId();
                // Fetch name to store
                setPreviousListId(currentId);
                setPreviousListName(localStorage.getItem('currentListName') || currentId);

                setConfigMode('lists');
                setInputText('');
                loadItems(); // will trigger config load
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
            // Create List
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

        // Add Item
        // Check existing first (local check for perf, backend does it mostly via creating separate items?)
        // App.js: checks existing, if so increments.
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
                    // Also send displayName of list for persistence logic in backend
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
                const res = await fetch(`/api/lists/${encodeURIComponent(id)}`, { method: 'DELETE' });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to delete list');
                }
                showToast('List deleted', 'success');
                loadItems();
            } catch (e) { showToast(e.message, 'error'); }
            return;
        } else if (configMode === 'users') {
            if (!confirm('Delete user?')) return;
            try {
                const res = await fetch(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Failed to delete user');
                }
                showToast('User deleted', 'success');
                loadItems();
            } catch (e) { showToast(e.message, 'error'); }
            return;
        }

        // Item deletion
        try {
            const res = await fetch(`${API_URL}/${getListId()}/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete item');
            loadItems();
        } catch (e) { console.error(e); }
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
        <div className="flex flex-col h-full text-slate-50" style={{ position: 'relative' }}>
            {/* Header Extension for Config Mode */}
            {configMode && (
                <div className="text-center mb-2 text-accent font-medium">
                    {configMode === 'lists' ? 'Configuration: Manage Lists' : 'Configuration: Manage Users'}
                </div>
            )}


            {/* Input Area */}
            <div className="flex gap-3 mb-2 w-full">
                <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                    className="flex-1 px-4 py-3 bg-[rgba(15,23,42,0.6)] border border-glass-border rounded-md text-primary placeholder-secondary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/20 transition-all font-sans text-base h-12"
                    placeholder={configMode === 'lists' ? "Add new list..." : configMode === 'users' ? "Search users..." : "Add a new item..."}
                    autoComplete="off"
                />
                <button
                    onClick={handleAddItem}
                    className="w-10 h-10 sm:w-[40px] sm:h-[40px] flex items-center justify-center bg-accent hover:bg-accent-hover text-white rounded-xs shadow-sm hover:shadow-md transition-all active:translate-y-[1px]"
                >
                    <Plus size={24} />
                </button>
            </div>

            {/* List Area */}
            <div className="list-area flex-1 overflow-y-auto min-h-0 relative">
                {filteredItems.length === 0 ? (
                    <div className="text-center py-10 text-secondary italic">
                        {configMode ? 'No items found' : 'Your list is empty.'}
                    </div>
                ) : (
                    <ul className="shopping-list mt-0 pb-4">
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
                                    localStorage.setItem('currentListName', item.text); // text is displayName
                                    setConfigMode(null);
                                    setPreviousListId(null);
                                    navigate('/');
                                    window.location.reload();
                                }}
                            />
                        ))}
                    </ul>
                )}

                {/* Return Button in Config Mode */}
                {configMode && (
                    <div className="mt-6 flex justify-center">
                        <button
                            onClick={() => {
                                setConfigMode(null);
                                localStorage.setItem('currentListId', previousListId || 'default');
                                window.location.reload();
                            }}
                            className="w-full py-2 bg-accent hover:bg-accent-hover text-white rounded-xs shadow-sm transition-colors text-sm"
                        >
                            Return to {previousListName || 'List'}
                        </button>
                    </div>
                )}
            </div>

            {/* Footer Controls */}
            {
                !configMode && items.length > 0 && (
                    <div className="mt-4 pt-4 flex justify-between items-center">
                        <div className="flex gap-2">
                            <button onClick={() => setSortDirection('asc')} className={`px-3 py-2 rounded-xs transition-colors text-sm font-medium shadow-sm ${sortDirection === 'asc' ? 'bg-accent text-white' : 'bg-accent text-white hover:bg-accent-hover'}`}>
                                A-Z
                            </button>
                            <button onClick={() => setSortDirection('desc')} className={`px-3 py-2 rounded-xs transition-colors text-sm font-medium shadow-sm ${sortDirection === 'desc' ? 'bg-accent text-white' : 'bg-accent text-white hover:bg-accent-hover'}`}>
                                Z-A
                            </button>
                        </div>

                        {hasCompleted && (
                            <button
                                onClick={handleDeleteCompleted}
                                className="px-3 py-2 bg-danger hover:bg-red-700 text-white rounded-xs text-sm font-medium transition-colors shadow-sm"
                            >
                                Delete completed
                            </button>
                        )}
                    </div>
                )
            }
        </div >
    );
}
