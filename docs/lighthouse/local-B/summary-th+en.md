# Lighthouse — local-B

2026-11-10T23:41:52.868Z · http://localhost:3123 · 3 runs each, median by Performance · Lighthouse 12

| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |
|---|---|---|---|---|---|---|---|
| /th | mobile | 86 | 100 | 100 | 92 | 85, 86, 86 | 2557 |
| /th | desktop | 98 | 100 | 100 | 92 | 98, 98, 98 | 2848 |
| /en | mobile | 87 | 100 | 100 | 92 | 85, 87, 88 | 2324 |
| /en | desktop | 99 | 100 | 100 | 92 | 99, 99, 99 | 2687 |

## Failing audits (median run)

### /th — mobile
- first-contentful-paint (1.5 s)
- largest-contentful-paint (4.0 s)
- total-blocking-time (90 ms)
- speed-index (2.2 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight (Est savings of 560 ms)
- interactive (4.1 s)
- max-potential-fid (150 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 53 KiB)
- largest-contentful-paint-element (3,990 ms)
- canonical

### /th — desktop
- largest-contentful-paint (1.1 s)
- speed-index (0.8 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight (Est savings of 150 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 53 KiB)
- canonical

### /en — mobile
- first-contentful-paint (1.4 s)
- largest-contentful-paint (3.9 s)
- total-blocking-time (130 ms)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight (Est savings of 360 ms)
- interactive (4.1 s)
- max-potential-fid (220 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 53 KiB)
- mainthread-work-breakdown (2.1 s)
- largest-contentful-paint-element (3,910 ms)
- canonical

### /en — desktop
- largest-contentful-paint (0.9 s)
- speed-index (0.8 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight (Est savings of 140 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 53 KiB)
- label-content-name-mismatch
- canonical
