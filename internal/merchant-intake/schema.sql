CREATE TABLE IF NOT EXISTS merchant_requests (
 id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL,
 business_name TEXT NOT NULL, category TEXT NOT NULL, department TEXT NOT NULL,
 province TEXT NOT NULL, district TEXT NOT NULL, address TEXT NOT NULL,
 contact_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL,
 privacy_version TEXT NOT NULL, created_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED'))
);
CREATE TABLE IF NOT EXISTS merchant_review_events (
 id INTEGER PRIMARY KEY, request_id TEXT NOT NULL REFERENCES merchant_requests(id) ON DELETE CASCADE,
 actor_id TEXT NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('APPROVED','REJECTED')), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS merchant_notification_outbox (
 request_id TEXT PRIMARY KEY REFERENCES merchant_requests(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENT')),
 attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, sent_at TEXT
);

CREATE TABLE IF NOT EXISTS merchant_identity_keys (
 identity_hash TEXT PRIMARY KEY, request_id TEXT NOT NULL UNIQUE REFERENCES merchant_requests(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS merchant_notification_leases (
 request_id TEXT PRIMARY KEY REFERENCES merchant_notification_outbox(request_id) ON DELETE CASCADE,
 token TEXT NOT NULL, expires_at INTEGER NOT NULL
);
