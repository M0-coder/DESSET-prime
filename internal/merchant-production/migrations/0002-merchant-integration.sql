-- Additive migration, v2. Apply exactly once after schema.sql.
ALTER TABLE merchant_requests ADD COLUMN postal_code TEXT CHECK(postal_code IS NULL OR postal_code GLOB '[0-9][0-9][0-9][0-9][0-9]');
ALTER TABLE merchant_requests ADD COLUMN interest_level TEXT CHECK(interest_level IS NULL OR interest_level IN ('ready','soon','evaluating','information'));
ALTER TABLE merchant_requests ADD COLUMN contact_pronunciation TEXT CHECK(contact_pronunciation IS NULL OR length(contact_pronunciation) BETWEEN 1 AND 200);
ALTER TABLE merchant_requests ADD COLUMN ubigeo TEXT CHECK(ubigeo IS NULL OR ubigeo GLOB '[0-9][0-9][0-9][0-9][0-9][0-9]');
ALTER TABLE merchant_runtime ADD COLUMN activation_enabled INTEGER NOT NULL DEFAULT 0 CHECK(activation_enabled IN (0,1));
CREATE TABLE merchant_onboarding (
 request_id TEXT PRIMARY KEY REFERENCES merchant_requests(id) ON DELETE CASCADE,
 stage TEXT NOT NULL DEFAULT 'EVALUATION_APPROVED' CHECK(stage IN ('EVALUATION_APPROVED','DOCUMENTATION_VERIFIED','CONTRACT_VERIFIED','CONFIGURATION_VERIFIED','READY_FOR_ACTIVATION')),
 actor_id TEXT NOT NULL,evidence_ref TEXT NOT NULL,updated_at INTEGER NOT NULL
);
CREATE TABLE merchant_onboarding_events (
 id INTEGER PRIMARY KEY,request_id TEXT NOT NULL REFERENCES merchant_requests(id) ON DELETE CASCADE,
 from_stage TEXT,to_stage TEXT NOT NULL,actor_id TEXT NOT NULL,evidence_ref TEXT NOT NULL,created_at INTEGER NOT NULL
);
INSERT INTO merchant_onboarding(request_id,actor_id,evidence_ref,updated_at)
 SELECT id,reviewed_by,'legacy-review',reviewed_at FROM merchant_requests WHERE status='APPROVED';
CREATE TRIGGER merchant_onboarding_start AFTER UPDATE OF status ON merchant_requests
 WHEN OLD.status='PENDING' AND NEW.status='APPROVED'
 BEGIN INSERT INTO merchant_onboarding(request_id,actor_id,evidence_ref,updated_at) VALUES(NEW.id,NEW.reviewed_by,'evaluation-approved',NEW.reviewed_at); END;
CREATE TRIGGER merchant_onboarding_transition BEFORE UPDATE OF stage ON merchant_onboarding
 WHEN NOT ((OLD.stage='EVALUATION_APPROVED' AND NEW.stage='DOCUMENTATION_VERIFIED') OR
 (OLD.stage='DOCUMENTATION_VERIFIED' AND NEW.stage='CONTRACT_VERIFIED') OR
 (OLD.stage='CONTRACT_VERIFIED' AND NEW.stage='CONFIGURATION_VERIFIED') OR
 (OLD.stage='CONFIGURATION_VERIFIED' AND NEW.stage='READY_FOR_ACTIVATION'))
 BEGIN SELECT RAISE(ABORT,'INVALID_ONBOARDING_TRANSITION'); END;
CREATE TRIGGER merchant_onboarding_audit AFTER UPDATE OF stage ON merchant_onboarding
 BEGIN INSERT INTO merchant_onboarding_events(request_id,from_stage,to_stage,actor_id,evidence_ref,created_at) VALUES(NEW.request_id,OLD.stage,NEW.stage,NEW.actor_id,NEW.evidence_ref,NEW.updated_at); END;
