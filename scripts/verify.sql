-- Run against a freshly restored database (never production) as part
-- of both the monthly drill and any real recovery. A backup is not
-- considered successful merely because a backup file exists — this is
-- the test that decides whether it can be trusted.

-- 1. The core financial invariant, per-account, not just spot-checked.
SELECT a.id AS account_id, ab.balance AS view_balance, COALESCE(SUM(le.signed_amount), 0) AS manual_sum
FROM accounts a
LEFT JOIN account_balances ab ON ab.account_id = a.id
LEFT JOIN ledger_entries le ON le.account_id = a.id AND le.status = 'completed'
GROUP BY a.id, ab.balance
HAVING ab.balance != COALESCE(SUM(le.signed_amount), 0) OR ab.balance IS NULL;
-- Expect ZERO rows. Any row means the restore is corrupt or incomplete.

-- 2. No orphaned ledger entries.
SELECT COUNT(*) AS orphaned_ledger_entries FROM ledger_entries le
LEFT JOIN accounts a ON a.id = le.account_id WHERE a.id IS NULL;
-- Expect 0.

-- 3. Row counts sanity check (compare against a metadata snapshot
-- taken at backup time — recording that snapshot alongside each
-- backup file is a recommended next addition, tracked as open).
SELECT (SELECT COUNT(*) FROM customers) AS customers,
       (SELECT COUNT(*) FROM ledger_entries) AS ledger_entries,
       (SELECT COUNT(*) FROM audit_logs) AS audit_logs,
       (SELECT COUNT(*) FROM users) AS users;

-- 4. Immutability triggers survived the restore intact.
SELECT tgname, tgrelid::regclass AS table_name, tgenabled FROM pg_trigger
WHERE tgname LIKE 'trg_%' ORDER BY table_name;
-- Expect all trg_ledger_*, trg_audit_*, trg_security_events_*, and
-- trg_check_balance present and enabled ('O').
