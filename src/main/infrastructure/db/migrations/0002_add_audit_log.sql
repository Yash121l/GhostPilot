-- 0002_add_audit_log.sql
-- Audit log table with immutability triggers.
-- This table is APPEND-ONLY. No UPDATE or DELETE ever runs on it.

CREATE TABLE IF NOT EXISTS `audit_log` (
  `id` text PRIMARY KEY NOT NULL,
  `ts` integer NOT NULL,
  `actor` text NOT NULL,
  `action` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text,
  `before_hash` text,
  `after_hash` text,
  `ip` text NOT NULL DEFAULT 'local',
  `outcome` text NOT NULL CHECK(`outcome` IN ('success','failure','blocked')),
  `error_code` text,
  `details_json` text
);

-- Prevent any UPDATE on audit_log rows.
CREATE TRIGGER IF NOT EXISTS prevent_audit_update
  BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is immutable: UPDATE forbidden');
END;

-- Prevent any DELETE on audit_log rows.
CREATE TRIGGER IF NOT EXISTS prevent_audit_delete
  BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log is immutable: DELETE forbidden');
END;

-- Index for efficient time-range queries (Activity Log UI).
CREATE INDEX IF NOT EXISTS idx_audit_log_ts ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
