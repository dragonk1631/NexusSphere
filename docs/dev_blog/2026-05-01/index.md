# Developer Blog: UI Stability & Server-Authoritative Data Architecture

**Date:** 2026-05-01  
**Category:** UI/UX, Data Architecture, Database Optimization  
**Author:** Antigravity (AI Coding Assistant)

---

## 🚀 Today's Objective

The primary goals today were twofold:
1. **UI/UX**: Achieve perfect visual consistency and layout stability across the Collection and Shop interfaces.
2. **Data Integrity**: Completely overhaul the data synchronization logic to implement a strictly Server-Authoritative architecture, permanently resolving "zombie data" issues.

## 🛠️ Key Accomplishments

### 1. Collection UI: The "Natural Sync" Strategy

Previously, the guest login button and emblem were causing significant vertical layout shifts on mobile, pushing the statistics grid and song lists out of the viewport.

- **Structural Decoupling**: Moved the Guest Login button from the Profile section (Left) to the Progression section (Right), placing it adjacent to the Emblem. This isolated the profile's height from authentication state changes.
- **Ultra-Slim Mobile Header**:
- Reduced **Avatar** size to **32px** (from 60px) on mobile.
- Reduced **Emblem** size to **32px** (from 60px) on mobile.
- Compressed **Header Padding** to **6px-10px** to reclaim vertical real estate.
- **PC Identity Restoration**: Successfully restored the high-fidelity **60px** emblem and generous **30px** padding for desktop users, ensuring the "premium" feel remains intact where space is abundant.
- **Vertical Calibration**: Applied precise `translateY(-2px)` offsets to prevent interactive elements from clipping with the header borders on compact mobile screens.

### 2. Shop UI: Product-First Layout

The Shop's guest notification banner was identified as a "layout inhibitor," taking up too much space and shrinking the actual item grid.

- **Banner Slim-down**: Reduced the banner padding by 50% (from 12px to 6px) and simplified the call-to-action text.
- **Mobile Grid Restoration**: By slimming the banner to a mere **40px** total height, we returned critical vertical space to the `.theme-grid`, allowing shop items to display at their intended, readable sizes on mobile.

## 📉 Technical Challenges & Solutions

| Challenge | Solution |
| :--- | :--- |
| **Height Instability** | Abandoned fixed-height "hacks" in favor of making guest elements smaller than the base "Avatar + Username" row, ensuring zero shift during state transitions. |
| **PC/Mobile Conflict** | Utilized strict Media Query isolation to allow PC elements to remain large and premium while mobile elements are aggressively scaled down. |
| **Visual Clipping** | Re-calibrated vertical alignment using `align-items: center` and micro-offsets to keep elements perfectly centered within tight paddings. |

### 3. Server-Authoritative Data Architecture Redesign

We faced a critical "Zombie Data" issue where deleted database records would mysteriously reappear upon login. 

- **Root Cause Analysis**: 
  1. The client heavily relied on `localStorage` even when logged in, causing dual sources of truth.
  2. Legacy PWA Service Workers were aggressively caching old JavaScript bundles (`skipWaiting` was missing), meaning players were executing outdated logic that read from contaminated `v2` storage keys.
  3. `sync.ts` had a dangerous "auto-migration" fallback that tried to resurrect data from legacy `user_scores` tables if the `v2` tables were empty.
- **The "Server is Truth" Paradigm**: Completely rewrote `ScoreManager.ts`, `sync.ts`, and `submit.ts`. When a user logs in, `localStorage` is completely ignored. The server dictates Level, XP, and stats. If the server says the user has 0 records, the client renders 0 records.
- **PWA Cache Purge**: Added a strict runtime block at the top of `main.ts` to iterate through and obliterate all legacy `localStorage` keys before the app even initializes. We also updated `vite.config.ts` to enforce `skipWaiting: true` and `clientsClaim: true`, ensuring immediate rollout of patches.

### 4. D1 Database Query Optimization (Zero-Write Leveling)

To maximize the Cloudflare D1 Free Tier (100,000 Writes/Day), we aggressively optimized the `submit.ts` API.

- **The Old Way (4 Writes, 1 Read)**: `INSERT user_stats` -> `INSERT rank_stats` -> `INSERT song_records` -> `SELECT exp` -> `UPDATE user_stats SET level`.
- **The Optimized Way (3 Writes, 0 Reads)**: 
  - Utilized SQLite's `RETURNING` clause on the very first `INSERT` query to instantly grab the updated `exp`.
  - **Zero-Write Leveling**: Realized that `level` is strictly a derived metric of `exp`. We stopped saving `level` to the database entirely, saving 1 Write per song play. The server now dynamically calculates the level using `Math.floor((-40 + Math.sqrt(1600 + 160 * currentExp)) / 80 + 1)` right before returning the JSON payload.
- **Impact**: Reduced Write costs by 25% and Read costs by 100% on the core gameplay loop, theoretically allowing up to 3,333 Daily Active Users (DAU) entirely for free.

## 💡 Lessons Learned

- **Content-Driven Scaling**: Layout stability is best achieved when conditional elements (like login buttons) are designed to fit within the "footprint" of permanent elements.
- **Mobile First, PC Premium**: A "one size fits all" approach often sacrifices the premium feel of desktop or the usability of mobile. Strict divergence via media queries is essential for high-fidelity rhythm game UIs.
- **Beware the Service Worker**: In PWA environments, aggressive caching can trap users in broken states for days. Always ensure proper `skipWaiting` protocols and runtime sanity checks for critical data keys.
- **Normalize, Don't Materialize**: If a value (like Level) can be perfectly mathematically derived from another column (like XP), do not waste database write operations storing it. Calculate it on the fly.

---

## 🔮 Next Steps

- **Functional Validation**: Test the sync process flow from the new slimmed-down mobile buttons.
- **Consistency Audit**: Apply similar slim-down logic to the Ranking and Settings headers if necessary.
- **Asset Optimization**: Ensure the smaller mobile icons remain sharp via SVG optimization.

---

Documented by Antigravity - NexusSphere UI/UX Refinement Team
