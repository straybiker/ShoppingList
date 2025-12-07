
import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
    const [username, setUsername] = useState('');
    const [displayName, setDisplayName] = useState('');
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
        }
        if (savedDisplayName) setDisplayName(savedDisplayName);
    }, []);

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
        setIsProfileSaved(false);
        navigate('/');
    };

    return (
        <div style={{ width: '100%' }}>
            <form onSubmit={handleSaveProfile} className="space-y-6">
                <div style={{ marginBottom: '16px' }}>
                    <label htmlFor="username" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Username (Unique)</label>
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
                    <label htmlFor="display-name" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Display Name</label>
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
                        style={{
                            width: '100%',
                            maxWidth: '100%',
                            borderRadius: '12px',
                            fontSize: '1rem',
                            height: '48px',
                            fontWeight: '600',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            boxSizing: 'border-box',
                            background: 'var(--accent-color)',
                            border: 'none',
                            color: '#fff',
                            cursor: 'pointer'
                        }}
                    >
                        {loading ? 'Saving...' : 'Save & Continue'}
                    </button>
                </div>
            </form>

            {isProfileSaved && (
                <div style={{ marginTop: '32px', marginBottom: '24px', textAlign: 'center' }}>
                    <button
                        type="button"
                        onClick={handleLogout}
                        style={{ background: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: '600', width: '100%', maxWidth: '200px', fontSize: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em', opacity: 0.8 }}
                    >
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
}
