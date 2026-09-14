import React from 'react';

export default function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded border-t-4 border-gold bg-panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-teal-dark">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-ink">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
