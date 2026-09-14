import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotify } from '../context/NotificationContext.jsx';
import { Panel, StatCard, StatCardRow } from '../components/Panels.jsx';
import { Skeleton, ErrorBanner, EmptyState } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import Button from '../components/Button.jsx';
import Modal from '../components/Modal.jsx';
import { Input } from '../components/FormControls.jsx';
import { fmtGHS, fmtDate } from '../utils/format.js';

export default function CustomerProfile() {
  const { customerCode } = useParams();
  const { user } = useAuth();
  const notify = useNotify();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [correctionTarget, setCorrectionTarget] = useState(null);
  const [correctedAmount, setCorrectedAmount] = useState('');
  const [reason, setReason] = useState('');
  const [correctionError, setCorrectionError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    setLoading(true); setError(null);
    apiFetch(`/api/customers/${customerCode}`).then(setData).catch(err => setError(err.error)).finally(() => setLoading(false));
  }
  useEffect(load, [customerCode]);

  function openCorrection(row) {
    setCorrectionTarget(row);
    setCorrectedAmount(String(row.signed_amount));
    setReason('');
    setCorrectionError(null);
  }

  async function submitCorrection() {
    setSubmitting(true); setCorrectionError(null);
    try {
      await apiFetch('/api/transactions/corrections', {
        method: 'POST',
        body: { originalTransactionCode: correctionTarget.transaction_code, correctedAmount: Number(correctedAmount), reason },
      });
      notify('Correction applied.');
      setCorrectionTarget(null);
      load();
    } catch (err) {
      setCorrectionError(Array.isArray(err.error) ? 'Check the form.' : err.error);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Skeleton rows={6} />;
  if (error) return (
    <div>
      <ErrorBanner message={error} onRetry={load} />
      <Link to="/customers" className="text-sm text-teal underline">← Back to Customers</Link>
    </div>
  );

  const { customer: c, history } = data;
  const deposits = history.filter(h => h.entry_type === 'deposit').reduce((s, h) => s + Number(h.signed_amount), 0);
  const withdrawals = Math.abs(history.filter(h => h.entry_type === 'withdrawal').reduce((s, h) => s + Number(h.signed_amount), 0));
  const isAdmin = user.role === 'admin';

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">{c.full_name}</h1>
      <p className="mb-5 text-sm text-muted">{c.customer_code} · {c.phone} · {c.community || '—'} · Registered {fmtDate(c.created_at)}</p>
      <StatCardRow>
        <StatCard label="Current Balance" value={fmtGHS(c.balance)} gold />
        <StatCard label="Total Deposited" value={fmtGHS(deposits)} />
        <StatCard label="Total Withdrawn" value={fmtGHS(withdrawals)} />
        <StatCard label="Status" value={c.status} />
      </StatCardRow>
      <div className="mb-5 flex gap-3">
        <Link to={`/deposit?customer=${c.customer_code}`}><Button variant="gold">Record Deposit</Button></Link>
        <Link to={`/withdraw?customer=${c.customer_code}`}><Button variant="ghost">Request Withdrawal</Button></Link>
      </div>
      <Panel title="Transaction History">
        {history.length === 0 ? <EmptyState message="No transactions yet for this customer." /> : (
          <DataTable keyField="transaction_code" rows={history} columns={[
            { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
            { key: 'entry_type', label: 'Type', render: r => <span className="capitalize">{r.entry_type}</span> },
            { key: 'signed_amount', label: 'Amount', render: r => <span className={`num ${r.signed_amount < 0 ? 'text-bad' : 'text-good'}`}>{fmtGHS(r.signed_amount)}</span> },
            { key: 'worker_name', label: 'Worker' },
            { key: 'transaction_code', label: 'Txn ID' },
            ...(isAdmin ? [{ key: 'actions', label: '', render: r => r.entry_type !== 'correction'
              ? <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => openCorrection(r)}>Correct</Button>
              : null }] : []),
          ]} />
        )}
      </Panel>
      <Link to="/customers" className="text-sm text-teal underline">← Back to Customers</Link>

      <Modal open={!!correctionTarget} title="Correct Transaction" onClose={() => setCorrectionTarget(null)}>
        {correctionTarget && (
          <>
            <p className="mb-3 text-sm text-muted">
              Original: <strong className="num">{fmtGHS(correctionTarget.signed_amount)}</strong> ({correctionTarget.transaction_code}).
              This will not edit the original — it records a linked correction so the history stays auditable.
            </p>
            <ErrorBanner message={correctionError} />
            <Input label="Corrected amount (GHS)" type="number" step="0.01" value={correctedAmount} onChange={e => setCorrectedAmount(e.target.value)} />
            <Input label="Reason (required)" value={reason} onChange={e => setReason(e.target.value)} />
            <Button loading={submitting} disabled={!reason.trim() || reason.trim().length < 5} onClick={submitCorrection} className="w-full">Apply Correction</Button>
          </>
        )}
      </Modal>
    </div>
  );
}
