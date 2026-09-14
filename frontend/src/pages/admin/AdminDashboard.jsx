import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { Panel, StatCard, StatCardRow } from '../../components/Panels.jsx';
import { Skeleton, ErrorBanner, EmptyState } from '../../components/Feedback.jsx';
import DataTable from '../../components/DataTable.jsx';
import { fmtGHS, fmtDate } from '../../utils/format.js';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true); setError(null);
    apiFetch('/api/reports/dashboard').then(setStats).catch(err => setError(err.error)).finally(() => setLoading(false));
  }
  useEffect(load, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Dashboard</h1>
      <p className="mb-5 text-sm text-muted">Business-wide overview, live from the server. Every figure here comes from the backend — nothing is hardcoded.</p>
      <ErrorBanner message={error} onRetry={load} />
      {loading ? <Skeleton rows={2} /> : stats && (
        <StatCardRow>
          <StatCard label="Total Customers" value={stats.totalCustomers} />
          <StatCard label="Total Savings" value={fmtGHS(stats.totalSavings)} gold />
          <StatCard label="Today's Deposits" value={fmtGHS(stats.todaysDeposits)} gold />
          <StatCard label="Today's Withdrawals" value={fmtGHS(stats.todaysWithdrawals)} gold />
          <StatCard label="Active Workers" value={stats.activeWorkers} />
          <StatCard label="Pending Withdrawals" value={stats.pendingWithdrawals} />
        </StatCardRow>
      )}
      <Panel title="Recent Transactions">
        {loading ? <Skeleton rows={5} /> : !stats ? null : stats.recentTransactions.length === 0 ? (
          <EmptyState message="No transactions yet." />
        ) : (
          <DataTable keyField="transaction_code" rows={stats.recentTransactions} columns={[
            { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
            { key: 'entry_type', label: 'Type', render: r => <span className="capitalize">{r.entry_type}</span> },
            { key: 'customer_name', label: 'Customer' },
            { key: 'signed_amount', label: 'Amount', render: r => <span className={`num ${r.signed_amount < 0 ? 'text-bad' : 'text-good'}`}>{fmtGHS(r.signed_amount)}</span> },
            { key: 'worker_name', label: 'Worker' },
            { key: 'transaction_code', label: 'Txn ID' },
          ]} />
        )}
      </Panel>
    </div>
  );
}
