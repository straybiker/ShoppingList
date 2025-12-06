
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
                className={`fixed left-1/2 bottom-6 transform -translate-x-1/2 transition-all duration-300 z-50 px-4 py-2 rounded-lg shadow-lg pointer-events-none 
          ${toast.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}
          ${toast.type === 'success' ? 'bg-green-500 text-white' : ''}
          ${toast.type === 'error' ? 'bg-red-500 text-white' : ''}
          ${toast.type === 'info' ? 'bg-slate-800 text-white' : ''}
        `}
            >
                {toast.message}
            </div>
        </ToastContext.Provider>
    );
};
