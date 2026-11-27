# CONTACT-READY — Activation runbook (NO-GO)
Integration baseline 27816aaaee434317d0480927c26ea9956d408e56 (APP-IDENTITY-01). Prior frontend #132 and synthetic service #133 reproduced without changes in this candidate. Internal panel uses the same service and synthetic authentication fixture, no public listener. No production route, secret, DB, deployment or notification provisioned.

## Stages and evidence
1. Code integration: exact head, full build, unit/integration/browser checks, SCA, static scan, package inventory, targeted mutations. Verify previous production unaffected. Record evidence and owner approval before merge.
2. Legal: verify registered corporate identity, actual data controller, authorized administrators, privacy notice/version, retention and deletion (including backups), complaint/incident channels. Owner signs exact approved values. Do not substitute synthetic policy or invented addresses.
3. Infrastructure: choose dedicated contact origin and storage after review; least-privilege admin identity and MFA, verified Access JWT/issuer/audience/runtime identity, real Turnstile server verification and rate limit, transactional storage, secret management, delivery monitoring. Staging only synthetic. Verify challenge, replay, authorization, CSRF, XSS, capacity, rollback, data retention, audit, availability and external delivery. No public intake.
4. Full E2E staging: frontend -> server -> queue -> authorized review -> closure -> deletion, with synthetic fixtures. Physical mobile and accessibility review. Validate no accidental indexing or public collection.
5. Production activation: separate explicit exact-SHA owner approval, approved production policy and verified deployment, disabled runtime flags by default. Confirm receiving administrator, rollback/disable and incident owner. Run positive and negative checks, then enable only authorized categories; verify receipt and delivery. If any gate fails, keep closed.
6. Ongoing: monitor delivery, queue backlog, access, incidents and retention; review permission changes. No automatic launch. No commercial transactions in institutional web.

## Current limitations
Synthetic handler is deliberately Node/SQLite, not a deployable Cloudflare Worker. Panel tests invoke Request/Response directly; no browser render test of this panel yet. No actual admin identity provider, persistent production storage, notification service or frontend-to-backend binding. Seven-day synthetic expiry not a legal retention decision. Production release remains NO-GO.
