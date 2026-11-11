# Lighthouse — after-hero-th2

2026-11-11T00:02:31.863Z · https://utdsc.com · 3 runs each, median by Performance · Lighthouse 12

| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |
|---|---|---|---|---|---|---|---|
| /th | mobile | 91 | 100 | 96 | 100 | 84, 91, 92 | 2858 |
| /th | desktop | 98 | 100 | 96 | 100 | 97, 98, 98 | 2518 |

## Failing audits (median run)

### /th — mobile
- first-contentful-paint (2.2 s)
- largest-contentful-paint (2.6 s)
- total-blocking-time (190 ms)
- speed-index (3.2 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight
- interactive (3.7 s)
- max-potential-fid (240 ms)
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 29 KiB)
- largest-contentful-paint-element (2,620 ms)
- errors-in-console

### /th — desktop
- first-contentful-paint (0.7 s)
- largest-contentful-paint (1.1 s)
- speed-index (1.0 s)
- forced-reflow-insight
- network-dependency-tree-insight
- render-blocking-insight
- render-blocking-resources (Est savings of 0 ms)
- unused-javascript (Est savings of 53 KiB)
- errors-in-console
