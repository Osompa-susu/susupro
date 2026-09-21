import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/Button.jsx';
import { Input } from '../components/FormControls.jsx';
import { ErrorBanner } from '../components/Feedback.jsx';

// Shown instead of the normal app when the backend reports
// forcePasswordChange: true — currently, every new worker/admin
// account after it's first created with a temporary password. The
// backend rejects every request except change-password/logout/me
// while this is pending, so this page is the only door out.
export default function ForcePasswordChange() {
  const { refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);

    if (next.length < 10) {
      setError('New password must be at least 10 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: { currentPassword: current, newPassword: next },
      });
      await refreshUser(); // forcePasswordChange is now false — this lets RequireAuth into the app
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.error);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-dark to-teal p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded border-t-4 border-gold bg-panel p-8">
        <h1 className="mb-1 text-base font-bold tracking-wide text-teal-dark">SUSUPRO</h1>
        <p className="mb-5 text-sm text-muted">
          You're signing in with a temporary password. Set a new one to continue.
        </p>
        <ErrorBanner message={error} />
        <Input
          label="Temporary password"
          type="password"
          value={current}
          onChange={e => setCurrent(e.target.value)}
          autoFocus
        />
        <Input
          label="New password (min. 10 characters)"
          type="password"
          value={next}
          onChange={e => setNext(e.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
        />
        <Button type="submit" loading={submitting} className="w-full">
          Set new password
        </Button>
        <button
          type="button"
          className="mt-3 w-full text-center text-xs text-muted underline"
          onClick={() => logout()}
        >
          Log out instead
        </button>
      </form>
    </div>
  );
}
