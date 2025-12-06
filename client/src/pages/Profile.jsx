
import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { Trash2, StarOff, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [favorites, setFavorites] = useState([]);
    const [newListName, setNewListName] = useState('');
    const [loading, setLoading] = useState(false);
    const [isProfileSaved, setIsProfileSaved] = useState(false);
    const { showToast } = useToast();
    const navigate = useNavigate();

    useEffect(() => {
        const savedUsername = localStorage.getItem('username');
        const savedDisplayName = localStorage.getItem('displayName');

        if (savedUsername) {
            setUsername(savedUsername);
            setIsProfileSaved(true);
            loadFavorites(savedUsername);
        }
        if (savedDisplayName) setDisplayName(savedDisplayName);
    }, []);

    const loadFavorites = async (user) => {
        try {
            const response = await fetch(`/api/favorites/${user}`);
            if (response.ok) {
                const favIds = await response.json();

                const listPromises = favIds.map(id => fetch(`/api/lists/${id}`)
                    .then(r => r.ok ? r.json() : { name: id, displayName: 'Unknown List (Deleted)', itemCount: 0, isDeleted: true })
                    .catch(() => ({ name: id, displayName: 'Error Loading List', itemCount: 0, isDeleted: true }))
                );

                const lists = await Promise.all(listPromises);
                setFavorites(lists);
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        if (!username.trim()) return;

        setLoading(true);
        try {
            const response = await fetch('/api/users/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, displayName: displayName || username })
            });

            if (response.ok) {
                localStorage.setItem('username', username);
                localStorage.setItem('displayName', displayName || username);
                setIsProfileSaved(true);
                showToast('Profile saved', 'success');
                loadFavorites(username);
            } else {
                const data = await response.json();
                showToast(data.error || 'Registration failed', 'error');
            }
        } catch (error) {
            showToast('Network error', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('username');
        localStorage.removeItem('displayName');
        setUsername('');
        setDisplayName('');
        setFavorites([]);
        setIsProfileSaved(false);
        // We don't reload to allow re-login smoothly, but clearing state is key
        // window.location.reload(); // Optional, but better stay in app
    };

    const handleCreateList = async () => {
        if (!newListName.trim()) return;
        const user = localStorage.getItem('username');
        if (!user) {
            // Should not happen if UI is hidden, but safety check
            showToast('Please save your username first', 'error');
            return;
        }

        try {
            const createRes = await fetch('/api/lists', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    displayName: newListName,
                    createdBy: user,
                    creatorName: localStorage.getItem('displayName') || user
                })
            });

            if (!createRes.ok) throw new Error('Failed to create list');
            const listData = await createRes.json();

            const favRes = await fetch(`/api/favorites/${user}/${listData.listId}`, {
                method: 'POST'
            });

            if (!favRes.ok) throw new Error('Failed to add to favorites');

            setNewListName('');
            loadFavorites(user);
            showToast('List created and favorited', 'success');
        } catch (error) {
            console.error(error);
            showToast('Error creating list', 'error');
        }
    };

    const deleteList = async (listId) => {
        // if (!confirm('Are you sure you want to delete this list? This cannot be undone.')) return;
        try {
            const response = await fetch(`/api/lists/${listId}`, { method: 'DELETE' });
            if (response.ok) {
                loadFavorites(username);
                showToast('List deleted', 'success');
            } else {
                showToast('Failed to delete list', 'error');
            }
        } catch (e) {
            showToast('Error deleting list', 'error');
        }
    };

    const toggleFavorite = async (listId) => {
        try {
            const response = await fetch(`/api/favorites/${username}/${listId}`, { method: 'POST' });
            if (response.ok) {
                loadFavorites(username);
                showToast('Favorite removed', 'success');
            }
        } catch (e) {
            showToast('Failed to remove favorite', 'error');
        }
    };

    return (
        <div style={{ width: '100%', height: '100%', maxWidth: '480px', margin: '0 auto' }}>
            <div className="mb-8 text-center">
                <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem', color: 'var(--text-primary)', fontWeight: '700' }}>User Profile</h2>
                <p className="subtitle" style={{ fontSize: '1rem' }}>Identify yourself to your shopping buddies.</p>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-6">
                <div>
                    <label htmlFor="username" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Username (Unique)</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g., johndoe"
                        required
                        autoComplete="off"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                </div>

                <div>
                    <label htmlFor="display-name" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Display Name</label>
                    <input
                        type="text"
                        id="display-name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g., John D."
                        autoComplete="off"
                        style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                </div>

                <div style={{ paddingTop: '8px' }}>
                    <button
                        type="submit"
                        disabled={loading}
                        className="btn-primary"
                        style={{ width: '100%', borderRadius: '12px', fontSize: '1rem', height: '48px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                        {loading ? 'Saving...' : 'Save & Continue'}
                    </button>
                </div>
            </form>

            {isProfileSaved && (
                <>
                    <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid var(--glass-border)' }}>
                        <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)', fontWeight: '600' }}>Create New List</h3>
                        <div className="input-wrapper" style={{ marginBottom: 0 }}>
                            <input
                                type="text"
                                value={newListName}
                                onChange={(e) => setNewListName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateList()}
                                placeholder="Create a new list ..."
                                autoComplete="off"
                            />
                            <button
                                type="button"
                                onClick={handleCreateList}
                                className="btn-primary"
                                aria-label="Create list"
                            >
                                <Plus size={24} />
                            </button>
                        </div>
                    </div>

                    {favorites.length > 0 && (
                        <div style={{ marginTop: '40px' }}>
                            <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-primary)', fontWeight: '600' }}>Favorite Lists</h3>
                            <ul className="shopping-list">
                                {favorites.map(list => (
                                    <li key={list.name} className="list-item">
                                        <div
                                            className="item-content"
                                            onClick={() => !list.isDeleted && navigate(`/?list=${list.name}`)}
                                            style={{ cursor: list.isDeleted ? 'default' : 'pointer' }}
                                        >
                                            <div className="text-content">
                                                <span className="item-author" style={{ fontSize: '0.65rem' }}>
                                                    {list.itemCount} items
                                                </span>
                                                <span className={`item-text ${list.isDeleted ? 'text-danger line-through' : ''}`}>
                                                    {list.displayName || list.name}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="item-actions">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); toggleFavorite(list.name); }}
                                                className="delete-btn"
                                                title="Remove favorite"
                                                style={{ color: 'var(--accent-color)' }}
                                            >
                                                <StarOff size={18} />
                                            </button>
                                            {!list.isDeleted && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); deleteList(list.name); }}
                                                    className="delete-btn"
                                                    title="Delete list"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div style={{ marginTop: '48px', marginBottom: '32px', textAlign: 'center' }}>
                        <button
                            type="button"
                            onClick={handleLogout}
                            style={{ background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', width: '100%', maxWidth: '200px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}
                        >
                            Logout
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
