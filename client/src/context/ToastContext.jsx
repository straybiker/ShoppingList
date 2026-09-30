import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

// showToast(message, type, { actionLabel, onAction }): with an action, the toast
// stays 5 s and shows a button (for example "Undo").
export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({ message: '', type: '', visible: false, action: null });
    const timerRef = useRef(null);

    const hideToast = useCallback(() => {
        clearTimeout(timerRef.current);
        setToast(prev => ({ ...prev, visible: false, action: null }));
    }, []);

    const showToast = useCallback((message, type = 'info', options = {}) => {
        const action = options.actionLabel && options.onAction
            ? { label: options.actionLabel, run: options.onAction }
            : null;
        clearTimeout(timerRef.current);
        setToast({ message, type, visible: true, action });
        timerRef.current = setTimeout(hideToast, action ? 5000 : 3000);
    }, [hideToast]);

    const handleAction = () => {
        const action = toast.action;
        hideToast();
        if (action) action.run();
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div
                style={{
                    zIndex: 99999,
                    position: 'fixed',
                    bottom: '40px',
                    left: '50%',
                    transform: toast.visible ? 'translateX(-50%) translateY(0) scale(1)' : 'translateX(-50%) translateY(20px) scale(0.95)',
                    opacity: toast.visible ? 1 : 0,
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    pointerEvents: toast.visible && toast.action ? 'auto' : 'none',
                    display: 'flex',
                    justifyContent: 'center',
                    width: 'auto'
                }}
            >
                <div
                    role="status"
                    style={{
                        minWidth: '280px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '16px',
                        backgroundColor: toast.type === 'success' ? '#22c55e' : // green-500
                            toast.type === 'error' ? '#ef4444' :   // red-500
                                '#334155',                             // slate-700
                        color: '#ffffff',
                        padding: '14px 28px',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: '600',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        letterSpacing: '0.025em'
                    }}
                >
                    <span>{toast.message}</span>
                    {toast.action && (
                        <button
                            type="button"
                            onClick={handleAction}
                            style={{
                                background: 'rgba(255,255,255,0.2)',
                                border: 'none',
                                color: '#fff',
                                padding: '6px 14px',
                                borderRadius: '8px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em'
                            }}
                        >
                            {toast.action.label}
                        </button>
                    )}
                </div>
            </div>
        </ToastContext.Provider>
    );
};
