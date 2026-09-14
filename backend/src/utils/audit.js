// Every service that performs a sensitive action calls this. Centralizing
// it means a new feature can't "forget" to audit itself — code review
// just checks the call is present, per docs/security-requirements.md.
async function logAudit(dbClientOrPool, { actorUserId, action, entityType, entityId, details, ip }) {
  await dbClientOrPool.query(
    `INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id, details, ip_address)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [actorUserId || null, action, entityType || null, entityId || null, details ? JSON.stringify(details) : null, ip || null]
  );
}

async function logSecurityEvent(dbClientOrPool, { eventType, userId, ip, details }) {
  await dbClientOrPool.query(
    `INSERT INTO security_events (event_type, user_id, ip_address, details) VALUES ($1, $2, $3, $4)`,
    [eventType, userId || null, ip || null, details ? JSON.stringify(details) : null]
  );
}

module.exports = { logAudit, logSecurityEvent };
