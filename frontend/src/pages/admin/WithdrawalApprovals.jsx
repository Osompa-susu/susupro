import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { Panel } from '../../components/Panels.jsx';
import { Skeleton, EmptyState, StatusPill, ErrorBanner } from '../../components/Feedback.jsx';
import DataTable from '../../components/DataTable.jsx';
import Button from '../../components/Button.jsx';
import { fmtGHS, fmtDate } from '../../utils/format.js';

export default function WithdrawalApprovals() {
  const [pending, setPending] = useState(null);
  const [decided, setDecided] = useState([]);
  const [loading, setLoading] = useState(true);
  const [decidingId, setDecidingId] = useState(null);
  const [rowError, setRowError] = useState({});

  function load() {
    setLoading(true);
    Promise.all([
      apiFetch('/api/withdrawals?status=pending'),
      apiFetch('/api/withdrawals'),
    ]).then(([p, all]) => { setPending(p); setDecided(all.filter(r => r.status !== 'pending').slice(0, 10)); }).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function decide(id, decision) {
    setDecidingId(id); setRowError(prev => ({ ...prev, [id]: null }));
    try {
      await apiFetch(`/api/withdrawals/${id}/decide`, { method: 'POST', body: { decision } });
      load();
    } catch (err) {
      setRowError(prev => ({ ...prev, [id]: err.error }));
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Withdrawals</h1>
      <p className="mb-5 text-sm text-muted">Requests are re-checked against the current balance at approval time.</p>
      <Panel title={`Pending${pending ? ` (${pending.length})` : ''}`}>
        {loading ? <Skeleton rows={2} /> : !pending || pending.length === 0 ? <EmptyState message="No pending withdrawal requests." /> : (
          <div className="space-y-3">
            {pending.map(r => (
              <div key={r.id} className="rounded border border-line p-3.5">
                <div className="mb-2"><div className="font-semibold">{r.customer_name} — {fmtGHS(r.amount)}</div>
                  <div className="text-xs text-muted">Requested by {r.requested_by_name} on {fmtDate(r.created_at)} · Current balance: {fmtGHS(r.current_balance)}{Number(r.current_balance) < Number(r.amount) && ' ⚠ insufficient now'}</div></div>
                <ErrorBanner message={rowError[r.id]} />
                <div className="flex gap-2.5">
                  <Button variant="gold" loading={decidingId === r.id} disabled={Number(r.current_balance) < Number(r.amount)} onClick={() => decide(r.id, 'approve')} className="flex-1 sm:flex-none">Approve</Button>
                  <Button variant="danger" loading={decidingId === r.id} onClick={() => decide(r.id, 'reject')} className="flex-1 sm:flex-none">Reject</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Recently Decided">
        {decided.length === 0 ? <EmptyState message="No decisions yet." /> : (
          <DataTable keyField="id" rows={decided} columns={[
            { key: 'customer_name', label: 'Customer' },
            { key: 'amount', label: 'Amount', render: r => <span className="num">{fmtGHS(r.amount)}</span> },
            { key: 'requested_by_name', label: 'Requested by' },
            { key: 'status', label: 'Decision', render: r => <StatusPill status={r.status} /> },
          ]} />
        )}
      </Panel>
    </div>
  );
}
