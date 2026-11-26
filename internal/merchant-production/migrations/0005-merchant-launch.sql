-- v5: launch authorization is independently persisted; default closed.
ALTER TABLE merchant_runtime ADD COLUMN launch_authorization_ref TEXT;
CREATE TABLE merchant_launch_events (
 id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, authorization_ref TEXT NOT NULL,
 intake_enabled INTEGER NOT NULL CHECK(intake_enabled IN (0,1)),
 notification_enabled INTEGER NOT NULL CHECK(notification_enabled IN (0,1)),
 activation_enabled INTEGER NOT NULL CHECK(activation_enabled IN (0,1)),
 created_at INTEGER NOT NULL
);
-- Intentionally no data mutation or production enablement in this migration.
