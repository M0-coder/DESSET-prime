-- Local candidate only. Do not apply to hosted storage.
CREATE TABLE contact_maintenance_cycles(
 slot INTEGER PRIMARY KEY CHECK(slot>=0),
 token TEXT NOT NULL UNIQUE,
 observed_at INTEGER NOT NULL CHECK(observed_at>=0),
 policy_ref TEXT NOT NULL CHECK(length(policy_ref) BETWEEN 1 AND 128),
 capacity INTEGER NOT NULL CHECK(capacity BETWEEN 1 AND 10000),
 capacity_percent INTEGER NOT NULL CHECK(capacity_percent BETWEEN 1 AND 100),
 oldest_age_ms INTEGER NOT NULL CHECK(oldest_age_ms BETWEEN 1 AND 31536000000),
 expired_before INTEGER NOT NULL CHECK(expired_before>=0),
 expired_after INTEGER CHECK(expired_after>=0 AND expired_after<=expired_before),
 deleted INTEGER CHECK(deleted BETWEEN 0 AND 100),
 alert_mask INTEGER CHECK(alert_mask BETWEEN 0 AND 15),
 CHECK((deleted IS NULL AND expired_after IS NULL AND alert_mask IS NULL) OR (deleted IS NOT NULL AND expired_after IS NOT NULL AND alert_mask IS NOT NULL AND deleted=expired_before-expired_after))
);
