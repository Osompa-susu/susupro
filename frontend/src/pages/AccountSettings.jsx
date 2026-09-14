import React, { useState } from 'react';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useNotify } from '../context/NotificationContext.jsx';
import { Panel } from '../components/Panels.jsx';
import { Input } from '../components/FormControls.jsx';
import { ErrorBanner, SuccessBanner } from '../components/Feedback.jsx';
import Button from '../components/Button.jsx';

export default function AccountSettings() {
  const { user } = useAuth();
  const notify = useNotify();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [mfaSecret, setMfaSecret] = useState(null);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaError, setMfaError] = useState(null);
  const [mfaSuccess, setMfaSuccess] = useState(null);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableCode, setDisableCode] = useState('');

  async function submit(e) {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      await apiFetch('/api/auth/change-password', { method: 'POST', body: { currentPassword: current, newPassword: next } });
      notify('Password updated.');
      setCurrent(''); setNext('');
    } catch (err) {
      setError(err.error);
    } finally {
      setSubmitting(false);
    }
  }

  async function startMfaSetup() {
    setMfaError(null); setMfaSuccess(null);
    try {
      const result = await apiFetch('/api/auth/mfa/setup', { method: 'POST' });
      setMfaSecret(result.secret);
    } catch (err) { setMfaError(err.error); }
  }

  async function confirmMfa() {
    setMfaError(null);
    try {
      await apiFetch('/api/auth/mfa/confirm', { method: 'POST', body: { totpCode: mfaCode } });
      setMfaSuccess('MFA enabled. You will need a code from your authenticator app on every future login.');
      setMfaSecret(null);
      setMfaCode('');
    } catch (err) { setMfaError(err.error); }
  }

  async function disableMfa() {
    setMfaError(null);
    try {
      await apiFetch('/api/auth/mfa/disable', { method: 'POST', body: { currentPassword: disablePassword, totpCode: disableCode } });
      notify('MFA disabled.');
      setDisablePassword(''); setDisableCode('');
    } catch (err) { setMfaError(err.error); }
  }

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">{user.role === 'admin' ? 'Settings' : 'Profile'}</h1>
      <p className="mb-5 text-sm text-muted">Account details, password, and two-factor authentication.</p>

      <Panel className="max-w-md" title="My Account">
        <Input label="Name" value={user.fullName} disabled />
        <Input label="Staff code" value={user.staffCode} disabled />
      </Panel>

      <Panel className="max-w-md" title="Change Password">
        <ErrorBanner message={error} />
        <form onSubmit={submit}>
          <Input label="Current password" type="password" value={current} onChange={e => setCurrent(e.target.value)} />
          <Input label="New password (min. 10 characters)" type="password" value={next} onChange={e => setNext(e.target.value)} />
          <Button type="submit" loading={submitting}>Save Changes</Button>
        </form>
      </Panel>

      {user.role === 'admin' && (
        <Panel className="max-w-md" title="Two-Factor Authentication (MFA)">
          <p className="mb-3 text-sm text-muted">Strongly recommended for admin accounts — this is what stands between a leaked password and full financial control of the system.</p>
          <ErrorBanner message={mfaError} />
          <SuccessBanner message={mfaSuccess} />

          {!mfaSecret ? (
            <div className="space-y-3">
              <Button variant="gold" onClick={startMfaSetup}>Set Up MFA</Button>
              <div className="pt-3 border-t border-line">
                <p className="mb-2 text-xs text-muted">Already have MFA enabled and need to turn it off?</p>
                <Input label="Current password" type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} />
                <Input label="Authenticator code" value={disableCode} onChange={e => setDisableCode(e.target.value)} maxLength={6} />
                <Button variant="danger" onClick={disableMfa}>Disable MFA</Button>
              </div>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-sm">Enter this key manually into your authenticator app (Google Authenticator, Authy, etc.):</p>
              <p className="mb-3 rounded border border-line bg-paper p-2.5 font-mono text-sm break-all">{mfaSecret}</p>
              <Input label="Enter the 6-digit code it shows" value={mfaCode} onChange={e => setMfaCode(e.target.value)} maxLength={6} />
              <Button variant="gold" onClick={confirmMfa}>Confirm & Enable</Button>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
