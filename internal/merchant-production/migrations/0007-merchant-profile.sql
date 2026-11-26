-- v7: preparation and merchant conformity, using the existing D1/R2.
CREATE TABLE merchant_contact_events (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES merchant_requests(id) ON DELETE RESTRICT,
 channel TEXT NOT NULL CHECK(channel IN ('PHONE','EMAIL','MEETING','OTHER')),
 outcome TEXT NOT NULL CHECK(outcome IN ('CONTACTED','NO_ANSWER','FOLLOW_UP','DECLINED')),
 notes TEXT NOT NULL CHECK(length(notes)<=1000), actor_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX merchant_contact_request ON merchant_contact_events(request_id,created_at);
CREATE TABLE merchant_profile_media (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES merchant_requests(id) ON DELETE RESTRICT,
 object_key TEXT NOT NULL UNIQUE, mime TEXT NOT NULL CHECK(mime IN ('image/png','image/jpeg')),
 sha256 TEXT NOT NULL CHECK(length(sha256)=64), size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 12 AND 2097152),
 actor_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE merchant_profiles (
 request_id TEXT PRIMARY KEY REFERENCES merchant_requests(id) ON DELETE RESTRICT,
 version INTEGER NOT NULL CHECK(version>=1), payload_json TEXT NOT NULL CHECK(length(payload_json)<=131072),
 actor_id TEXT NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE merchant_profile_reviews (
 request_id TEXT NOT NULL REFERENCES merchant_profiles(request_id) ON DELETE RESTRICT,
 version INTEGER NOT NULL, decision TEXT NOT NULL CHECK(decision IN ('APPROVED','CORRECTIONS_REQUIRED')),
 evidence_ref TEXT NOT NULL, actor_id TEXT NOT NULL, created_at INTEGER NOT NULL,
 PRIMARY KEY(request_id,version)
);
CREATE TRIGGER merchant_profile_change_guard BEFORE UPDATE ON merchant_profiles
 WHEN NEW.version<>OLD.version+1 OR EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=OLD.request_id AND stage='READY_FOR_ACTIVATION')
 BEGIN SELECT RAISE(ABORT,'PROFILE_LOCKED'); END;
CREATE TRIGGER merchant_profile_review_guard BEFORE INSERT ON merchant_profile_reviews
 WHEN NOT EXISTS(SELECT 1 FROM merchant_profiles WHERE request_id=NEW.request_id AND version=NEW.version)
 OR EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=NEW.request_id AND stage='READY_FOR_ACTIVATION')
 BEGIN SELECT RAISE(ABORT,'PROFILE_REVIEW_CONFLICT'); END;
CREATE TRIGGER merchant_profile_ready_guard BEFORE UPDATE OF stage ON merchant_onboarding
 WHEN NEW.stage='READY_FOR_ACTIVATION' AND EXISTS(SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='production') AND (
 NOT EXISTS(SELECT 1 FROM merchant_contact_events WHERE request_id=NEW.request_id AND outcome='CONTACTED') OR
 NOT EXISTS(SELECT 1 FROM merchant_profiles p JOIN merchant_profile_reviews r ON r.request_id=p.request_id AND r.version=p.version WHERE p.request_id=NEW.request_id AND r.decision='APPROVED'))
 BEGIN SELECT RAISE(ABORT,'PROFILE_APPROVAL_REQUIRED'); END;
CREATE TRIGGER merchant_profile_activation_guard BEFORE UPDATE OF status ON merchant_accounts
 WHEN NEW.status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM merchant_profiles p JOIN merchant_profile_reviews r ON r.request_id=p.request_id AND r.version=p.version WHERE p.request_id=NEW.request_id AND r.decision='APPROVED')
 BEGIN SELECT RAISE(ABORT,'PROFILE_APPROVAL_REQUIRED'); END;
