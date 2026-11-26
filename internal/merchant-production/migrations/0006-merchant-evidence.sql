-- v6: commercial evidence, private documents and configuration. No real records created.
CREATE TABLE merchant_documents (
 id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES merchant_requests(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('RUC','REPRESENTATION','PERMIT','SIGNED_CONTRACT')),
 object_key TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 8 AND 5242880),
 status TEXT NOT NULL DEFAULT 'QUARANTINED' CHECK(status IN ('QUARANTINED','VERIFIED','REJECTED')),
 uploaded_by TEXT NOT NULL,uploaded_at INTEGER NOT NULL,reviewed_by TEXT,reviewed_at INTEGER,review_ref TEXT,
 CHECK((status='QUARANTINED' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_ref IS NULL) OR (status<>'QUARANTINED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_ref IS NOT NULL))
);
CREATE INDEX merchant_document_request ON merchant_documents(request_id,kind,status);
CREATE TRIGGER merchant_document_review_once BEFORE UPDATE OF status ON merchant_documents
 WHEN OLD.status<>'QUARANTINED' OR NEW.status NOT IN ('VERIFIED','REJECTED')
 BEGIN SELECT RAISE(ABORT,'DOCUMENT_REVIEW_CONFLICT'); END;
CREATE TABLE merchant_configuration (
 request_id TEXT PRIMARY KEY REFERENCES merchant_requests(id) ON DELETE RESTRICT,
 ruc TEXT NOT NULL CHECK(length(ruc)=11 AND ruc NOT GLOB '*[^0-9]*'),
 commission_bps INTEGER NOT NULL CHECK(commission_bps BETWEEN 0 AND 1350),
 currency TEXT NOT NULL CHECK(currency='PEN'),
 service_minutes INTEGER NOT NULL CHECK(service_minutes BETWEEN 1 AND 180),
 payout_ref TEXT NOT NULL,commercial_terms_version TEXT NOT NULL,
 permits_required INTEGER NOT NULL CHECK(permits_required IN (0,1)),
 actor_id TEXT NOT NULL,updated_at INTEGER NOT NULL
);
CREATE TRIGGER merchant_configuration_locked BEFORE UPDATE ON merchant_configuration
 WHEN EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=OLD.request_id AND stage IN ('CONFIGURATION_VERIFIED','READY_FOR_ACTIVATION'))
 BEGIN SELECT RAISE(ABORT,'CONFIGURATION_LOCKED'); END;
-- Production cannot progress on an invented evidence string alone.
CREATE TRIGGER merchant_production_evidence_guard BEFORE UPDATE OF stage ON merchant_onboarding
 WHEN EXISTS(SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='production') AND (
 (NEW.stage='DOCUMENTATION_VERIFIED' AND (
 NOT EXISTS(SELECT 1 FROM merchant_documents WHERE request_id=NEW.request_id AND kind='RUC' AND status='VERIFIED') OR
 NOT EXISTS(SELECT 1 FROM merchant_documents WHERE request_id=NEW.request_id AND kind='REPRESENTATION' AND status='VERIFIED') OR
 NOT EXISTS(SELECT 1 FROM merchant_configuration WHERE request_id=NEW.request_id) OR
 (EXISTS(SELECT 1 FROM merchant_configuration WHERE request_id=NEW.request_id AND permits_required=1) AND NOT EXISTS(SELECT 1 FROM merchant_documents WHERE request_id=NEW.request_id AND kind='PERMIT' AND status='VERIFIED')))) OR
 (NEW.stage='CONTRACT_VERIFIED' AND NOT EXISTS(SELECT 1 FROM merchant_documents WHERE request_id=NEW.request_id AND kind='SIGNED_CONTRACT' AND status='VERIFIED')) OR
 (NEW.stage IN ('CONFIGURATION_VERIFIED','READY_FOR_ACTIVATION') AND (NOT EXISTS(SELECT 1 FROM merchant_configuration WHERE request_id=NEW.request_id) OR NOT EXISTS(SELECT 1 FROM merchant_documents WHERE request_id=NEW.request_id AND kind='SIGNED_CONTRACT' AND status='VERIFIED')))
 )
 BEGIN SELECT RAISE(ABORT,'EVIDENCE_REQUIRED'); END;
CREATE TRIGGER merchant_production_activation_guard BEFORE UPDATE OF status ON merchant_accounts
 WHEN NEW.status='ACTIVE' AND (
 NOT EXISTS(SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='production' AND launch_authorization_ref IS NOT NULL) OR
 NOT EXISTS(SELECT 1 FROM merchant_configuration WHERE request_id=NEW.request_id) OR
 NOT EXISTS(SELECT 1 FROM merchant_documents WHERE request_id=NEW.request_id AND kind='SIGNED_CONTRACT' AND status='VERIFIED'))
 BEGIN SELECT RAISE(ABORT,'ACTIVATION_EVIDENCE_REQUIRED'); END;
