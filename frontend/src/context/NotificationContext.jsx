import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [toast, setToast] = useState(null);
  const notify = useCallback((message, tone = 'success') => setToast({ message, tone }), []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 max-w-[80vw] rounded px-4 py-3 text-sm text-white shadow-lg ${toast.tone === 'error' ? 'bg-bad' : 'bg-teal-dark'}`}>
          {toast.message}
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotify() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotify must be used within NotificationProvider');
  return ctx.notify;
}
