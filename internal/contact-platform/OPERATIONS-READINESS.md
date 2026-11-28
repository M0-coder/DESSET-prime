# CONTACT-READY-07A — operations preparation (NO DEPLOY)

Validated baseline 48ce29fd06ea5e68bc5a15de9a2f7030428e9331: 11/11 workflows success, local workerd run 46090642148 / job 140810484924 / artifact 15241185640, 11/11 instrumented checkpoints. Main 5e36449c76e569c475826a43e5ea2fd88fb73b04 unchanged. No hosted infrastructure or live Access identities.

## Operational snapshot candidate
Read-only, one SQL statement, no external calls, no identifiers, email, subject, message or contact content. Reports stored rows, expired awaiting physical purge, active state totals, remaining capacity, age of oldest received item, and separate database/configuration intake flags. These flags do NOT prove actual availability or permission to accept data. Capacity includes expired stored rows because receive() counts physical rows. The snapshot is disabled by default and not wired to any candidate or public route. Test-only route is in the isolated workerd fixture. No external metrics transport. No threshold or SLA is approved.

## Activation and operations runbook
| Gate | Required evidence | Accountable role (unassigned) |
| --- | --- | --- |
| Legal and retention | Verified controller, approved notice, retention schedule including backup deletion | Legal/controller |
| Access | Actual authenticated route, MFA, least privilege roster, revocation tests | Security |
| Intake | Real challenge, rate limit, origin and runtime gates, synthetic-only staging | Platform |
| Monitoring | Private destination, verified delivery, redacted metrics, approved alert thresholds | Operations |
| Backlog | Assigned departmental owners and approved response targets, escalation path | Department leads |
| Retention | Approved scheduled purge design, bounded jobs, failure recovery, backup deletion proof | Controller/platform |
| Release | Exact SHA, full CI, rollback rehearsal, explicit owner authorization | Release owner |

## Incident sequence (not executed)
1. Suspected leak or unauthorized access: disable intake at runtime and configuration, disable admin access, revoke affected identity, notify assigned incident owner. Preserve only authorized evidence; do not copy contact content into logs.
2. Failed delivery or rising backlog: inspect private aggregate metrics and approved delivery evidence; escalate to assigned department; do not promise receipt or response time not demonstrated.
3. Expiry backlog: check approved retention and maintenance procedure; use existing bounded purge only within separately approved execution context. Never delete live data for a test. Verify counts and backup policy. No scheduler is connected.
4. Recover only after root cause, synthetic end-to-end checks, access review and explicit approval. Record exact deployment and rollback evidence.

## Remaining
Production default export remains hard locked. The aggregate candidate and added local checks are pending CI; 13 local checkpoints expected. The actual scheduler, notification service, frontend-to-production integration, verified identity provider, legal approval, physical-device checks, rollback and production controls remain outstanding. No new dependencies, no changes to main, DNS, credentials, policies or published website.
