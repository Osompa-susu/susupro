import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { Panel } from '../components/Panels.jsx';
import { EmptyState, ErrorBanner, SuccessBanner, StatusPill } from '../components/Feedback.jsx';
import DataTable from '../components/DataTable.jsx';
import { Input } from '../components/FormControls.jsx';
import Button from '../components/Button.jsx';
import { fmtGHS, fmtDate } from '../utils/format.js';

export default function WithdrawRequest() {
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [myRequests, setMyRequests] = useState(null);

  function loadRequests() {
    apiFetch('/api/transactions/mine').then(d => setMyRequests(d.myWithdrawalRequests)).catch(err => setError(err.error));
  }
  useEffect(loadRequests, []);
  useEffect(() => {
    const pre = params.get('customer');
    if (pre) apiFetch(`/api/customers/${pre}`).then(d => setSelected(d.customer)).catch(() => {});
  }, [params]);

  let debounce;
  function search(q) {
    setQuery(q);
    clearTimeout(debounce);
    if (!q.trim()) return setResults([]);
    debounce = setTimeout(() => {
      apiFetch(`/api/customers/search?q=${encodeURIComponent(q)}`).then(d => setResults(d.results.filter(c => c.status === 'active'))).catch(err => setError(err.error));
    }, 250);
  }

  async function submit() {
    setSubmitting(true); setError(null);
    try {
      await apiFetch('/api/withdrawals/request', { method: 'POST', body: { customerCode: selected.customer_code, amount: Number(amount) } });
      setSuccess('Submitted for admin approval.');
      setSelected(null); setQuery(''); setAmount('');
      loadRequests();
    } catch (err) {
      setError(err.error);
    } finally {
      setSubmitting(false);
    }
  }

  const numericAmount = parseFloat(amount);
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Request Withdrawal</h1>
      <p className="mb-5 text-sm text-muted">Your request goes to the admin for approval before funds are released.</p>
      <Panel className="max-w-lg">
        <SuccessBanner message={success} />
        <input value={query} onChange={e => search(e.target.value)} placeholder="Search by name, phone, or ID..." className="mb-3 w-full rounded border border-line px-3.5 py-2.5 text-sm outline-none focus:border-teal" />
        {results.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {results.map(c => (
              <button key={c.customer_code} onClick={() => { setSelected(c); setResults([]); setQuery(c.full_name); }} className="flex w-full items-center justify-between rounded border border-line p-2.5 text-left text-sm hover:border-teal">
                <span>{c.full_name}</span><span className="num">{fmtGHS(c.balance)}</span>
              </button>
            ))}
          </div>
        )}
        {selected && (
          <>
            <div className="mb-3 rounded border border-gold bg-gold-soft p-3.5 text-sm">
              <div className="flex justify-between"><span>Current balance</span><strong className="num">{fmtGHS(selected.balance)}</strong></div>
              <div className="flex justify-between"><span>Maximum withdrawable</span><strong className="num">{fmtGHS(Math.max(0, Number(selected.balance) - 50))}</strong></div>
              <p className="mt-1.5 text-xs text-muted">A minimum balance of GHS 50.00 must always remain in the account.</p>
            </div>
            <Input label="Withdrawal amount (GHS)" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            <ErrorBanner message={error} />
            <Button loading={submitting} disabled={!numericAmount || numericAmount <= 0} onClick={submit}>Submit Request to Admin</Button>
          </>
        )}
      </Panel>
      <Panel title="My Pending Requests">
        {!myRequests ? null : myRequests.length === 0 ? <EmptyState message="No withdrawal requests yet." /> : (
          <DataTable keyField="id" rows={myRequests} columns={[
            { key: 'created_at', label: 'Date', render: r => fmtDate(r.created_at) },
            { key: 'customer_name', label: 'Customer' },
            { key: 'amount', label: 'Amount', render: r => <span className="num">{fmtGHS(r.amount)}</span> },
            { key: 'status', label: 'Status', render: r => <StatusPill status={r.status} /> },
          ]} />
        )}
      </Panel>
    </div>
  );
}
