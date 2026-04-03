# Dev Blog: Main Menu HUD Refinement & Seamless BGM Marquee
**Date:** 2026-04-03  
**Category:** UI/UX, Audio Integration

## Overview
Today's update focused on refining the Main Menu interface to provide a more premium, "arcade-grade" feel. The primary change involved relocating the background music (BGM) information to the top HUD and implementing a sophisticated, non-stopping marquee animation.

## Key Improvements

### 1. HUD Integration & Glassmorphism
The song title, previously located in the bottom-left corner, has been moved to the **top-center** of the screen. It is now seamlessly integrated into the Top HUD, perfectly balanced between the version label and the currency badges.
- **Styling**: Applied enhanced glassmorphism with `backdrop-filter: blur(12px)` and a highly transparent background (`rgba(255, 255, 255, 0.05)`).
- **Alignment**: The height and padding were meticulously matched to the surrounding HUD elements to create a unified visual experience.

### 2. Actual Filename Display
Following the design philosophy of technical transparency, the display now shows the **actual music filename** (e.g., `정상을_향해_더_높이.mp3`) instead of a generic song title. This gives the game a more "raw" industrial/arcade vibe.

### 3. Perfectly Seamless "Dual-Span" Marquee
To solve the common "choppy" transition at the end of marquee loops, we implemented a **Dual-Span** technique:
- The text is rendered twice in identical side-by-side elements.
- The container animate-scrolls by exactly 50% of its width.
- This creates a mathematically perfect, invisible loop point.
- **Continuous Flow**: Removed all animation pauses to ensure a 100% constant, linear horizontal scroll that indicates active playback at all times.

### 4. Rhythmic Visualizer
Replaced the static music icon with a CSS-only **3-bar visualizer**. Each bar animates at a different frequency and height, mimicking a live equalizer and providing a dynamic visual cue that the BGM is active.

### 5. Centered Initial State & Masking
- The marquee viewport features a **linear-gradient mask** at both edges, causing the text to smoothly fade in and out of view.
- The title is now centered within its HUD window from the very first frame, ensuring the layout never feels "unstable" or "half-baked" during the menu entrance transition.

## Technical Details
- **File Modified**: `src/ui/MainMenu.ts`
- **Animations**: CSS Keyframes (`mm-marquee`, `mm-vis-jump`)
- **Rendering Logic**: Updated `updateBGMText()` to support multi-element target updates and filename extraction.

---
*Nexus Sphere Development Team*
