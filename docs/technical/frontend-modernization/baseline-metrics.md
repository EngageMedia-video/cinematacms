# Frontend Baseline Metrics

**Date**: 2026-02-19
**Branch**: `main` at `23cbd97`
**React**: 17.0.2
**Build system**: Webpack 5

---

## Build Time

| Run | Wall clock | CPU (user+sys) |
|-----|-----------|----------------|
| 1   | 14.6s     | 42.6s          |
| 2   | 13.5s     | 41.6s          |

## Per-Entry Bundle Sizes

### JavaScript

| Entry | Raw (bytes) | Gzipped (bytes) |
|-------|------------|-----------------|
| _commons | 1,194,009 | 333,219 |
| add-media | 4,184 | 1,724 |
| base | 4,184 | 1,721 |
| categories | 7,588 | 2,811 |
| countries | 7,598 | 2,813 |
| demo | 10,026 | 3,632 |
| embed | 24,881 | 7,850 |
| error | 9,057 | 3,272 |
| featured | 7,463 | 2,818 |
| history | 6,123 | 2,357 |
| index | 22,473 | 6,505 |
| languages | 7,596 | 2,814 |
| latest | 7,454 | 2,816 |
| liked | 6,110 | 2,363 |
| manage-comments | 3,832 | 1,660 |
| manage-media | 8,374 | 2,764 |
| manage-users | 6,321 | 2,414 |
| media | 16,138 | 4,780 |
| members | 19,568 | 5,372 |
| playlist | 29,003 | 8,829 |
| profile-about | 9,279 | 3,216 |
| profile-home | 3,869 | 1,685 |
| profile-playlists | 4,931 | 2,073 |
| recommended | 7,475 | 2,828 |
| search | 19,470 | 5,520 |
| tags | 7,548 | 2,790 |
| topics | 7,654 | 2,807 |

**Total JS**: 1,462,812 bytes raw / ~429,678 bytes gzipped

### CSS

| Entry | Raw (bytes) | Gzipped (bytes) |
|-------|------------|-----------------|
| _commons | 304,008 | 50,513 |
| _extra | 70,189 | 9,660 |
| add-media | 9,930 | 2,161 |
| demo | 1,852 | 623 |
| embed | 210 | 170 |
| error | 6,847 | 1,526 |
| history | 16,910 | 2,655 |
| liked | 16,910 | 2,653 |
| media | 52,436 | 6,402 |
| members | 715 | 279 |
| playlist | 21,795 | 3,317 |
| profile-about | 16,910 | 2,661 |
| profile-home | 16,910 | 2,660 |
| profile-playlists | 16,910 | 2,665 |

**Total CSS**: 551,532 bytes raw / ~87,945 bytes gzipped

## Per-Page Gzipped Transfer Sizes (Top 5)

| Page | JS (gz) | CSS (gz) | Total (gz) |
|------|---------|----------|------------|
| Home (`/`) | 339,724 | 60,173 | 399,897 |
| Media (`/view?m=...`) | 337,999 | 66,575 | 404,574 |
| Search (`/search`) | 338,739 | 60,173 | 398,912 |
| Profile (`/user/...`) | 334,904 | 62,833 | 397,737 |
| Error (404) | 336,491 | 61,699 | 398,190 |

## npm audit

24 vulnerabilities (1 low, 1 moderate, 22 high)

Key issues:
- `grunt` / `load-grunt-tasks` / `multimatch`: dependency chain vulnerabilities
- `qs` 6.7.0-6.14.1: arrayLimit bypass (DoS)
- `tar` <=7.5.7: race condition, hardlink traversal (high severity)

All are in dev/build dependencies, not shipped to production.
