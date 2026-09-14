import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { Panel } from '../../components/Panels.jsx';
import { Skeleton, EmptyState, ErrorBanner } from '../../components/Feedback.jsx';
import DataTable from '../../components/DataTable.jsx';
import { fmtGHS, fmtDate } from '../../utils/format.js';

export default function MyTransactions() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    apiFetch('/api/transactions/mine').then(d => setRows(d.recentTransactions)).catch(err => setError(err.error));
  }
  useEffect(load, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">My Transactions</h1>
      <p className="mb-5 text-sm text-muted">Every transaction you have recorded.</p>
      <ErrorBanner message={error} onRetry={load} />
      <Panel>
        {!rows ? <Skeleton rows={5} /> : rows.length === 0 ? <EmptyState message="No transactions recorded yet." /> : (
          <DataTable keyField="transaction_code" rows={rows} columns={[
            { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
            { key: 'entry_type', label: 'Type', render: r => <span className="capitalize">{r.entry_type}</span> },
            { key: 'customer_name', label: 'Customer' },
            { key: 'signed_amount', label: 'Amount', render: r => <span className={`num ${r.signed_amount < 0 ? 'text-bad' : 'text-good'}`}>{fmtGHS(r.signed_amount)}</span> },
            { key: 'transaction_code', label: 'Txn ID' },
          ]} />
        )}
      </Panel>
    </div>
  );
}
