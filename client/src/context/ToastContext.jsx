
import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const useToast = () => useContext(ToastContext);

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({ message: '', type: '', visible: false });

    const showToast = useCallback((message, type = 'info') => {
        setToast({ message, type, visible: true });
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
    }, []);

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
                    pointerEvents: 'none',
                    display: 'flex',
                    justifyContent: 'center',
                    width: 'auto'
                }}
            >
                <div
                    style={{
                        minWidth: '280px',
                        textAlign: 'center',
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
                    {toast.message}
                </div>
            </div>
        </ToastContext.Provider>
    );
};
