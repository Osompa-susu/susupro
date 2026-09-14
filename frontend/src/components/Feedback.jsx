import React from 'react';

export function Skeleton({ rows = 4 }) {
  return (
    <div className="space-y-2" role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded bg-line/40" />)}
    </div>
  );
}

export function EmptyState({ message, action }) {
  return (
    <div className="py-10 text-center text-sm text-muted">
      <p>{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="mb-3.5 flex items-center justify-between rounded border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-bad">
      <span>{message}</span>
      {onRetry && <button onClick={onRetry} className="ml-3 shrink-0 underline">Retry</button>}
    </div>
  );
}

export function SuccessBanner({ message }) {
  if (!message) return null;
  return <div className="mb-3.5 rounded border border-green-200 bg-green-50 px-3.5 py-2.5 text-sm text-good">{message}</div>;
}

const STATUS_STYLES = {
  active: 'bg-green-100 text-good', completed: 'bg-green-100 text-good', approved: 'bg-green-100 text-good',
  suspended: 'bg-gold-soft text-gold', pending: 'bg-gold-soft text-gold', inactive: 'bg-gold-soft text-gold',
  deactivated: 'bg-red-100 text-bad', rejected: 'bg-red-100 text-bad', closed: 'bg-red-100 text-bad',
};
export function StatusPill({ status }) {
  return <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${STATUS_STYLES[status] || 'bg-line/40 text-muted'}`}>{status}</span>;
}
