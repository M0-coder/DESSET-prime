# WEB-CLOSE-02 — institutional navigation consolidation

Scope: eight Spanish institutional pages share the existing homepage header and four-group footer navigation, using the already shipped local menu controller. The homepage is the canonical source; the source-only contract checks exact projections. Existing social blocks are preserved only where already approved; no external links added. English overview adds a Spanish applications reference. Prime, all five onboarding routes and three app role pages remain byte-identical. Main content of all eight Spanish pages remains unchanged. No CSS, photos, WebGL, backend, release configuration, CSP, NOINDEX or application registry changes. Public collection and downloads remain closed.

Acceptance: source and dist contract, adversarial fixtures, existing safety and browser checks plus responsive menu audit. No merge or publication without explicit authorization. Full manual visual review, palette ratios and legal documentation remain separate tasks.

## WEB-CLOSE-04 — tablet regression

Visual audit found brand/menu overlap at 768px despite CI passing. Header-only CSS enables the existing compact menu from 701–960px, retaining the mobile behavior below 701px and desktop above 960px. The 3D, photos, HTML contents, main CSS, application states and Prime-specific page remain unchanged. Shared-navigation browser checks now validate brand/link geometry and the 960/961 boundary in source, with source/dist tablet menu screenshots. The stylesheet byte budget moves from 9,000 to 10,000 solely for the bounded header rule; no new resource or runtime dependency. The new candidate must pass CI and visual inspection before integration.
