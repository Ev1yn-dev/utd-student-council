# Lighthouse — local-final

2026-11-09T11:05:19.503Z · http://localhost:3100 · 3 runs each, median by Performance · Lighthouse 12

| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |
|---|---|---|---|---|---|---|---|
| /th | mobile | 74 | 100 | 100 | 92 | 73, 74, 81 | 1390 |
| /th | desktop | 98 | 100 | 100 | 92 | 97, 98, 98 | 1426 |

## Failing audits (median run)

### /th — mobile
- first-contentful-paint (1.4 s)
- largest-contentful-paint (4.8 s)
- total-blocking-time (340 ms)
- speed-index (2.5 s)
- forced-reflow-insight
- image-delivery-insight (Est savings of 15 KiB)
- network-dependency-tree-insight
- interactive (4.9 s)
- max-potential-fid (440 ms)
- offscreen-images (Est savings of 5 KiB)
- unused-javascript (Est savings of 53 KiB)
- mainthread-work-breakdown (2.7 s)
- largest-contentful-paint-element (4,790 ms)
- canonical

### /th — desktop
- largest-contentful-paint (1.1 s)
- speed-index (1.1 s)
- forced-reflow-insight
- network-dependency-tree-insight
- max-potential-fid (100 ms)
- unused-javascript (Est savings of 53 KiB)
- canonical
