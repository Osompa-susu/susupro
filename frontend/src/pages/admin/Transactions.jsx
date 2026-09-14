import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { Panel } from '../../components/Panels.jsx';
import { Skeleton, EmptyState, ErrorBanner } from '../../components/Feedback.jsx';
import DataTable from '../../components/DataTable.jsx';
import { fmtGHS, fmtDate } from '../../utils/format.js';

export default function Transactions() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  function load() {
    setLoading(true); setError(null);
    apiFetch(`/api/reports/transactions${typeFilter ? `?type=${typeFilter}` : ''}`)
      .then(d => setRows(d.results)).catch(err => setError(err.error)).finally(() => setLoading(false));
  }
  useEffect(load, [typeFilter]);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Transactions</h1>
      <p className="mb-5 text-sm text-muted">Full ledger across all customers and workers.</p>
      <div className="mb-4 flex gap-2">
        {['', 'deposit', 'withdrawal', 'correction'].map(t => (
          <button key={t || 'all'} onClick={() => setTypeFilter(t)} className={`rounded border px-3 py-1.5 text-xs capitalize ${typeFilter === t ? 'border-teal bg-teal text-white' : 'border-line bg-panel'}`}>{t || 'All'}</button>
        ))}
      </div>
      <ErrorBanner message={error} onRetry={load} />
      <Panel>
        {loading ? <Skeleton rows={6} /> : !rows || rows.length === 0 ? <EmptyState message="No transactions in this view." /> : (
          <DataTable keyField="transaction_code" rows={rows} columns={[
            { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
            { key: 'entry_type', label: 'Type', render: r => <span className="capitalize">{r.entry_type}</span> },
            { key: 'customer_name', label: 'Customer' },
            { key: 'signed_amount', label: 'Amount', render: r => <span className={`num ${r.signed_amount < 0 ? 'text-bad' : 'text-good'}`}>{fmtGHS(r.signed_amount)}</span> },
            { key: 'worker_name', label: 'Worker' },
            { key: 'status', label: 'Status' },
            { key: 'transaction_code', label: 'Txn ID' },
          ]} />
        )}
      </Panel>
    </div>
  );
}
