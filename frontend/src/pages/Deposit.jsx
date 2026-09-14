import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { apiFetch, genIdempotencyKey } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Panel } from '../components/Panels.jsx';
import { EmptyState, ErrorBanner, SuccessBanner } from '../components/Feedback.jsx';
import { Input } from '../components/FormControls.jsx';
import Button from '../components/Button.jsx';
import { fmtGHS } from '../utils/format.js';

export default function Deposit() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const pre = params.get('customer');
    if (pre) apiFetch(`/api/customers/${pre}`).then(d => setSelected({ ...d.customer, full_name: d.customer.full_name, customer_code: d.customer.customer_code, balance: d.customer.balance })).catch(() => {});
  }, [params]);

  let debounce;
  function search(q) {
    setQuery(q); setSuccess(null);
    clearTimeout(debounce);
    if (!q.trim()) return setResults([]);
    debounce = setTimeout(() => {
      apiFetch(`/api/customers/search?q=${encodeURIComponent(q)}`).then(d => setResults(d.results.filter(c => c.status === 'active'))).catch(err => setError(err.error));
    }, 250);
  }
  function select(c) { setSelected(c); setResults([]); setQuery(c.full_name); }

  async function submit() {
    setSubmitting(true); setError(null);
    try {
      const result = await apiFetch('/api/transactions/deposit', { method: 'POST', body: { customerCode: selected.customer_code, amount: Number(amount), idempotencyKey: genIdempotencyKey() } });
      setSuccess(`Transaction ${result.transaction.transaction_code} completed. New balance: ${fmtGHS(result.newBalance)}`);
      setSelected(null); setQuery(''); setAmount('');
    } catch (err) {
      setError(err.error);
    } finally {
      setSubmitting(false);
    }
  }

  const numericAmount = parseFloat(amount);
  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Record Deposit</h1>
      <p className="mb-5 text-sm text-muted">Search for the customer, then enter the amount collected.</p>
      <Panel className="max-w-lg">
        <SuccessBanner message={success} />
        <input value={query} onChange={e => search(e.target.value)} placeholder="Search by name, phone, or ID..." className="mb-3 w-full rounded border border-line px-3.5 py-2.5 text-sm outline-none focus:border-teal" />
        {results.length > 0 && (
          <div className="mb-3 space-y-1.5">
            {results.map(c => (
              <button key={c.customer_code} onClick={() => select(c)} className="flex w-full items-center justify-between rounded border border-line p-2.5 text-left text-sm hover:border-teal">
                <span>{c.full_name} <span className="text-muted">({c.customer_code})</span></span>
                <span className="num">{fmtGHS(c.balance)}</span>
              </button>
            ))}
          </div>
        )}
        {query && results.length === 0 && !selected && <EmptyState message="No matching active customers." />}
        {selected && (
          <>
            <div className="mb-3 rounded border border-gold bg-gold-soft p-3.5 text-sm">
              <div className="flex justify-between py-0.5"><span>Customer</span><strong>{selected.full_name} ({selected.customer_code})</strong></div>
              <div className="flex justify-between py-0.5"><span>Current balance</span><strong className="num">{fmtGHS(selected.balance)}</strong></div>
            </div>
            <Input label="Deposit amount (GHS)" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} />
            {numericAmount > 0 && (
              <div className="mb-3 rounded border border-gold bg-gold-soft p-3.5 text-sm">
                <div className="flex justify-between py-0.5"><span>New balance</span><span className="num">{fmtGHS(Number(selected.balance) + numericAmount)}</span></div>
                <div className="flex justify-between py-0.5"><span>Recorded by</span><span>{user.fullName}</span></div>
              </div>
            )}
            <ErrorBanner message={error} />
            <Button variant="gold" loading={submitting} disabled={!numericAmount || numericAmount <= 0} onClick={submit}>Confirm Deposit</Button>
          </>
        )}
      </Panel>
    </div>
  );
}
