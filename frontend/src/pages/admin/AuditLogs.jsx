import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../api/client.js';
import { Panel } from '../../components/Panels.jsx';
import { Skeleton, EmptyState, ErrorBanner } from '../../components/Feedback.jsx';
import { fmtDate } from '../../utils/format.js';

export default function AuditLogs() {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState(null);

  function load() {
    apiFetch('/api/audit-logs?limit=60').then(setLogs).catch(err => setError(err.error));
  }
  useEffect(load, []);

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold text-teal-dark">Audit Logs <span className="ml-2 rounded-full bg-teal-dark px-2 py-0.5 text-xs text-gold-soft">Append-only</span></h1>
      <p className="mb-5 text-sm text-muted">Every sensitive action is recorded here. Nothing here can be edited or deleted.</p>
      <ErrorBanner message={error} onRetry={load} />
      <Panel>
        {!logs ? <Skeleton rows={8} /> : logs.length === 0 ? <EmptyState message="No audit events yet." /> : (
          <div className="space-y-2">
            {logs.map((l, i) => (
              <div key={i} className="rounded border border-line p-3 text-sm">
                <div className="flex justify-between"><span className="font-semibold">{l.action}</span><span className="text-muted">{fmtDate(l.created_at)}</span></div>
                <div className="text-xs text-muted">{l.actor_name || 'System'} {l.details && Object.keys(l.details).length > 0 && `· ${JSON.stringify(l.details)}`}</div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
