
import React from 'react';
import { Trash2, Plus, Minus, Check, CornerDownLeft } from 'lucide-react';

export default function ListItem({ item, configMode, onToggle, onIncrement, onDecrement, onDelete, onOpenList }) {
    const isCompleted = item.completed;

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

    return (
        <li className={`list-item ${isCompleted ? 'completed' : ''}`}>
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
                        className="sort-btn" // Reuse nice button style
                        style={{ width: '32px', height: '32px', padding: 0 }}
                        aria-label="Open list"
                    >
                        <CornerDownLeft size={16} />
                    </button>
                ) : !configMode ? (
                    <div className="qty-controls">
                        <span className="qty-display">{item.amount || 1}</span>
                        <button onClick={() => onIncrement(item.id)} className="qty-btn" aria-label="Increase"><Plus size={14} /></button>
                        <button onClick={() => onDecrement(item.id)} className="qty-btn" aria-label="Decrease"><Minus size={14} /></button>
                    </div>
                ) : null}

                <button
                    onClick={() => onDelete(item.id)}
                    className="delete-btn"
                    aria-label="Delete"
                >
                    <Trash2 size={18} />
                </button>
            </div>
        </li>
    );
}
