# PERF-MOBILE-01 — controlled offline investigation (NO DEPLOY)

Base a5473e85ba5c00992a0019c72e92c3b219b050f1. No public HTML/CSS/JS, approved media, WebGL, DNS, release workflow or NOINDEX changes. The original asset remains the only approved release asset. This draft adds an isolated, read-only GitHub Actions experiment; its temporary transcode is not a release package.

## Cycle 1 — evidence
PR #126 Lighthouse artifact 15227028182: mobile 92/100, LCP 3082.36 ms, LCP element video#desset-editorial-video. 9,156,850 bytes transferred, of which media 8,134,911; eight blocking sheets, estimated 857 ms savings, not demonstrated. Previous same SHA runs 82 and 91 mobile, so unpaired measurements are not causally attributable.
Original video SHA-256 76944235866393f12d88c4ce3869cdf984a13805638af441747f59f318a725b0, 6,958,330 bytes, H.264 1920x960, 25 fps, 250 frames, 10 seconds, BT.709.

## Cycle 2 — isolated local encode
FFmpeg libx264 medium CRF 21, 4 threads, faststart, no audio; 4,702,697 bytes (32.42% reduction), SHA-256 e11860a8352393e45959cb7ef77bddfa6f272ac24e5a3ee928c4aeae63c029fe. All 250 frames: mean SSIM 0.990477, minimum 0.984072. Lossy, not pixel-identical. Duration, resolution, frame rate, frame count and color metadata preserved. Encoding result may differ on another FFmpeg version; record actual candidate hash and tool version. No candidate binary uploaded.

## Cycle 3 — pending paired evidence
Local browser test blocked by environment policy (ERR_BLOCKED_BY_ADMINISTRATOR on loopback). Run read-only CI experiment using six alternating cold mobile measurements A/B/B/A/A/B in one runner, same URL and package except video. Preserve all results, medians, LCP/FCP/CLS/TBT, score, CPU benchmark and video quality metrics. Keep original CI thresholds; no rerun cherry-picking. Restore exact dist and verify. A candidate must show median LCP <=2.5 s and >=5% improvement, stable scores/CLS/TBT, and meet quality checks. Even a successful lab result does not prove manual visual parity, device compatibility or field metrics. No merge, deployment or asset-manifest update without separate approval.
