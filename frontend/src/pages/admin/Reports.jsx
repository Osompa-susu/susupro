import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { Panel, StatCard, StatCardRow } from '../../components/Panels.jsx';
import { Skeleton, EmptyState, ErrorBanner } from '../../components/Feedback.jsx';
import DataTable from '../../components/DataTable.jsx';
import { fmtGHS } from '../../utils/format.js';

export default function Reports() {
  const [summary, setSummary] = useState(null);
  const [byWorker, setByWorker] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    Promise.all([apiFetch('/api/reports/summary'), apiFetch('/api/reports/by-worker')])
      .then(([s, w]) => { setSummary(s); setByWorker(w); })
      .catch(err => setError(err.error));
  }
  useEffect(load, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Reports</h1>
      <p className="mb-5 text-sm text-muted">Computed live from the transaction ledger.</p>
      <ErrorBanner message={error} onRetry={load} />
      <Panel title="Daily Collection Report">
        {!summary ? <Skeleton rows={1} /> : (
          <StatCardRow>
            <StatCard label="Total Deposits" value={fmtGHS(summary.deposits)} gold />
            <StatCard label="Total Withdrawals" value={fmtGHS(summary.withdrawals)} />
            <StatCard label="Net Movement" value={fmtGHS(summary.net)} gold />
            <StatCard label="Transactions" value={summary.transaction_count} />
            <StatCard label="Active Workers" value={summary.activeWorkers} />
          </StatCardRow>
        )}
      </Panel>
      <Panel title="Worker Collection Report (all-time)">
        {!byWorker ? <Skeleton rows={3} /> : byWorker.length === 0 ? <EmptyState message="No data yet." /> : (
          <DataTable keyField="worker_id" rows={byWorker} columns={[
            { key: 'worker_name', label: 'Worker' },
            { key: 'total_collected', label: 'Total Deposits Collected', render: r => <span className="num">{fmtGHS(r.total_collected)}</span> },
          ]} />
        )}
      </Panel>
    </div>
  );
}
