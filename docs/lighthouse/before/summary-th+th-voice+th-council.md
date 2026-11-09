# Lighthouse — before

2026-11-09T09:13:21.180Z · https://utdsc.com · 1 runs each, median by Performance · Lighthouse 12

| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |
|---|---|---|---|---|---|---|---|
| /th | mobile | 72 | 100 | 96 | 100 | 72 | 2919 |
| /th | desktop | 97 | 100 | 96 | 100 | 97 | 2295 |
| /th/voice | mobile | 78 | 96 | 96 | 100 | 78 | 1958 |
| /th/voice | desktop | 98 | 96 | 96 | 100 | 98 | 2432 |
| /th?tab=council | mobile | 0 | 100 | 96 | 100 | 0 | 2667 |
| /th?tab=council | desktop | 93 | 100 | 96 | 100 | 93 | 2264 |

## Failing audits (median run)

### /th — mobile
- first-contentful-paint (2.4 s)
- largest-contentful-paint (6.0 s)
- total-blocking-time (120 ms)
- speed-index (4.6 s)
- cache-insight (Est savings of 68 KiB)
- forced-reflow-insight
- image-delivery-insight (Est savings of 137 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight (Est savings of 510 ms)
- interactive (6.0 s)
- max-potential-fid (150 ms)
- render-blocking-resources (Est savings of 0 ms)
- uses-responsive-images (Est savings of 95 KiB)
- offscreen-images (Est savings of 6 KiB)
- unused-javascript (Est savings of 55 KiB)
- legacy-javascript (Est savings of 14 KiB)
- largest-contentful-paint-element (5,970 ms)
- unsized-images
- errors-in-console

### /th — desktop
- first-contentful-paint (0.7 s)
- largest-contentful-paint (1.0 s)
- speed-index (1.2 s)
- cache-insight (Est savings of 97 KiB)
- image-delivery-insight (Est savings of 126 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight
- uses-responsive-images (Est savings of 121 KiB)
- legacy-javascript
- unsized-images
- label-content-name-mismatch
- errors-in-console

### /th/voice — mobile
- first-contentful-paint (2.6 s)
- largest-contentful-paint (4.2 s)
- total-blocking-time (250 ms)
- speed-index (2.6 s)
- cache-insight (Est savings of 14 KiB)
- image-delivery-insight (Est savings of 18 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight
- interactive (5.8 s)
- max-potential-fid (220 ms)
- unused-javascript (Est savings of 48 KiB)
- legacy-javascript (Est savings of 14 KiB)
- largest-contentful-paint-element (4,180 ms)
- color-contrast
- errors-in-console

### /th/voice — desktop
- first-contentful-paint (0.7 s)
- largest-contentful-paint (1.0 s)
- speed-index (0.9 s)
- cache-insight (Est savings of 7 KiB)
- image-delivery-insight (Est savings of 5 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight
- unused-javascript (Est savings of 23 KiB)
- legacy-javascript (Est savings of 13 KiB)
- color-contrast
- label-content-name-mismatch
- errors-in-console

### /th?tab=council — mobile
- first-contentful-paint (1.9 s)
- speed-index (3.2 s)
- cache-insight (Est savings of 59 KiB)
- forced-reflow-insight
- image-delivery-insight (Est savings of 220 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- render-blocking-insight
- max-potential-fid (330 ms)
- dom-size (878 elements)
- mainthread-work-breakdown (3.6 s)
- label-content-name-mismatch
- errors-in-console

### /th?tab=council — desktop
- first-contentful-paint (0.8 s)
- largest-contentful-paint (1.4 s)
- speed-index (1.5 s)
- cache-insight (Est savings of 96 KiB)
- forced-reflow-insight
- image-delivery-insight (Est savings of 126 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight
- interactive (1.4 s)
- max-potential-fid (90 ms)
- uses-responsive-images (Est savings of 133 KiB)
- unused-javascript (Est savings of 50 KiB)
- legacy-javascript (Est savings of 14 KiB)
- dom-size (878 elements)
- largest-contentful-paint-element (1,410 ms)
- label-content-name-mismatch
- errors-in-console
