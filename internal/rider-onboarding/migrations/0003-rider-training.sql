CREATE TABLE rider_training_attempts(
 id TEXT PRIMARY KEY,request_id TEXT NOT NULL REFERENCES rider_requests(id) ON DELETE RESTRICT,
 course_version TEXT NOT NULL,course_hash TEXT NOT NULL CHECK(length(course_hash)=64),code_hash TEXT NOT NULL UNIQUE CHECK(length(code_hash)=64),
 issued_by TEXT NOT NULL,delivery_ref TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL CHECK(expires_at>created_at),
 result TEXT CHECK(result IN ('PASSED','FAILED','REVOKED')),score INTEGER CHECK(score BETWEEN 0 AND 10),critical_ok INTEGER CHECK(critical_ok IN (0,1)),answers_json TEXT,finished_at INTEGER,
 CHECK((result IS NULL AND score IS NULL AND critical_ok IS NULL AND answers_json IS NULL AND finished_at IS NULL) OR (result='REVOKED' AND score IS NULL AND critical_ok IS NULL AND answers_json IS NULL AND finished_at IS NOT NULL) OR (result IN ('PASSED','FAILED') AND score IS NOT NULL AND critical_ok IS NOT NULL AND answers_json IS NOT NULL AND finished_at IS NOT NULL AND (result='PASSED')=(score>=8 AND critical_ok=1)))
);
CREATE INDEX rider_training_by_request ON rider_training_attempts(request_id,created_at);
CREATE UNIQUE INDEX rider_training_open ON rider_training_attempts(request_id) WHERE result IS NULL;
CREATE TRIGGER rider_training_immutable BEFORE UPDATE ON rider_training_attempts WHEN OLD.result IS NOT NULL OR NEW.result IS NULL OR NEW.id<>OLD.id OR NEW.request_id<>OLD.request_id OR NEW.course_version<>OLD.course_version OR NEW.course_hash<>OLD.course_hash OR NEW.code_hash<>OLD.code_hash OR NEW.issued_by<>OLD.issued_by OR NEW.delivery_ref<>OLD.delivery_ref OR NEW.created_at<>OLD.created_at OR NEW.expires_at<>OLD.expires_at BEGIN SELECT RAISE(ABORT,'TRAINING_CONFLICT'); END;
CREATE TRIGGER rider_training_insert_guard BEFORE INSERT ON rider_training_attempts WHEN NEW.result IS NOT NULL OR NOT EXISTS(SELECT 1 FROM rider_reviews WHERE request_id=NEW.request_id AND stage='CONTRACT_VERIFIED') BEGIN SELECT RAISE(ABORT,'TRAINING_NOT_AVAILABLE'); END;
DROP TRIGGER rider_training_pending;
CREATE TRIGGER rider_training_result_guard BEFORE UPDATE OF stage ON rider_reviews WHEN NEW.stage='TRAINING_PASSED' AND NOT EXISTS(SELECT 1 FROM rider_training_attempts WHERE request_id=NEW.request_id AND result='PASSED' AND id=NEW.evidence_ref) BEGIN SELECT RAISE(ABORT,'TRAINING_EVIDENCE_REQUIRED'); END;
CREATE TRIGGER rider_training_pass_apply AFTER UPDATE OF result ON rider_training_attempts WHEN NEW.result='PASSED' BEGIN
 UPDATE rider_reviews SET stage='TRAINING_PASSED',version=version+1,actor_id='training-server',evidence_ref=NEW.id,updated_at=NEW.finished_at WHERE request_id=NEW.request_id AND stage='CONTRACT_VERIFIED';
 SELECT CASE WHEN changes()<>1 THEN RAISE(ABORT,'TRAINING_CONFLICT') END;
END;
CREATE TRIGGER rider_eligibility_pending BEFORE UPDATE OF stage ON rider_reviews WHEN NEW.stage='ELIGIBLE' BEGIN SELECT RAISE(ABORT,'ELIGIBILITY_NOT_IMPLEMENTED'); END;
