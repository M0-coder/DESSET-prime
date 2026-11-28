-- Dedicated staging database only. No production rows or relabeling.
CREATE TABLE contact_runtime(
 id INTEGER PRIMARY KEY CHECK(id=1),
 environment TEXT NOT NULL CHECK(environment='staging'),
 schema_scope TEXT NOT NULL DEFAULT 'contact-staging-v1' CHECK(schema_scope='contact-staging-v1'),
 intake_enabled INTEGER NOT NULL DEFAULT 0 CHECK(intake_enabled IN(0,1)),
 privacy_version TEXT,
 privacy_sha256 TEXT,
 authorization_ref TEXT,
 CHECK(intake_enabled=0 OR (privacy_version IS NOT NULL AND privacy_version LIKE 'synthetic-%' AND privacy_sha256 IS NOT NULL AND length(privacy_sha256)=64 AND authorization_ref IS NOT NULL AND authorization_ref LIKE 'synthetic-%'))
);
INSERT INTO contact_runtime(id,environment,intake_enabled) VALUES(1,'staging',0);
