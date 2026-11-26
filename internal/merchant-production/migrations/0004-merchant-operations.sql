-- MERCHANT-OPERATIONS-01: append-only recovery and commercial account lifecycle.
ALTER TABLE merchant_notification_outbox ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0 CHECK(next_attempt_at>=0);
CREATE TABLE merchant_notification_reconciliations (
 id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES merchant_requests(id) ON DELETE CASCADE,
 environment TEXT NOT NULL CHECK(environment IN ('staging','production')),
 decision TEXT NOT NULL CHECK(decision IN ('CONFIRMED_SENT','CONFIRMED_NOT_SENT')),
 actor_id TEXT NOT NULL, evidence_ref TEXT NOT NULL, provider_message_id TEXT,
 created_at INTEGER NOT NULL, retry_at INTEGER NOT NULL,
 CHECK((decision='CONFIRMED_SENT' AND provider_message_id IS NOT NULL AND length(provider_message_id)>0 AND retry_at=0) OR (decision='CONFIRMED_NOT_SENT' AND provider_message_id IS NULL AND retry_at>created_at))
);
CREATE TRIGGER merchant_notification_reconcile_guard BEFORE INSERT ON merchant_notification_reconciliations
 WHEN NOT EXISTS (SELECT 1 FROM merchant_notification_outbox WHERE request_id=NEW.request_id AND status='NEEDS_REVIEW')
 OR NOT EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment=NEW.environment AND (environment='production' OR (intake_enabled=0 AND notification_enabled=0 AND activation_enabled=0)))
 BEGIN SELECT RAISE(ABORT,'RECONCILIATION_CONFLICT'); END;
CREATE TRIGGER merchant_notification_reconcile_apply AFTER INSERT ON merchant_notification_reconciliations
 BEGIN UPDATE merchant_notification_outbox SET status=CASE WHEN NEW.decision='CONFIRMED_SENT' THEN 'SENT' ELSE 'PENDING' END,provider_message_id=NEW.provider_message_id,sent_at=CASE WHEN NEW.decision='CONFIRMED_SENT' THEN NEW.created_at ELSE NULL END,next_attempt_at=NEW.retry_at,lease_token=NULL,lease_until=NULL WHERE request_id=NEW.request_id; END;
CREATE TABLE merchant_accounts (
 request_id TEXT PRIMARY KEY REFERENCES merchant_requests(id) ON DELETE RESTRICT,
 status TEXT NOT NULL CHECK(status IN ('READY','ACTIVE','SUSPENDED','DEACTIVATED')),
 version INTEGER NOT NULL DEFAULT 0 CHECK(version>=0),
 actor_id TEXT NOT NULL, reason TEXT NOT NULL, authorization_ref TEXT, updated_at INTEGER NOT NULL,
 CHECK(status<>'ACTIVE' OR (authorization_ref IS NOT NULL AND length(authorization_ref)>0))
);
CREATE TABLE merchant_account_events (
 id INTEGER PRIMARY KEY, request_id TEXT NOT NULL REFERENCES merchant_accounts(request_id) ON DELETE RESTRICT,
 from_status TEXT, to_status TEXT NOT NULL, version INTEGER NOT NULL, actor_id TEXT NOT NULL,
 reason TEXT NOT NULL, authorization_ref TEXT, created_at INTEGER NOT NULL, UNIQUE(request_id,version)
);
CREATE TRIGGER merchant_account_insert_guard BEFORE INSERT ON merchant_accounts
 WHEN NEW.status<>'READY' OR NEW.version<>0 OR NOT EXISTS (SELECT 1 FROM merchant_requests r JOIN merchant_onboarding o ON o.request_id=r.id WHERE r.id=NEW.request_id AND r.status='APPROVED' AND o.stage='READY_FOR_ACTIVATION')
 BEGIN SELECT RAISE(ABORT,'ACCOUNT_NOT_READY'); END;
CREATE TRIGGER merchant_account_insert_audit AFTER INSERT ON merchant_accounts
 BEGIN INSERT INTO merchant_account_events(request_id,from_status,to_status,version,actor_id,reason,authorization_ref,created_at) VALUES(NEW.request_id,NULL,NEW.status,NEW.version,NEW.actor_id,NEW.reason,NEW.authorization_ref,NEW.updated_at); END;
INSERT INTO merchant_accounts(request_id,status,actor_id,reason,updated_at)
 SELECT request_id,'READY',actor_id,'onboarding-ready',updated_at FROM merchant_onboarding WHERE stage='READY_FOR_ACTIVATION';
CREATE TRIGGER merchant_account_from_onboarding AFTER UPDATE OF stage ON merchant_onboarding WHEN NEW.stage='READY_FOR_ACTIVATION'
 BEGIN INSERT INTO merchant_accounts(request_id,status,actor_id,reason,updated_at) VALUES(NEW.request_id,'READY',NEW.actor_id,'onboarding-ready',NEW.updated_at); END;
CREATE TRIGGER merchant_account_transition BEFORE UPDATE ON merchant_accounts
 WHEN NEW.request_id<>OLD.request_id OR NEW.version<>OLD.version+1 OR NOT (
 (OLD.status='READY' AND NEW.status IN ('ACTIVE','DEACTIVATED')) OR
 (OLD.status='ACTIVE' AND NEW.status IN ('SUSPENDED','DEACTIVATED')) OR
 (OLD.status='SUSPENDED' AND NEW.status IN ('ACTIVE','DEACTIVATED'))
 ) OR (NEW.status='ACTIVE' AND (
 NOT EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='production' AND activation_enabled=1) OR
 NOT EXISTS (SELECT 1 FROM merchant_requests r JOIN merchant_onboarding o ON o.request_id=r.id WHERE r.id=NEW.request_id AND r.status='APPROVED' AND o.stage='READY_FOR_ACTIVATION')
 ))
 BEGIN SELECT RAISE(ABORT,'ACCOUNT_TRANSITION_DENIED'); END;
CREATE TRIGGER merchant_account_transition_audit AFTER UPDATE ON merchant_accounts
 BEGIN INSERT INTO merchant_account_events(request_id,from_status,to_status,version,actor_id,reason,authorization_ref,created_at) VALUES(NEW.request_id,OLD.status,NEW.status,NEW.version,NEW.actor_id,NEW.reason,NEW.authorization_ref,NEW.updated_at); END;
