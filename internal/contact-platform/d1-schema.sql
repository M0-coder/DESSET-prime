-- Independent D1 candidate schema. Apply only to a dedicated empty database.
CREATE TABLE contact_requests(
 id TEXT PRIMARY KEY, request_key TEXT UNIQUE NOT NULL, payload_hash TEXT NOT NULL CHECK(length(payload_hash)=64),
 category TEXT NOT NULL CHECK(category IN ('alianzas','inversion','marketing','prensa','instituciones','profesionales','legal','seguridad','otras')),
 person TEXT NOT NULL CHECK(length(person) BETWEEN 1 AND 100),
 email TEXT NOT NULL CHECK(length(email) BETWEEN 3 AND 150),
 organization TEXT NOT NULL CHECK(length(organization)<=120),
 phone TEXT NOT NULL CHECK(length(phone)<=30),
 subject TEXT NOT NULL CHECK(length(subject) BETWEEN 1 AND 120),
 message TEXT NOT NULL CHECK(length(message) BETWEEN 1 AND 2000),
 privacy_version TEXT NOT NULL,
 privacy_sha256 TEXT NOT NULL CHECK(length(privacy_sha256)=64),
 authorization_ref TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'RECEIVED' CHECK(state IN ('RECEIVED','IN_REVIEW','CLOSED')),
 version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),
 last_actor TEXT, last_transition_at INTEGER,
 created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL CHECK(expires_at>created_at)
);
CREATE INDEX contact_queue ON contact_requests(category,state,created_at,id);
CREATE INDEX contact_expiry ON contact_requests(expires_at);
CREATE TABLE contact_events(
 request_id TEXT NOT NULL REFERENCES contact_requests(id) ON DELETE CASCADE,
 version INTEGER NOT NULL, actor TEXT NOT NULL, from_state TEXT NOT NULL, to_state TEXT NOT NULL, at INTEGER NOT NULL,
 PRIMARY KEY(request_id,version)
);
CREATE TRIGGER contact_transition_guard BEFORE UPDATE ON contact_requests
WHEN NOT (
 NEW.version=OLD.version+1 AND
 ((OLD.state='RECEIVED' AND NEW.state='IN_REVIEW') OR (OLD.state='IN_REVIEW' AND NEW.state='CLOSED')) AND
 NEW.last_actor IS NOT NULL AND length(NEW.last_actor) BETWEEN 1 AND 128 AND
 NEW.last_transition_at>=OLD.created_at AND NEW.last_transition_at<OLD.expires_at AND
 (OLD.last_transition_at IS NULL OR NEW.last_transition_at>=OLD.last_transition_at) AND
 NEW.id=OLD.id AND NEW.request_key=OLD.request_key AND NEW.payload_hash=OLD.payload_hash AND
 NEW.category=OLD.category AND NEW.person=OLD.person AND NEW.email=OLD.email AND
 NEW.organization=OLD.organization AND NEW.phone=OLD.phone AND NEW.subject=OLD.subject AND NEW.message=OLD.message AND
 NEW.privacy_version=OLD.privacy_version AND NEW.privacy_sha256=OLD.privacy_sha256 AND NEW.authorization_ref=OLD.authorization_ref AND
 NEW.created_at=OLD.created_at AND NEW.expires_at=OLD.expires_at
) BEGIN SELECT RAISE(ABORT,'INVALID_TRANSITION'); END;
CREATE TRIGGER contact_transition_audit AFTER UPDATE ON contact_requests
BEGIN
 INSERT INTO contact_events(request_id,version,actor,from_state,to_state,at)
 VALUES(NEW.id,NEW.version,NEW.last_actor,OLD.state,NEW.state,NEW.last_transition_at);
END;
