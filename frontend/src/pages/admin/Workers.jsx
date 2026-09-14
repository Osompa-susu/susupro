import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { Panel } from '../../components/Panels.jsx';
import { Skeleton, StatusPill, ErrorBanner, EmptyState } from '../../components/Feedback.jsx';
import DataTable from '../../components/DataTable.jsx';
import Button from '../../components/Button.jsx';
import { Input } from '../../components/FormControls.jsx';
import Modal from '../../components/Modal.jsx';

export default function Workers() {
  const notify = useNotify();
  const [workers, setWorkers] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ fullName: '', phone: '', temporaryPassword: '' });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch('/api/workers').then(d => setWorkers(d.workers)).catch(err => setError(err.error));
  }
  useEffect(load, []);

  async function addWorker(e) {
    e.preventDefault();
    setSubmitting(true); setFormError(null);
    try {
      await apiFetch('/api/workers', { method: 'POST', body: form });
      notify('Worker added.');
      setForm({ fullName: '', phone: '', temporaryPassword: '' });
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(Array.isArray(err.error) ? 'Check the form.' : err.error);
    } finally {
      setSubmitting(false);
    }
  }
  async function setStatus(id, status) {
    try { await apiFetch(`/api/workers/${id}/status`, { method: 'PATCH', body: { status } }); notify(`Status updated to ${status}`); load(); }
    catch (err) { notify(err.error, 'error'); }
  }
  async function resetPassword(id) {
    const temp = prompt('New temporary password (min. 10 characters):');
    if (!temp) return;
    try { await apiFetch(`/api/workers/${id}/reset-password`, { method: 'POST', body: { temporaryPassword: temp } }); notify('Password reset.'); }
    catch (err) { notify(err.error, 'error'); }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-teal-dark">Workers</h1><p className="text-sm text-muted">Manage collection agents and their access.</p></div>
        <Button variant="gold" onClick={() => setModalOpen(true)}>Add Worker</Button>
      </div>
      <ErrorBanner message={error} onRetry={load} />
      <Panel>
        {!workers ? <Skeleton rows={4} /> : workers.length === 0 ? <EmptyState message="No workers yet." /> : (
          <DataTable keyField="id" rows={workers} columns={[
            { key: 'staff_code', label: 'Staff Code' }, { key: 'full_name', label: 'Name' }, { key: 'phone', label: 'Phone' },
            { key: 'status', label: 'Status', render: w => <StatusPill status={w.status} /> },
            { key: 'actions', label: 'Actions', render: w => (
              <div className="flex flex-wrap gap-1.5">
                {w.status !== 'active' && <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(w.id, 'active')}>Activate</Button>}
                {w.status === 'active' && <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(w.id, 'suspended')}>Suspend</Button>}
                {w.status !== 'deactivated' && <Button variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(w.id, 'deactivated')}>Deactivate</Button>}
                <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => resetPassword(w.id)}>Reset Password</Button>
              </div>
            ) },
          ]} />
        )}
      </Panel>
      <Modal open={modalOpen} title="Add Worker" onClose={() => setModalOpen(false)}>
        <ErrorBanner message={formError} />
        <form onSubmit={addWorker}>
          <Input label="Full name" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} />
          <Input label="Phone" required value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input label="Temporary password (min. 10 chars)" required value={form.temporaryPassword} onChange={e => setForm({ ...form, temporaryPassword: e.target.value })} />
          <Button type="submit" loading={submitting} className="w-full">Add Worker</Button>
        </form>
      </Modal>
    </div>
  );
}
