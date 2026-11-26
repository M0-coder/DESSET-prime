-- MERCHANT-PRODUCTION-01: D1 schema v1. Runtime state remains closed.
CREATE TABLE IF NOT EXISTS merchant_runtime (id INTEGER PRIMARY KEY CHECK(id=1), environment TEXT NOT NULL CHECK(environment IN ('staging','production')), intake_enabled INTEGER NOT NULL DEFAULT 0 CHECK(intake_enabled IN (0,1)), notification_enabled INTEGER NOT NULL DEFAULT 0 CHECK(notification_enabled IN (0,1)), privacy_version TEXT, CHECK(intake_enabled=0 OR privacy_version IS NOT NULL));
-- statement
INSERT INTO merchant_runtime(id,environment) VALUES(1,'staging') ON CONFLICT(id) DO NOTHING;
-- statement
CREATE TABLE IF NOT EXISTS merchant_requests (id TEXT PRIMARY KEY, request_key TEXT NOT NULL UNIQUE, payload_hash TEXT NOT NULL, identity_hash TEXT NOT NULL UNIQUE, business_name TEXT NOT NULL, category TEXT NOT NULL CHECK(category IN ('restaurant','grocery','bakery','specialty','pharmacy','other')), department TEXT NOT NULL, province TEXT NOT NULL, district TEXT NOT NULL, address TEXT NOT NULL, contact_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, observations TEXT, privacy_version TEXT NOT NULL, created_at INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED')), reviewed_by TEXT, reviewed_at INTEGER, CHECK((status='PENDING' AND reviewed_by IS NULL AND reviewed_at IS NULL) OR (status<>'PENDING' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)));
-- statement
CREATE INDEX IF NOT EXISTS merchant_requests_page ON merchant_requests(created_at,id);
-- statement
CREATE TABLE IF NOT EXISTS merchant_review_events (request_id TEXT PRIMARY KEY REFERENCES merchant_requests(id) ON DELETE CASCADE, actor_id TEXT NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('APPROVED','REJECTED')), created_at INTEGER NOT NULL);
-- statement
CREATE TABLE IF NOT EXISTS merchant_notification_outbox (request_id TEXT PRIMARY KEY REFERENCES merchant_requests(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','SENDING','SENT','NEEDS_REVIEW')), attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0), created_at INTEGER NOT NULL, lease_token TEXT, lease_until INTEGER, sent_at INTEGER, provider_message_id TEXT, CHECK((status='SENDING' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (status<>'SENDING' AND lease_token IS NULL AND lease_until IS NULL)));
-- statement
CREATE INDEX IF NOT EXISTS merchant_outbox_pending ON merchant_notification_outbox(status,created_at,request_id);
-- statement
CREATE TRIGGER IF NOT EXISTS merchant_request_outbox AFTER INSERT ON merchant_requests BEGIN INSERT INTO merchant_notification_outbox(request_id,created_at) VALUES(NEW.id,NEW.created_at); END;
-- statement
CREATE TRIGGER IF NOT EXISTS merchant_review_transition BEFORE UPDATE OF status ON merchant_requests WHEN NEW.status<>OLD.status AND (OLD.status<>'PENDING' OR NEW.status NOT IN ('APPROVED','REJECTED')) BEGIN SELECT RAISE(ABORT,'INVALID_TRANSITION'); END;
-- statement
CREATE TRIGGER IF NOT EXISTS merchant_review_audit AFTER UPDATE OF status ON merchant_requests WHEN NEW.status<>OLD.status BEGIN INSERT INTO merchant_review_events(request_id,actor_id,decision,created_at) VALUES(NEW.id,NEW.reviewed_by,NEW.status,NEW.reviewed_at); END;
