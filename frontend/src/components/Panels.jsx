import React from 'react';

export function Panel({ title, children, className = '' }) {
  return (
    <div className={`mb-5 rounded border border-line bg-panel p-5 ${className}`}>
      {title && <h2 className="mb-3.5 text-sm font-semibold text-teal-dark">{title}</h2>}
      {children}
    </div>
  );
}

export function StatCard({ label, value, gold = false }) {
  return (
    <div className="min-w-[160px] flex-1 rounded border border-line bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`num mt-1 text-2xl font-bold ${gold ? 'text-gold' : 'text-teal-dark'}`}>{value}</div>
    </div>
  );
}

export function StatCardRow({ children }) {
  return <div className="mb-6 flex flex-wrap gap-4">{children}</div>;
}
