import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Button from '../components/Button.jsx';
import { Input } from '../components/FormControls.jsx';
import { ErrorBanner } from '../components/Feedback.jsx';

export default function Login() {
  const { login, authError, loading, user } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const [mfaError, setMfaError] = useState(null);

  if (user) navigate('/', { replace: true });

  async function handleSubmit(e) {
    e.preventDefault();
    setMfaError(null);
    try {
      const me = await login(phone, password, needsMfa ? totpCode : undefined);
      if (me) navigate('/', { replace: true });
    } catch (err) {
      if (err.code === 'MFA_REQUIRED') {
        setNeedsMfa(true);
      } else {
        setMfaError(err.error);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-teal-dark to-teal p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded border-t-4 border-gold bg-panel p-8">
        <h1 className="mb-1 text-base font-bold tracking-wide text-teal-dark">SUSUPRO</h1>
        <p className="mb-5 text-sm text-muted">{needsMfa ? 'Enter your 6-digit authenticator code' : 'Sign in to continue'}</p>
        <ErrorBanner message={authError || mfaError} />
        {!needsMfa ? (
          <>
            <Input label="Staff phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="024 000 0000" />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </>
        ) : (
          <Input label="Authenticator code" value={totpCode} onChange={e => setTotpCode(e.target.value)} placeholder="000000" maxLength={6} autoFocus />
        )}
        <Button type="submit" loading={loading} className="w-full">{needsMfa ? 'Verify' : 'Log in'}</Button>
        {needsMfa && (
          <button type="button" className="mt-3 text-xs text-muted underline" onClick={() => { setNeedsMfa(false); setTotpCode(''); }}>
            ← Back
          </button>
        )}
      </form>
    </div>
  );
}
