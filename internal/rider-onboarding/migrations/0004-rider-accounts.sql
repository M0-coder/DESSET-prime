-- v4: account readiness and authorization, independent of intake and training.
CREATE TABLE rider_provisioning(
 request_id TEXT PRIMARY KEY REFERENCES rider_requests(id) ON DELETE RESTRICT,
 app_subject TEXT NOT NULL UNIQUE,provision_ref TEXT NOT NULL,training_id TEXT NOT NULL REFERENCES rider_training_attempts(id),actor_id TEXT NOT NULL,created_at INTEGER NOT NULL
);
CREATE TABLE rider_accounts(
 request_id TEXT PRIMARY KEY REFERENCES rider_provisioning(request_id) ON DELETE RESTRICT,
 status TEXT NOT NULL DEFAULT 'READY' CHECK(status IN ('READY','ACTIVE','SUSPENDED','REVOKED')),version INTEGER NOT NULL DEFAULT 0,
 actor_id TEXT NOT NULL,reason TEXT NOT NULL,authorization_ref TEXT,updated_at INTEGER NOT NULL
);
CREATE TABLE rider_account_events(
 request_id TEXT NOT NULL REFERENCES rider_accounts(request_id),version INTEGER NOT NULL,from_status TEXT,to_status TEXT NOT NULL,actor_id TEXT NOT NULL,reason TEXT NOT NULL,authorization_ref TEXT,created_at INTEGER NOT NULL,PRIMARY KEY(request_id,version)
);
CREATE VIEW rider_current_evidence AS SELECT r.id AS request_id,r.ubigeo,r.vehicle,q.policy_version,c.terms_version,p.app_subject,p.provision_ref,a.course_version,a.course_hash
 FROM rider_requests r JOIN rider_requirements q ON q.request_id=r.id JOIN rider_contracts c ON c.request_id=r.id JOIN rider_provisioning p ON p.request_id=r.id JOIN rider_training_attempts a ON a.id=p.training_id AND a.request_id=r.id
 JOIN rider_documents contract ON contract.id=c.document_id AND contract.request_id=r.id AND contract.kind='SIGNED_CONTRACT' AND contract.status='VERIFIED' AND contract.sha256=c.sha256
 WHERE q.adult_verified=1 AND a.result='PASSED'
 AND EXISTS(SELECT 1 FROM rider_documents d WHERE d.request_id=r.id AND d.kind='IDENTITY' AND d.status='VERIFIED' AND (d.valid_until IS NULL OR d.valid_until>CAST(strftime('%s','now') AS INTEGER)*1000))
 AND (r.vehicle='bicycle' OR NOT EXISTS(SELECT 1 FROM (SELECT 'LICENSE' kind UNION ALL SELECT 'VEHICLE' UNION ALL SELECT 'INSURANCE') k WHERE NOT EXISTS(SELECT 1 FROM rider_documents d WHERE d.request_id=r.id AND d.kind=k.kind AND d.status='VERIFIED' AND d.valid_until>CAST(strftime('%s','now') AS INTEGER)*1000)))
 AND (q.additional_required=0 OR EXISTS(SELECT 1 FROM rider_documents d WHERE d.request_id=r.id AND d.kind='ADDITIONAL' AND d.status='VERIFIED' AND (d.valid_until IS NULL OR d.valid_until>CAST(strftime('%s','now') AS INTEGER)*1000)));
CREATE TRIGGER rider_provision_guard BEFORE INSERT ON rider_provisioning WHEN NOT EXISTS(SELECT 1 FROM rider_reviews v JOIN rider_training_attempts a ON a.id=NEW.training_id AND a.request_id=v.request_id WHERE v.request_id=NEW.request_id AND v.stage='TRAINING_PASSED' AND a.result='PASSED') BEGIN SELECT RAISE(ABORT,'PROVISION_DENIED'); END;
CREATE TRIGGER rider_provision_immutable BEFORE UPDATE ON rider_provisioning BEGIN SELECT RAISE(ABORT,'PROVISION_LOCKED'); END;
DROP TRIGGER rider_eligibility_pending;
CREATE TRIGGER rider_eligibility_guard BEFORE UPDATE OF stage ON rider_reviews WHEN NEW.stage='ELIGIBLE' AND NOT EXISTS(SELECT 1 FROM rider_current_evidence WHERE request_id=NEW.request_id) BEGIN SELECT RAISE(ABORT,'RIDER_EVIDENCE_EXPIRED_OR_MISSING'); END;
CREATE TRIGGER rider_account_insert_guard BEFORE INSERT ON rider_accounts WHEN NEW.status<>'READY' OR NEW.version<>0 OR NEW.authorization_ref IS NOT NULL OR NOT EXISTS(SELECT 1 FROM rider_reviews WHERE request_id=NEW.request_id AND stage='ELIGIBLE') BEGIN SELECT RAISE(ABORT,'ACCOUNT_DENIED'); END;
CREATE TRIGGER rider_eligible_account AFTER UPDATE OF stage ON rider_reviews WHEN NEW.stage='ELIGIBLE' BEGIN INSERT INTO rider_accounts(request_id,actor_id,reason,updated_at) VALUES(NEW.request_id,NEW.actor_id,NEW.evidence_ref,NEW.updated_at); END;
CREATE TRIGGER rider_account_created AFTER INSERT ON rider_accounts BEGIN INSERT INTO rider_account_events VALUES(NEW.request_id,NEW.version,NULL,NEW.status,NEW.actor_id,NEW.reason,NEW.authorization_ref,NEW.updated_at); END;
CREATE TRIGGER rider_account_transition BEFORE UPDATE ON rider_accounts WHEN NEW.request_id<>OLD.request_id OR NEW.version<>OLD.version+1 OR NOT ((OLD.status='READY' AND NEW.status IN ('ACTIVE','REVOKED')) OR (OLD.status='ACTIVE' AND NEW.status IN ('SUSPENDED','REVOKED')) OR (OLD.status='SUSPENDED' AND NEW.status IN ('ACTIVE','REVOKED'))) BEGIN SELECT RAISE(ABORT,'ACCOUNT_CONFLICT'); END;
CREATE TRIGGER rider_activation_guard BEFORE UPDATE OF status ON rider_accounts WHEN NEW.status='ACTIVE' AND (NOT EXISTS(SELECT 1 FROM rider_runtime WHERE id=1 AND environment='production' AND activation_enabled=1 AND authorization_ref IS NOT NULL AND authorization_ref=NEW.authorization_ref) OR NOT EXISTS(SELECT 1 FROM rider_current_evidence WHERE request_id=NEW.request_id)) BEGIN SELECT RAISE(ABORT,'ACTIVATION_DENIED'); END;
CREATE TRIGGER rider_account_audit AFTER UPDATE ON rider_accounts BEGIN INSERT INTO rider_account_events VALUES(NEW.request_id,NEW.version,OLD.status,NEW.status,NEW.actor_id,NEW.reason,NEW.authorization_ref,NEW.updated_at); END;
