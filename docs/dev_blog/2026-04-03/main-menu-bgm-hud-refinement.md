# Dev Blog: Main Menu UI Overhaul — HUD Refinement & True Balance
**Date:** 2026-04-03  
**Category:** UI/UX, Responsive Design, Audio Integration

## Overview
Today's deep-dive session transformed the Main Menu from a rigid grid-based interface into a dynamic, **True Centered** premium experience. We focused on achieving perfect visual balance between the persistent HUD and the footer across all aspect ratios, including mobile.

---

## Key Improvements

### 1. True Vertical Centering (v51)
We replaced the previous grid-based layout with a sophisticated **Flexbox Content Stack**.
- **The "Central Content" Wrapper**: The Title Box and Main Panel are now grouped together and anchored to the absolute center of the available space between the Header and Footer.
- **Cinematic Proportions**: Cards were redesigned with a **1.4 : 1** aspect ratio, and central icon density was restored to **2.8rem** for a more "industrial-grade" high-end density.
- **Golden Spacing**: Implemented a fixed **50px** gap between the menu title and the panel for a spacious, professional feel.

### 2. Critical Mobile Responsiveness (v52)
To ensure the menu is fully playable and beautiful on mobile, we implemented a series of **Media Query-driven protection rules**.
- **Automatic Scaling**: On smaller viewports (height < 700px), the panel height, vertical gaps, and title padding automatically scale down.
- **Footer Stability**: Guaranteed the visibility of settings and language flags on small screens by forcing `flex-shrink: 0` on the navigation bar, preventing it from being pushed off-screen by content.
- **Vibrancy Restoration**: Restored 100% opacity to card gradients, ensuring the colors remain punchy and "neon" regardless of the background.

### 3. Transparency & Vibrancy Swap (v53)
We "swapped" the transparency relationship between the panels and the background to enhance depth.
- **Premium Glass Base**: Shifted the Title and Panel backgrounds from "transparent white glass" to **"Solid Dark Glass" (0.45 ~ 0.55 opacity)**. This makes the vibrant cards and white text pop significantly more.
- **Scene Clarity**: Reduced full-screen vignette and gradient dimming by **50%**. This lets the background scene (and the game's atmosphere) feel more open and transparent, contrasted against the solid, trustworthy UI panels.
- **High-Definition Edges**: Increased `backdrop-filter` blur to **16px** and sharpened border highlights for that "edge-light" premium finish.

### 4. Seamless BGM Marquee & HUD Integration
- **Marquee**: Implemented a **Dual-Span** marquee for perfectly seamless BGM filename loops.
- **Visualizer**: Added a CSS-animated **3-bar visualizer** next to the BGM text to provide rhythmic feedback.

## Technical Details
- **File Heavily Refined**: `src/ui/MainMenu.ts`
- **New Architecture**: Flexbox-centered stack instead of fixed grid.
- **Responsive Logic**: CSS `clamp()` and Media Queries for height-sensitive scaling.

---
*Nexus Sphere Development Team*
