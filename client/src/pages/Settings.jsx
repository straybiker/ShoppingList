import React, { useState } from 'react';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { getNickname, setNickname } from '../utils/device';

export default function Settings() {
    const [nickname, setNicknameInput] = useState(getNickname);
    const { showToast } = useToast();
    const navigate = useNavigate();

    const handleSave = (e) => {
        e.preventDefault();
        const saved = setNickname(nickname);
        showToast(saved ? 'Name saved' : 'Name removed', 'success');
        navigate('/');
    };

    return (
        <div style={{ width: '100%' }}>
            <form onSubmit={handleSave}>
                <label htmlFor="nickname" style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '500' }}>Your name (optional)</label>
                <input
                    type="text"
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    placeholder="e.g., John D."
                    maxLength={32}
                    autoComplete="off"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                />
                <p style={{ marginTop: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Shown next to the items you add. No account needed: anyone with a list link can use the list.
                </p>

                <div style={{ paddingTop: '16px' }}>
                    <button
                        type="submit"
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
                        Save
                    </button>
                </div>
            </form>
        </div>
    );
}
