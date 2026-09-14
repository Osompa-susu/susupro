import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client.js';
import { Panel } from '../../components/Panels.jsx';
import { Skeleton, ErrorBanner, EmptyState, StatusPill } from '../../components/Feedback.jsx';
import Button from '../../components/Button.jsx';
import { fmtGHS } from '../../utils/format.js';

export default function CustomersList() {
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
      <div className="mb-5 flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-teal-dark">Customers</h1><p className="text-sm text-muted">Search all registered customers.</p></div>
        <Link to="/customers/register"><Button variant="gold">Register Customer</Button></Link>
      </div>
      <input value={query} onChange={e => search(e.target.value)} placeholder="Search by name, phone, or customer ID..." className="mb-4 w-full rounded border border-line px-3.5 py-2.5 text-sm outline-none focus:border-teal" />
      <ErrorBanner message={error} />
      <Panel>
        {loading ? <Skeleton rows={4} /> : !query ? (
          <EmptyState message="Start typing to search." />
        ) : !results || results.length === 0 ? (
          <EmptyState message="No customers match your search." />
        ) : (
          <div className="space-y-2">
            {results.map(c => (
              <Link key={c.customer_code} to={`/customers/${c.customer_code}`} className="flex items-center justify-between rounded border border-line p-3 hover:border-teal">
                <div><div className="font-semibold">{c.full_name}</div><div className="text-xs text-muted">{c.customer_code} · {c.phone}</div></div>
                <div className="text-right"><div className="num font-semibold">{fmtGHS(c.balance)}</div><StatusPill status={c.status} /></div>
              </Link>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
