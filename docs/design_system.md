# NexusSphere UI/UX Design System

## 1. Core Aesthetic "Cyber-Pop & Holographic Glass"

The visual identity of NexusSphere is a blend of **high-energy arcade rhythm styling (Cyber-Pop)** and **modern sleek UI (Holographic Glass)**. It moves away from flat web design and leans heavily into dynamic canvas-based rendering with deep shadows, glowing neon outlines, and rich gradients.

### Key Principles

- **Vibrant & Legible Contrast**: Dark backgrounds with highly saturated, luminous foreground elements.
- **Dimensionality**: Elements must not feel flat. Use drop shadows, inner gloss (top highlights), and thick outer strokes.
- **Dynamic Energy**: Static screens are dead screens. Always have subtle animations (breathing glows, floating particles, sweeping highlights).
- **Rounded but Technical**: UI panels use rounded corners (`roundRect` with 12px~20px radii) combined with tech-inspired accents like tabs or floating badges.

---

## 2. Color Palette System

### Primary Backgrounds (The Void)

- `#1e272e` (Deep Space Dark)
- `rgba(15, 20, 35, 0.85)` (Translucent Dark Blue Panel Background)
- Backgrounds should often use radial gradients or subtle noise to prevent "flat black" dead spaces.

### Action Colors & Gradients (The Energy)

- **Deep Crimson to Vivid Pink**: `#c0001a` → `#ff3a00` → `#ffd700` → `#ffffff` (Used for extremely high-priority text like Song Titles).
- **Gold & Orange Warning/Accent**: `#f9ca24` to `#f0932b` (Used for primary CTA buttons like "PLAY NOW").
- **Electric Cyan & Sky Blue**: `#00bcd4` / `#0ea5e9` (Used for selection highlights, scrollbars, and secondary UI).
- **Neon Hot Pink/Purple**: `#e91e8c` / `#9b59b6` (Used for Options/Settings accents).

### Panels & Borders

- Panels always use an `rgba(255,255,255, 0.05)` to `0.1` background fill.
- Outer borders stroke with a bright, colored solid line.
- Each major panel has a designated "Theme Color" for its border and tab (e.g., Info=Gold, Options=Pink, List=Cyan).

---

## 3. Typography & Text Styling

- **Font Family**: Primary font is `"Nunito", sans-serif`, weight `800` (ExtraBold) or `900` (Black).
- **Standard Cute Label**:
  - `ctx.fillText` with solid bright color.
  - Option to add `ctx.strokeText` (black or dark color, `lineWidth` 3~4) for separation from background.
  - Apply `ctx.shadowColor = 'rgba(0,0,0,0.85)'`, `shadowOffsetY = 3`, `shadowBlur = 6`.
  - *Rule*: Never let text blend into an active animated background. Always prioritize readability.

---

## 4. UI Components

### Floating Tabs (Panel Headers)

- Located slightly above and intersecting the top-left of a panel.
- Small text (`14px`), bold white with a thick black outline.
- Tab background matches the panel's theme color border.

### CTA (Call to Action) Buttons

- Full width or prominent placement.
- **Gradient Fill**: Multi-stop vibrant color (e.g., Purple to Gold).
- **Glow**: Intense, pulsating drop shadow (`shadowBlur` reacting to time/sine wave).
- **Gloss**: A top-half white-to-transparent overlay to give a glassy, 3D shiny button look.
- **Border**: Thick white or brightly colored outer border.

### Scrollbars

- Unusually thick for touch-friendly design (`28px` width).
- Translucent track background.
- Vibrantly colored gradient thumb with its own glow, positioned tightly within the bounding box.

---

## 5. Animation Guidelines

- **Pulsing (Breathing)**: Use `Math.sin(time)` linked to `shadowBlur` or `globalAlpha` for elements demanding attention (Play Button, Warning text).
- **Continuous Flow**: Background gradients or particle systems should never stop moving, but should be slow enough not to distract (e.g., floating bubbles, falling stardust, rotating grids).
- **Performance First**: Avoid animating expensive Canvas operations (like `shadowBlur` changing wildly with thousands of particles) unless explicitly isolated per item/layer.
