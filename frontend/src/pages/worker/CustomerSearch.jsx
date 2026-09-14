import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../../api/client.js';
import { Panel } from '../../components/Panels.jsx';
import { Skeleton, ErrorBanner, EmptyState, StatusPill } from '../../components/Feedback.jsx';

export default function CustomerSearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  let debounce;

  function search(q) {
    setQuery(q);
    clearTimeout(debounce);
    if (!q.trim()) { setResults(null); return; }
    setLoading(true);
    debounce = setTimeout(() => {
      apiFetch(`/api/customers/search?q=${encodeURIComponent(q)}`)
        .then(d => setResults(d.results))
        .catch(err => setError(err.error))
        .finally(() => setLoading(false));
    }, 250);
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Customer Search</h1>
      <p className="mb-5 text-sm text-muted">Search by name, phone, or customer ID.</p>
      <input value={query} onChange={e => search(e.target.value)} placeholder="Type to search..." className="mb-4 w-full rounded border border-line px-3.5 py-2.5 text-sm outline-none focus:border-teal" />
      <ErrorBanner message={error} />
      <Panel>
        {loading ? <Skeleton rows={3} /> : !query ? (
          <EmptyState message="Start typing to search." />
        ) : !results || results.length === 0 ? (
          <EmptyState message="No matching customers." />
        ) : (
          <div className="space-y-2">
            {results.map(c => (
              <div key={c.customer_code} onClick={() => navigate(`/customers/${c.customer_code}`)} className="flex cursor-pointer items-center justify-between rounded border border-line p-3 hover:border-teal">
                <div><div className="font-semibold">{c.full_name}</div><div className="text-xs text-muted">{c.customer_code} · {c.phone}</div></div>
                <StatusPill status={c.status} />
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
