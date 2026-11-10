# Lighthouse — local-A

2026-11-10T23:36:26.040Z · http://localhost:3123 · 3 runs each, median by Performance · Lighthouse 12

| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |
|---|---|---|---|---|---|---|---|
| /th | mobile | 84 | 100 | 100 | 92 | 71, 84, 85 | 2988 |
| /th | desktop | 98 | 100 | 100 | 92 | 98, 98, 99 | 2725 |
| /en | mobile | 84 | 100 | 100 | 92 | 56, 84, 86 | 2600 |
| /en | desktop | 99 | 100 | 100 | 92 | 99, 99, 99 | 2867 |

## Failing audits (median run)

### /th — mobile
- first-contentful-paint (1.7 s)
- largest-contentful-paint (4.3 s)
- total-blocking-time (100 ms)
- forced-reflow-insight
- network-dependency-tree-insight
- interactive (4.5 s)
- max-potential-fid (150 ms)
- unused-javascript (Est savings of 53 KiB)
- mainthread-work-breakdown (2.4 s)
- largest-contentful-paint-element (4,300 ms)
- canonical

### /th — desktop
- largest-contentful-paint (1.0 s)
- speed-index (0.9 s)
- network-dependency-tree-insight
- unused-javascript (Est savings of 53 KiB)
- canonical

### /en — mobile
- first-contentful-paint (1.4 s)
- largest-contentful-paint (4.3 s)
- total-blocking-time (120 ms)
- network-dependency-tree-insight
- interactive (4.4 s)
- max-potential-fid (130 ms)
- unused-javascript (Est savings of 53 KiB)
- largest-contentful-paint-element (4,270 ms)
- canonical

### /en — desktop
- largest-contentful-paint (1.0 s)
- forced-reflow-insight
- network-dependency-tree-insight
- unused-javascript (Est savings of 53 KiB)
- label-content-name-mismatch
- canonical
