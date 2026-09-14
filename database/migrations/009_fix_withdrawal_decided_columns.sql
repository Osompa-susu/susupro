-- Migration 009: fix missing withdrawal_requests columns.
--
-- Found the hard way: this project reached 20 phases and a full
-- static code review before ANY of it touched a real database. The
-- first real test run against real PostgreSQL immediately surfaced
-- that ledgerService.js's decideWithdrawal() writes decided_by and
-- decided_at onto withdrawal_requests, but migration 005 never
-- actually created those columns. No amount of code review caught
-- this — only running it did. Left here as a permanent, honest record
-- of that, rather than folding it invisibly back into 005.

ALTER TABLE withdrawal_requests ADD COLUMN decided_by UUID REFERENCES users(id);
ALTER TABLE withdrawal_requests ADD COLUMN decided_at TIMESTAMPTZ;
