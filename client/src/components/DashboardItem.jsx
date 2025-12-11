import React, { useState, useRef } from 'react';
import { Trash2, StarOff, Share2 } from 'lucide-react';

export default function DashboardItem({ list, onOpen, onShare, onToggleFav, onDelete }) {
    const [offset, setOffset] = useState(0);
    const startX = useRef(null);
    const isDragging = useRef(false);
    const hasDragged = useRef(false);

    // Gesture Handlers
    const handlePointerDown = (e) => {
        if (list.isDeleted) return; // Disable swipe for deleted lists
        startX.current = e.clientX;
        isDragging.current = true;
        hasDragged.current = false; // Reset drag status
    };

    const handlePointerMove = (e) => {
        if (!isDragging.current) return;
        const currentX = e.clientX;
        const diff = currentX - startX.current;

        // Threshold for detecting a purposeful drag vs a messy click
        if (Math.abs(diff) > 5) hasDragged.current = true;

        // Allow slide left only
        if (diff < 0) {
            const newOffset = Math.max(diff, -80);
            setOffset(newOffset);
        } else {
            // Resistance if pulling right
            if (offset < 0) {
                setOffset(Math.min(offset + diff, 0));
            }
        }
    };

    const handlePointerUp = () => {
        if (!isDragging.current) return;
        isDragging.current = false;
        startX.current = null;

        // Snap threshold
        if (offset < -40) {
            setOffset(-60); // Snap open
        } else {
            setOffset(0); // Snap close
        }
    };

    const handlePointerLeave = () => {
        if (isDragging.current) {
            handlePointerUp();
        }
    };

    return (
        <li style={{
            position: 'relative',
            overflow: 'hidden',
            borderRadius: 'var(--radius-md)',
            marginBottom: 0,
            touchAction: 'pan-y',
            userSelect: 'none'
        }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
        >
            {/* Background Layer (Delete) */}
            <div style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                right: 0,
                width: '100%',
                backgroundColor: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: '22px',
                borderRadius: 'var(--radius-md)'
            }}>
                <div onClick={() => onDelete(list.name)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <Trash2 size={20} color="#fff" />
                </div>
            </div>

            {/* Foreground Layer (Content) */}
            <div className="list-item" style={{
                position: 'relative',
                transform: `translateX(${offset}px)`,
                transition: isDragging.current ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                zIndex: 2,
                backgroundColor: '#1e293b', // Solid background to hide delete layer
                border: '1px solid rgba(255, 255, 255, 0.05)',
                margin: 0
            }}>
                <div
                    className="item-content"
                    onClick={() => {
                        // Prevent open if this was a drag action
                        if (hasDragged.current) return;

                        // Prevent open if the item is currently swiped open
                        if (offset !== 0) {
                            setOffset(0); // Tap to close
                            return;
                        }

                        if (!list.isDeleted) {
                            onOpen(list);
                        }
                    }}
                    style={{ cursor: list.isDeleted ? 'default' : 'pointer' }}
                >
                    <div className="text-content">
                        <span className="item-author" style={{ fontSize: '0.65rem' }}>{list.itemCount} items</span>
                        <span className={`item-text ${list.isDeleted ? 'text-danger line-through' : ''}`}>
                            {list.displayName || list.name}
                        </span>
                    </div>
                </div>

                <div className="item-actions" onPointerDown={(e) => e.stopPropagation()}>
                    <button onClick={(e) => { e.stopPropagation(); onShare(list.name); }} className="delete-btn" style={{ color: 'var(--text-secondary)' }}>
                        <Share2 size={18} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleFav(list.name); }} className="delete-btn" style={{ color: 'var(--accent-color)' }}>
                        <StarOff size={18} />
                    </button>
                </div>
            </div>
        </li>
    );
}
