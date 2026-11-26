-- Pre-operation checklist. No bank numbers or credentials stored.
CREATE TABLE rider_preparation(
 request_id TEXT PRIMARY KEY REFERENCES rider_requests(id) ON DELETE RESTRICT,
 phone_ready INTEGER NOT NULL CHECK(phone_ready=1),vehicle_ready INTEGER NOT NULL CHECK(vehicle_ready=1),thermal_bag_ready INTEGER NOT NULL CHECK(thermal_bag_ready=1),
 equipment_ref TEXT NOT NULL,payout_ref TEXT NOT NULL,policy_version TEXT NOT NULL,actor_id TEXT NOT NULL,created_at INTEGER NOT NULL
);
CREATE TRIGGER rider_preparation_insert_guard BEFORE INSERT ON rider_preparation WHEN NOT EXISTS(SELECT 1 FROM rider_reviews WHERE request_id=NEW.request_id AND stage='TRAINING_PASSED') BEGIN SELECT RAISE(ABORT,'PREPARATION_LOCKED'); END;
CREATE TRIGGER rider_preparation_immutable BEFORE UPDATE ON rider_preparation BEGIN SELECT RAISE(ABORT,'PREPARATION_LOCKED'); END;
CREATE TRIGGER rider_preparation_eligible BEFORE UPDATE OF stage ON rider_reviews WHEN NEW.stage='ELIGIBLE' AND NOT EXISTS(SELECT 1 FROM rider_preparation WHERE request_id=NEW.request_id) BEGIN SELECT RAISE(ABORT,'PREPARATION_REQUIRED'); END;
CREATE TRIGGER rider_preparation_active BEFORE UPDATE OF status ON rider_accounts WHEN NEW.status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM rider_preparation WHERE request_id=NEW.request_id) BEGIN SELECT RAISE(ABORT,'PREPARATION_REQUIRED'); END;
