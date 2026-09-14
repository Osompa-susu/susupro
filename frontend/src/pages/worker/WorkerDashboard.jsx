import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { Panel, StatCard, StatCardRow } from '../../components/Panels.jsx';
import { Skeleton, ErrorBanner, EmptyState } from '../../components/Feedback.jsx';
import DataTable from '../../components/DataTable.jsx';
import { fmtGHS, fmtDate } from '../../utils/format.js';

export default function WorkerDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true); setError(null);
    apiFetch('/api/transactions/mine').then(setStats).catch(err => setError(err.error)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Welcome, {user.fullName.split(' ')[0]}</h1>
      <p className="mb-5 text-sm text-muted">Here's your activity for today.</p>
      <ErrorBanner message={error} onRetry={load} />
      {loading ? <Skeleton rows={1} /> : stats && (
        <StatCardRow>
          <StatCard label="Today's Collections" value={fmtGHS(stats.todaysCollections)} gold />
          <StatCard label="Transactions Today" value={stats.transactionsToday} />
        </StatCardRow>
      )}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
        {[['/customers/register', 'Register Customer'], ['/deposit', 'Record Deposit'], ['/customers/search', 'Customer Search'], ['/my-transactions', 'My Transactions']].map(([to, label]) => (
          <Link key={to} to={to} className="rounded border border-line bg-panel px-4 py-3 text-center text-sm font-semibold text-teal-dark hover:border-teal">{label}</Link>
        ))}
      </div>
      <Panel title="My Recent Transactions">
        {loading ? <Skeleton rows={4} /> : !stats ? null : stats.recentTransactions.length === 0 ? (
          <EmptyState message="No transactions recorded yet." />
        ) : (
          <DataTable keyField="transaction_code" rows={stats.recentTransactions.slice(0, 8)} columns={[
            { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
            { key: 'entry_type', label: 'Type', render: r => <span className="capitalize">{r.entry_type}</span> },
            { key: 'customer_name', label: 'Customer' },
            { key: 'signed_amount', label: 'Amount', render: r => <span className={`num ${r.signed_amount < 0 ? 'text-bad' : 'text-good'}`}>{fmtGHS(r.signed_amount)}</span> },
          ]} />
        )}
      </Panel>
    </div>
  );
}
