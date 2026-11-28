-- Draft migration. Never apply to live storage without separate authorization.
CREATE TABLE contact_runtime(
 id INTEGER PRIMARY KEY CHECK(id=1),
 environment TEXT NOT NULL CHECK(environment IN ('staging','production')),
 intake_enabled INTEGER NOT NULL DEFAULT 0 CHECK(intake_enabled IN(0,1)),
 privacy_version TEXT,
 privacy_sha256 TEXT,
 authorization_ref TEXT,
 CHECK(intake_enabled=0 OR (environment='production' AND privacy_version IS NOT NULL AND length(privacy_sha256)=64 AND authorization_ref IS NOT NULL))
);
INSERT INTO contact_runtime(id,environment,intake_enabled) VALUES(1,'staging',0);
