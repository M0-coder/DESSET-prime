-- v8: direct merchant acknowledgement, bound to an exact profile or verified contract.
CREATE TABLE merchant_acceptances (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES merchant_requests(id) ON DELETE RESTRICT,
 purpose TEXT NOT NULL CHECK(purpose IN ('PROFILE','CONTRACT')),
 profile_version INTEGER, document_id TEXT REFERENCES merchant_documents(id) ON DELETE RESTRICT,
 snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64), terms_version TEXT,
 code_hash TEXT NOT NULL UNIQUE CHECK(length(code_hash)=64),
 issued_by TEXT NOT NULL, delivery_ref TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 decision TEXT CHECK(decision IN ('ACCEPTED','CORRECTIONS_REQUIRED','REVOKED')), decided_at INTEGER,
 CHECK(expires_at>created_at),
 CHECK((decision IS NULL AND decided_at IS NULL) OR (decision IS NOT NULL AND decided_at IS NOT NULL)),
 CHECK((purpose='PROFILE' AND profile_version IS NOT NULL AND document_id IS NULL AND terms_version IS NULL) OR (purpose='CONTRACT' AND profile_version IS NULL AND document_id IS NOT NULL AND terms_version IS NOT NULL))
);
CREATE INDEX merchant_acceptance_request ON merchant_acceptances(request_id,purpose,created_at);
CREATE UNIQUE INDEX merchant_acceptance_final_snapshot ON merchant_acceptances(request_id,purpose,snapshot_hash,COALESCE(profile_version,0),COALESCE(document_id,''),COALESCE(terms_version,'')) WHERE decision IN ('ACCEPTED','CORRECTIONS_REQUIRED');
CREATE TRIGGER merchant_acceptance_once BEFORE UPDATE ON merchant_acceptances
 WHEN OLD.decision IS NOT NULL OR NEW.decision IS NULL OR NEW.id<>OLD.id OR NEW.code_hash<>OLD.code_hash OR NEW.snapshot_hash<>OLD.snapshot_hash OR NEW.request_id<>OLD.request_id OR NEW.purpose<>OLD.purpose OR NEW.profile_version IS NOT OLD.profile_version OR NEW.document_id IS NOT OLD.document_id OR NEW.terms_version IS NOT OLD.terms_version OR NEW.expires_at<>OLD.expires_at OR NEW.issued_by<>OLD.issued_by OR NEW.delivery_ref<>OLD.delivery_ref OR NEW.created_at<>OLD.created_at
 BEGIN SELECT RAISE(ABORT,'ACCEPTANCE_CONFLICT'); END;
CREATE TRIGGER merchant_direct_contract_guard BEFORE UPDATE OF stage ON merchant_onboarding
 WHEN NEW.stage='CONTRACT_VERIFIED' AND EXISTS(SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='production') AND NOT EXISTS(
 SELECT 1 FROM merchant_acceptances a JOIN merchant_documents d ON d.id=a.document_id JOIN merchant_configuration c ON c.request_id=a.request_id WHERE a.request_id=NEW.request_id AND a.purpose='CONTRACT' AND a.decision='ACCEPTED' AND d.request_id=a.request_id AND d.kind='SIGNED_CONTRACT' AND d.status='VERIFIED' AND d.sha256=a.snapshot_hash AND c.commercial_terms_version=a.terms_version)
 BEGIN SELECT RAISE(ABORT,'DIRECT_CONFORMITY_REQUIRED'); END;
CREATE TRIGGER merchant_direct_profile_guard BEFORE UPDATE OF stage ON merchant_onboarding
 WHEN NEW.stage='READY_FOR_ACTIVATION' AND EXISTS(SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='production') AND EXISTS(SELECT 1 FROM merchant_profiles p JOIN merchant_profile_reviews r ON r.request_id=p.request_id AND r.version=p.version WHERE p.request_id=NEW.request_id AND r.decision='APPROVED') AND EXISTS(SELECT 1 FROM merchant_contact_events WHERE request_id=NEW.request_id AND outcome='CONTACTED') AND (
 NOT EXISTS(SELECT 1 FROM merchant_acceptances a JOIN merchant_profiles p ON p.request_id=a.request_id AND p.version=a.profile_version WHERE a.request_id=NEW.request_id AND a.purpose='PROFILE' AND a.decision='ACCEPTED')
 OR NOT EXISTS(SELECT 1 FROM merchant_acceptances a JOIN merchant_documents d ON d.id=a.document_id JOIN merchant_configuration c ON c.request_id=a.request_id WHERE a.request_id=NEW.request_id AND a.purpose='CONTRACT' AND a.decision='ACCEPTED' AND d.request_id=a.request_id AND d.kind='SIGNED_CONTRACT' AND d.status='VERIFIED' AND d.sha256=a.snapshot_hash AND c.commercial_terms_version=a.terms_version))
 BEGIN SELECT RAISE(ABORT,'DIRECT_CONFORMITY_REQUIRED'); END;
