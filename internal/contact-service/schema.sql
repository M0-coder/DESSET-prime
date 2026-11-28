PRAGMA foreign_keys=ON;
CREATE TABLE contact_requests(
 id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, payload_hash TEXT NOT NULL,
 category TEXT NOT NULL CHECK(category IN ('alianzas','inversion','marketing','prensa','instituciones','profesionales','legal','seguridad','otras')),
 person TEXT NOT NULL, email TEXT NOT NULL, organization TEXT, phone TEXT,
 subject TEXT NOT NULL, message TEXT NOT NULL, privacy_version TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(state IN ('RECEIVED','IN_REVIEW','CLOSED')),
 version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL CHECK(expires_at>created_at),
 CHECK(length(person)<=100 AND length(email)<=150 AND length(subject)<=120 AND length(message)<=2000)
);
CREATE INDEX contact_queue ON contact_requests(category,state,created_at);
CREATE INDEX contact_expiry ON contact_requests(expires_at);
CREATE TABLE contact_events(
 request_id TEXT NOT NULL REFERENCES contact_requests(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, actor TEXT NOT NULL, from_state TEXT NOT NULL, to_state TEXT NOT NULL, at INTEGER NOT NULL,
 PRIMARY KEY(request_id,version)
);
CREATE TRIGGER contact_transition BEFORE UPDATE OF state,version ON contact_requests
WHEN NOT(NEW.version=OLD.version+1 AND ((OLD.state='RECEIVED' AND NEW.state='IN_REVIEW') OR (OLD.state='IN_REVIEW' AND NEW.state='CLOSED')))
BEGIN SELECT RAISE(ABORT,'INVALID_TRANSITION'); END;
