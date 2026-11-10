# Lighthouse — before-hero

2026-11-10T23:30:50.341Z · https://utdsc.com · 3 runs each, median by Performance · Lighthouse 12

| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |
|---|---|---|---|---|---|---|---|
| /th | mobile | 73 | 100 | 96 | 100 | 59, 73, 74 | 1235 |
| /th | desktop | 98 | 100 | 96 | 100 | 98, 98, 98 | 2854 |
| /en | mobile | 80 | 100 | 96 | 100 | 80, 80, 82 | 2245 |
| /en | desktop | 96 | 100 | 96 | 100 | 96, 96, 97 | 2490 |

## Failing audits (median run)

### /th — mobile
- first-contentful-paint (2.4 s)
- largest-contentful-paint (4.4 s)
- total-blocking-time (340 ms)
- speed-index (3.6 s)
- network-dependency-tree-insight
- interactive (4.4 s)
- max-potential-fid (270 ms)
- unused-javascript (Est savings of 55 KiB)
- uses-rel-preconnect (Est savings of 50 ms)
- mainthread-work-breakdown (2.5 s)
- largest-contentful-paint-element (4,350 ms)
- errors-in-console

### /th — desktop
- first-contentful-paint (0.7 s)
- largest-contentful-paint (1.0 s)
- speed-index (1.0 s)
- network-dependency-tree-insight
- unused-javascript (Est savings of 55 KiB)
- errors-in-console

### /en — mobile
- first-contentful-paint (1.9 s)
- largest-contentful-paint (5.0 s)
- total-blocking-time (90 ms)
- speed-index (2.7 s)
- network-dependency-tree-insight
- interactive (5.1 s)
- max-potential-fid (180 ms)
- unused-javascript (Est savings of 55 KiB)
- largest-contentful-paint-element (4,980 ms)
- errors-in-console

### /en — desktop
- first-contentful-paint (0.9 s)
- largest-contentful-paint (1.0 s)
- speed-index (1.3 s)
- network-dependency-tree-insight
- interactive (1.5 s)
- max-potential-fid (70 ms)
- unused-javascript (Est savings of 54 KiB)
- label-content-name-mismatch
- errors-in-console
