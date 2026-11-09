# Lighthouse — after

2026-11-09T09:27:57.803Z · https://utdsc.com · 1 runs each, median by Performance · Lighthouse 12

| page | form | Perf | A11y | BP | SEO | Perf of each run | CPU benchmark |
|---|---|---|---|---|---|---|---|
| /th | mobile | 76 | 100 | 96 | 100 | 76 | 2849 |
| /th | desktop | 95 | 100 | 96 | 100 | 95 | 2913 |
| /th/voice | mobile | 80 | 96 | 96 | 100 | 80 | 2527 |
| /th/voice | desktop | 99 | 96 | 96 | 100 | 99 | 2787 |
| /th?tab=council | mobile | 0 | 100 | 96 | 100 | 0 | 2664 |
| /th?tab=council | desktop | 96 | 100 | 96 | 92 | 96 | 2197 |

## Failing audits (median run)

### /th — mobile
- first-contentful-paint (2.7 s)
- largest-contentful-paint (4.4 s)
- total-blocking-time (190 ms)
- speed-index (4.1 s)
- cache-insight (Est savings of 3 KiB)
- forced-reflow-insight
- image-delivery-insight (Est savings of 68 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight
- interactive (4.5 s)
- max-potential-fid (130 ms)
- render-blocking-resources (Est savings of 0 ms)
- uses-responsive-images (Est savings of 21 KiB)
- unused-javascript (Est savings of 53 KiB)
- legacy-javascript (Est savings of 13 KiB)
- bootup-time (1.4 s)
- mainthread-work-breakdown (2.5 s)
- largest-contentful-paint-element (4,370 ms)
- unsized-images
- errors-in-console

### /th — desktop
- first-contentful-paint (0.9 s)
- largest-contentful-paint (1.3 s)
- speed-index (1.5 s)
- cache-insight (Est savings of 93 KiB)
- forced-reflow-insight
- image-delivery-insight (Est savings of 126 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight
- max-potential-fid (90 ms)
- uses-responsive-images (Est savings of 121 KiB)
- unused-javascript (Est savings of 55 KiB)
- legacy-javascript (Est savings of 14 KiB)
- largest-contentful-paint-element (1,250 ms)
- unsized-images
- label-content-name-mismatch
- errors-in-console

### /th/voice — mobile
- first-contentful-paint (2.7 s)
- largest-contentful-paint (4.0 s)
- total-blocking-time (140 ms)
- speed-index (4.1 s)
- cache-insight (Est savings of 3 KiB)
- forced-reflow-insight
- image-delivery-insight (Est savings of 18 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight
- interactive (4.0 s)
- max-potential-fid (130 ms)
- unused-javascript (Est savings of 53 KiB)
- legacy-javascript (Est savings of 13 KiB)
- largest-contentful-paint-element (3,970 ms)
- color-contrast
- errors-in-console

### /th/voice — desktop
- first-contentful-paint (0.7 s)
- largest-contentful-paint (0.9 s)
- speed-index (1.0 s)
- cache-insight (Est savings of 62 KiB)
- forced-reflow-insight
- image-delivery-insight (Est savings of 5 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight
- unused-javascript (Est savings of 53 KiB)
- legacy-javascript (Est savings of 13 KiB)
- color-contrast
- label-content-name-mismatch
- errors-in-console

### /th?tab=council — mobile
- first-contentful-paint (1.9 s)
- speed-index (2.9 s)
- cache-insight (Est savings of 3 KiB)
- forced-reflow-insight
- image-delivery-insight (Est savings of 152 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- render-blocking-insight
- max-potential-fid (170 ms)
- dom-size (885 elements)
- mainthread-work-breakdown (4.4 s)
- label-content-name-mismatch
- errors-in-console

### /th?tab=council — desktop
- first-contentful-paint (0.7 s)
- largest-contentful-paint (1.2 s)
- speed-index (1.3 s)
- cache-insight (Est savings of 92 KiB)
- forced-reflow-insight
- image-delivery-insight (Est savings of 126 KiB)
- legacy-javascript-insight (Est savings of 14 KiB)
- network-dependency-tree-insight
- render-blocking-insight
- uses-responsive-images (Est savings of 133 KiB)
- unused-javascript (Est savings of 53 KiB)
- legacy-javascript (Est savings of 14 KiB)
- dom-size (885 elements)
- largest-contentful-paint-element (1,240 ms)
- label-content-name-mismatch
- errors-in-console
- robots-txt
