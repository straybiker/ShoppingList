
import React, { useState, useRef } from 'react';
import { Trash2, Plus, Minus, CornerDownLeft } from 'lucide-react';

export default function ListItem({ item, configMode, onToggle, onIncrement, onDecrement, onDelete, onOpenList }) {
    const isCompleted = item.completed;
    const [offset, setOffset] = useState(0);
    const startX = useRef(null);
    const isDragging = useRef(false);

    let metaText = null;
    if (configMode) {
        if (configMode === 'lists') {
            const dateStr = item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Never updated';
            const creatorStr = item.creatorName ? `Created by ${item.creatorName} • ` : '';
            metaText = creatorStr + dateStr;
        } else if (configMode === 'users') {
            metaText = item.updatedAt ? `Last seen: ${new Date(item.updatedAt).toLocaleString()}` : '';
        }
    } else {
        metaText = item.authorName || (item.addedBy !== 'Guest' ? item.addedBy : null);
    }

    const handlePointerDown = (e) => {
        // Only allow swipe on touch or main mouse button, and only if not in config mode (optional)
        startX.current = e.clientX;
        isDragging.current = true;
    };

    const handlePointerMove = (e) => {
        if (!isDragging.current) return;
        const currentX = e.clientX;
        const diff = currentX - startX.current;

        // Only allow sliding to the left (negative diff)
        // Limit max slide to -100px
        if (diff < 0) {
            // Apply resistance or simple limit
            const newOffset = Math.max(diff, -80);
            setOffset(newOffset);
        } else {
            // If pulling right (while closed), stay closed. 
            // If pulling right (while open), strictly close it? 
            // Basic logic: if open (offset < 0), allow closing. form logic: min(diff, 0)
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
        <li
            className="list-item-container"
            style={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 'var(--radius-md)',
                marginBottom: 0, // Handled by gap
                touchAction: 'pan-y', // Allow vertical scroll, block horizontal for browser nav if possible
                userSelect: 'none'
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
        >
            {/* Background Layer (Delete) */}
            <div
                style={{
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
                }}
            >
                <div onClick={() => onDelete(item.id)} style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                    <Trash2 size={20} color="#fff" />
                </div>
            </div>

            {/* Foreground Layer (Content) */}
            <div
                className={`list-item ${isCompleted ? 'completed' : ''}`}
                style={{
                    position: 'relative',
                    transform: `translateX(${offset}px)`,
                    transition: isDragging.current ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
                    backgroundColor: isCompleted ? '#334155' : '#1e293b',
                    zIndex: 2,
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    margin: 0
                }}
            >
                <div
                    className="item-content"
                    onClick={() => configMode === 'lists' && onOpenList(item)}
                    style={{ cursor: configMode === 'lists' ? 'pointer' : 'default' }}
                >
                    {!configMode && (
                        <div
                            className="checkbox"
                            onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
                        >
                        </div>
                    )}

                    <div className="text-content">
                        {metaText && (
                            <span className="item-author">
                                {metaText}
                            </span>
                        )}
                        <span className="item-text">
                            {item.text}
                        </span>
                    </div>
                </div>

                <div className="item-actions">
                    {configMode === 'lists' ? (
                        <button
                            onClick={() => onOpenList(item)}
                            className="sort-btn"
                            style={{ width: '32px', height: '32px', padding: 0 }}
                            aria-label="Open list"
                        >
                            <CornerDownLeft size={16} />
                        </button>
                    ) : !configMode ? (
                        <div className="qty-controls">
                            <span className="qty-display">{item.amount || 1}</span>
                            <button onClick={(e) => { e.stopPropagation(); onIncrement(item.id); }} className="qty-btn" aria-label="Increase"><Plus size={14} /></button>
                            <button onClick={(e) => { e.stopPropagation(); onDecrement(item.id); }} className="qty-btn" aria-label="Decrease"><Minus size={14} /></button>
                        </div>
                    ) : null}

                    {/* Delete button removed from here, now in background */}
                </div>
            </div>
        </li>
    );
}
