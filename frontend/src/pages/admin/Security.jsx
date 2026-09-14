import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiFetch } from '../../api/client.js';
import { Panel, StatCard, StatCardRow } from '../../components/Panels.jsx';
import { Skeleton, EmptyState, ErrorBanner } from '../../components/Feedback.jsx';
import { fmtDate } from '../../utils/format.js';

export default function Security() {
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    apiFetch('/api/security/summary').then(setSummary).catch(err => setError(err.error));
  }
  useEffect(load, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Security</h1>
      <p className="mb-5 text-sm text-muted">The security posture surfaced to the admin — see docs/security-requirements.md for the full standard this is checked against.</p>
      <ErrorBanner message={error} onRetry={load} />
      {!summary ? <Skeleton rows={2} /> : (
        <StatCardRow>
          <StatCard label="Failed Logins (24h)" value={summary.failedLoginsLast24h} />
          <StatCard label="Suspended/Deactivated Accounts" value={summary.suspendedOrDeactivatedAccounts} />
          <StatCard label="Active Sessions" value={summary.activeSessions} gold />
        </StatCardRow>
      )}
      <Panel title="Backup Status">
        <p className="text-sm text-muted">{summary ? summary.backupStatus : '—'}</p>
      </Panel>
      <Panel title="Recent Sensitive Actions">
        {!summary ? <Skeleton rows={4} /> : summary.sensitiveActions.length === 0 ? <EmptyState message="No sensitive actions yet." /> : (
          summary.sensitiveActions.map((a, i) => <div key={i} className="rounded border border-line p-3 text-sm mb-2"><div>{a.action} — {a.actor_name || 'System'}</div><div className="text-xs text-muted">{fmtDate(a.created_at)}</div></div>)
        )}
      </Panel>
      <Link to="/audit-logs" className="text-sm text-teal underline">View full audit log →</Link>
    </div>
  );
}
