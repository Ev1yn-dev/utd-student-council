# Lighthouse — after-hero

2026-11-10T23:59:12.948Z · https://utdsc.com · 3 runs each, median by Performance · Lighthouse 12

| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |
|---|---|---|---|---|---|---|---|
| /th | mobile | 83 | 100 | 96 | 100 | 65, 83, 85 | 2864 |
| /th | desktop | 96 | 100 | 96 | 100 | 92, 96, 97 | 2903 |
| /en | mobile | 94 | 100 | 96 | 100 | 81, 94, 94 | 2950 |
| /en | desktop | 98 | 100 | 96 | 100 | 97, 98, 98 | 2838 |

## Failing audits (median run)

### /th — mobile
- first-contentful-paint (2.1 s)
- largest-contentful-paint (3.8 s)
- total-blocking-time (130 ms)
- speed-index (4.8 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight
- interactive (3.8 s)
- max-potential-fid (130 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 29 KiB)
- largest-contentful-paint-element (3,760 ms)
- errors-in-console

### /th — desktop
- first-contentful-paint (0.9 s)
- largest-contentful-paint (1.1 s)
- speed-index (1.2 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight
- unused-javascript (Est savings of 53 KiB)
- errors-in-console

### /en — mobile
- first-contentful-paint (2.0 s)
- largest-contentful-paint (2.7 s)
- total-blocking-time (70 ms)
- speed-index (2.1 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight
- interactive (3.2 s)
- max-potential-fid (140 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 29 KiB)
- largest-contentful-paint-element (2,720 ms)
- errors-in-console

### /en — desktop
- first-contentful-paint (0.7 s)
- largest-contentful-paint (1.1 s)
- speed-index (1.1 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 53 KiB)
- label-content-name-mismatch
- errors-in-console
