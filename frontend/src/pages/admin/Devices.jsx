import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { useNotify } from '../../context/NotificationContext.jsx';
import { Panel } from '../../components/Panels.jsx';
import { Skeleton, StatusPill, ErrorBanner, EmptyState } from '../../components/Feedback.jsx';
import DataTable from '../../components/DataTable.jsx';
import Button from '../../components/Button.jsx';
import { Input } from '../../components/FormControls.jsx';
import Modal from '../../components/Modal.jsx';

// NOTE: device registration/assignment is Phase 16 functionality.
// This page's UI is scaffolded now per the Phase 4 requirement to
// establish the full admin page structure up front; it will show a
// "couldn't load" error until Phase 16 implements the /api/devices
// endpoints this page calls.
export default function Devices() {
  const notify = useNotify();
  const [devices, setDevices] = useState(null);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ deviceCode: '', label: '' });

  function load() {
    apiFetch('/api/devices').then(d => setDevices(d.devices)).catch(err => setError(err.error));
  }
  useEffect(load, []);

  async function addDevice(e) {
    e.preventDefault();
    try { await apiFetch('/api/devices', { method: 'POST', body: form }); notify('Device registered.'); setModalOpen(false); load(); }
    catch (err) { notify(err.error, 'error'); }
  }
  async function setStatus(id, status) {
    try { await apiFetch(`/api/devices/${id}/status`, { method: 'PATCH', body: { status } }); notify('Device status updated.'); load(); }
    catch (err) { notify(err.error, 'error'); }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div><h1 className="text-xl font-semibold text-teal-dark">Devices</h1><p className="text-sm text-muted">Register and manage worker tablets (Phase 16).</p></div>
        <Button variant="gold" onClick={() => setModalOpen(true)}>Register Device</Button>
      </div>
      <ErrorBanner message={error} onRetry={load} />
      <Panel>
        {!devices ? (error ? <EmptyState message="Device management isn't available yet — see Phase 16." /> : <Skeleton rows={3} />) : devices.length === 0 ? (
          <EmptyState message="No devices registered yet." />
        ) : (
          <DataTable keyField="id" rows={devices} columns={[
            { key: 'device_code', label: 'Device Code' }, { key: 'label', label: 'Label' }, { key: 'assigned_to_name', label: 'Assigned To' },
            { key: 'status', label: 'Status', render: d => <StatusPill status={d.status} /> },
            { key: 'actions', label: 'Actions', render: d => (
              d.status === 'active'
                ? <Button variant="danger" className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(d.id, 'deactivated')}>Deactivate</Button>
                : <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => setStatus(d.id, 'active')}>Reactivate</Button>
            ) },
          ]} />
        )}
      </Panel>
      <Modal open={modalOpen} title="Register Device" onClose={() => setModalOpen(false)}>
        <form onSubmit={addDevice}>
          <Input label="Device code (e.g. TAB-001)" required value={form.deviceCode} onChange={e => setForm({ ...form, deviceCode: e.target.value })} />
          <Input label="Label (e.g. Kofi's tablet)" value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} />
          <Button type="submit" className="w-full">Register</Button>
        </form>
      </Modal>
    </div>
  );
}
