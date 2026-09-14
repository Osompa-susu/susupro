import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { Panel } from '../components/Panels.jsx';
import { Input, Select } from '../components/FormControls.jsx';
import { ErrorBanner } from '../components/Feedback.jsx';
import Button from '../components/Button.jsx';

export default function CustomerRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', phone: '', community: '', savingsPlan: 'standard' });
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const customer = await apiFetch('/api/customers', { method: 'POST', body: form });
      navigate(`/customers/${customer.customer_code}`);
    } catch (err) {
      setError(Array.isArray(err.error) ? 'Check the form — some fields are invalid.' : err.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Register Customer</h1>
      <p className="mb-5 text-sm text-muted">Only the minimum information needed is collected.</p>
      <Panel className="max-w-lg">
        <ErrorBanner message={error} />
        <form onSubmit={handleSubmit}>
          <div className="grid gap-x-4 sm:grid-cols-2">
            <Input label="Full name" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
            <Input label="Phone number" required placeholder="024 000 0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Community / Address" value={form.community} onChange={e => setForm({ ...form, community: e.target.value })} />
            <Select label="Savings plan" value={form.savingsPlan} onChange={e => setForm({ ...form, savingsPlan: e.target.value })}>
              <option value="standard">Standard</option>
              <option value="flexible">Flexible</option>
            </Select>
          </div>
          <Button type="submit" loading={submitting}>Register Customer</Button>
        </form>
      </Panel>
    </div>
  );
}
