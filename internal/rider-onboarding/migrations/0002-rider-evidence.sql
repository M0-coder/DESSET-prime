-- Rider evidence isolated from merchant records. No collection before approved policy.
CREATE TABLE rider_documents(
 id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES rider_requests(id) ON DELETE RESTRICT,
 kind TEXT NOT NULL CHECK(kind IN ('IDENTITY','LICENSE','VEHICLE','INSURANCE','SIGNED_CONTRACT','ADDITIONAL')),
 object_key TEXT NOT NULL UNIQUE,sha256 TEXT NOT NULL CHECK(length(sha256)=64),size_bytes INTEGER NOT NULL CHECK(size_bytes BETWEEN 8 AND 5242880),
 status TEXT NOT NULL DEFAULT 'QUARANTINED' CHECK(status IN ('QUARANTINED','VERIFIED','REJECTED')),
 uploaded_by TEXT NOT NULL,uploaded_at INTEGER NOT NULL,reviewed_by TEXT,reviewed_at INTEGER,review_ref TEXT,valid_until INTEGER,
 CHECK((status='QUARANTINED' AND reviewed_by IS NULL AND reviewed_at IS NULL AND review_ref IS NULL AND valid_until IS NULL) OR (status<>'QUARANTINED' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL AND review_ref IS NOT NULL)),
 CHECK(valid_until IS NULL OR valid_until>reviewed_at)
);
CREATE INDEX rider_documents_request ON rider_documents(request_id,kind,status);
CREATE TABLE rider_requirements(
 request_id TEXT PRIMARY KEY REFERENCES rider_requests(id) ON DELETE RESTRICT,
 adult_verified INTEGER NOT NULL CHECK(adult_verified=1),identity_ref TEXT NOT NULL,policy_version TEXT NOT NULL,
 additional_required INTEGER NOT NULL CHECK(additional_required IN (0,1)),actor_id TEXT NOT NULL,created_at INTEGER NOT NULL
);
CREATE TABLE rider_contracts(
 request_id TEXT PRIMARY KEY REFERENCES rider_requests(id) ON DELETE RESTRICT,
 document_id TEXT NOT NULL UNIQUE REFERENCES rider_documents(id) ON DELETE RESTRICT,
 terms_version TEXT NOT NULL,sha256 TEXT NOT NULL CHECK(length(sha256)=64),signature_ref TEXT NOT NULL,actor_id TEXT NOT NULL,created_at INTEGER NOT NULL
);
CREATE TRIGGER rider_document_once BEFORE UPDATE ON rider_documents
 WHEN OLD.status<>'QUARANTINED' OR NEW.status='QUARANTINED' OR NEW.id<>OLD.id OR NEW.request_id<>OLD.request_id OR NEW.kind<>OLD.kind OR NEW.object_key<>OLD.object_key OR NEW.sha256<>OLD.sha256 OR NEW.size_bytes<>OLD.size_bytes OR NEW.uploaded_by<>OLD.uploaded_by OR NEW.uploaded_at<>OLD.uploaded_at
 BEGIN SELECT RAISE(ABORT,'DOCUMENT_REVIEW_CONFLICT'); END;
CREATE TRIGGER rider_requirements_guard BEFORE INSERT ON rider_requirements
 WHEN NOT EXISTS(SELECT 1 FROM rider_reviews WHERE request_id=NEW.request_id AND stage='SUBMITTED')
 BEGIN SELECT RAISE(ABORT,'EVIDENCE_LOCKED'); END;
CREATE TRIGGER rider_requirements_immutable BEFORE UPDATE ON rider_requirements BEGIN SELECT RAISE(ABORT,'EVIDENCE_LOCKED'); END;
CREATE TRIGGER rider_contract_guard BEFORE INSERT ON rider_contracts
 WHEN NOT EXISTS(SELECT 1 FROM rider_reviews r JOIN rider_documents d ON d.request_id=r.request_id WHERE r.request_id=NEW.request_id AND r.stage='IDENTITY_VERIFIED' AND d.id=NEW.document_id AND d.kind='SIGNED_CONTRACT' AND d.status='VERIFIED' AND d.sha256=NEW.sha256)
 BEGIN SELECT RAISE(ABORT,'CONTRACT_EVIDENCE_REQUIRED'); END;
CREATE TRIGGER rider_contract_immutable BEFORE UPDATE ON rider_contracts BEGIN SELECT RAISE(ABORT,'EVIDENCE_LOCKED'); END;
CREATE TRIGGER rider_identity_evidence_guard BEFORE UPDATE OF stage ON rider_reviews
 WHEN NEW.stage='IDENTITY_VERIFIED' AND (
 NOT EXISTS(SELECT 1 FROM rider_requirements q WHERE q.request_id=NEW.request_id AND q.adult_verified=1) OR
 NOT EXISTS(SELECT 1 FROM rider_documents d WHERE d.request_id=NEW.request_id AND d.kind='IDENTITY' AND d.status='VERIFIED' AND (d.valid_until IS NULL OR d.valid_until>NEW.updated_at)) OR
 EXISTS(SELECT 1 FROM rider_requests r WHERE r.id=NEW.request_id AND r.vehicle IN ('motorcycle','car') AND EXISTS(SELECT 1 FROM (SELECT 'LICENSE' kind UNION ALL SELECT 'VEHICLE' UNION ALL SELECT 'INSURANCE') required WHERE NOT EXISTS(SELECT 1 FROM rider_documents d WHERE d.request_id=r.id AND d.kind=required.kind AND d.status='VERIFIED' AND d.valid_until>NEW.updated_at))) OR
 EXISTS(SELECT 1 FROM rider_requirements q WHERE q.request_id=NEW.request_id AND q.additional_required=1 AND NOT EXISTS(SELECT 1 FROM rider_documents d WHERE d.request_id=q.request_id AND d.kind='ADDITIONAL' AND d.status='VERIFIED' AND (d.valid_until IS NULL OR d.valid_until>NEW.updated_at))))
 BEGIN SELECT RAISE(ABORT,'IDENTITY_EVIDENCE_REQUIRED'); END;
CREATE TRIGGER rider_contract_evidence_guard BEFORE UPDATE OF stage ON rider_reviews
 WHEN NEW.stage='CONTRACT_VERIFIED' AND NOT EXISTS(SELECT 1 FROM rider_contracts c JOIN rider_documents d ON d.id=c.document_id AND d.request_id=c.request_id WHERE c.request_id=NEW.request_id AND d.kind='SIGNED_CONTRACT' AND d.status='VERIFIED' AND d.sha256=c.sha256)
 BEGIN SELECT RAISE(ABORT,'CONTRACT_EVIDENCE_REQUIRED'); END;
-- Training and eligibility intentionally disabled until evidence-specific module lands.
CREATE TRIGGER rider_training_pending BEFORE UPDATE OF stage ON rider_reviews WHEN NEW.stage IN ('TRAINING_PASSED','ELIGIBLE') BEGIN SELECT RAISE(ABORT,'TRAINING_NOT_IMPLEMENTED'); END;
