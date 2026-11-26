-- MERCHANT-INTEGRATION-03. Additive, staging/production separated.
CREATE TABLE merchant_drafts (
 key_hash TEXT PRIMARY KEY CHECK(length(key_hash)=64),
 actor_id TEXT NOT NULL,
 request_key TEXT NOT NULL UNIQUE,
 payload_json TEXT,
 expires_at INTEGER NOT NULL,
 receipt_id TEXT REFERENCES merchant_requests(id) ON DELETE CASCADE,
 CHECK((receipt_id IS NULL AND payload_json IS NOT NULL AND length(payload_json)<=8192) OR (receipt_id IS NOT NULL AND payload_json IS NULL))
);
CREATE INDEX merchant_drafts_expiry ON merchant_drafts(expires_at);
CREATE TRIGGER merchant_draft_receipt AFTER INSERT ON merchant_requests
 BEGIN UPDATE merchant_drafts SET receipt_id=NEW.id,payload_json=NULL WHERE request_key=NEW.request_key; END;
