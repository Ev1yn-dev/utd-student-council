# Lighthouse — local-C

2026-11-10T23:51:57.369Z · http://localhost:3123 · 3 runs each, median by Performance · Lighthouse 12

| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |
|---|---|---|---|---|---|---|---|
| /th | mobile | 88 | 100 | 100 | 92 | 74, 88, 89 | 2543 |
| /th | desktop | 98 | 100 | 100 | 92 | 98, 98, 99 | 2806 |
| /en | mobile | 81 | 100 | 100 | 92 | 80, 81, 87 | 2923 |
| /en | desktop | 99 | 100 | 100 | 92 | 98, 99, 99 | 2693 |

## Failing audits (median run)

### /th — mobile
- first-contentful-paint (1.4 s)
- largest-contentful-paint (3.7 s)
- total-blocking-time (100 ms)
- speed-index (2.0 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight (Est savings of 510 ms)
- interactive (4.1 s)
- max-potential-fid (170 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 50 KiB)
- largest-contentful-paint-element (3,730 ms)
- canonical

### /th — desktop
- largest-contentful-paint (1.0 s)
- speed-index (0.7 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight (Est savings of 150 ms)
- max-potential-fid (90 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 50 KiB)
- canonical

### /en — mobile
- first-contentful-paint (1.3 s)
- largest-contentful-paint (4.0 s)
- total-blocking-time (290 ms)
- speed-index (2.0 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight (Est savings of 370 ms)
- interactive (4.5 s)
- max-potential-fid (360 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 50 KiB)
- mainthread-work-breakdown (2.1 s)
- largest-contentful-paint-element (3,960 ms)
- canonical

### /en — desktop
- largest-contentful-paint (1.0 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight (Est savings of 180 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 50 KiB)
- label-content-name-mismatch
- canonical
