/**
 * Constants used throughout the menu rendering system.
 * By centralizing these magic numbers, we can easily tweak the UI
 * globally without tearing apart the rendering logic.
 */
export const MENU_LAYOUT = {
    // ── Shared Panel Metrics ──
    HEADER_HEIGHT: 34,           // Height of standard panel headers (INFO, OPTION, LIST)
    PANEL_BORDER_RADIUS: 10,     // Corner radius for main glass panels
    PANEL_HEADER_RADIUS: [10, 10, 0, 0], // Radius for panel headers

    // ── Song Info Panel Details (Left Panel Top) ──
    INFO_EQ_RATIO: 0.72,         // 72% of info height goes to EQ Visualizer
    INFO_ITEM_GAP_RATIO: 0.08,   // 8% gap in info panel

    // ── Score & Meta Boxes (Under Visualizer) ──
    SCORE_BOX_HEIGHT_RATIO: 0.45,
    SCORE_BOX_PADDING: 8,
    META_BOX_HEIGHT_RATIO: 0.50,
    META_BOX_GAP: 6,

    // ── Options Panel Details (Left Panel Bottom) ──
    OPTION_TILE_HEIGHT: 54,      // Height of interactive tile
    OPTION_TAB_HEIGHT: 22,       // Height of subtitle tab
    OPTION_CORNER_RADIUS: [0, 0, 11, 11],

    // ── Song List Panel Details (Right Panel) ──
    SONG_LIST_PADDING: 15,
    SONG_LIST_ITEM_PADDING: 12,
    SONG_LIST_ITEM_RADIUS: 6,
    SONG_LIST_SELECTED_GLOW: 15, // Max blur for selected items

    // ── Typography Guidelines ──
    TEXT_SHADOW_BLUR_DEFAULT: 5,
    TEXT_SHADOW_BLUR_STRONG: 10,

    // ── Colors / Opacities ──
    OPACITY_GLASS_BG: 0.25,
    OPACITY_DULL_GLASS: 0.05,
    OPACITY_HEADER_BASE: 0.65,
} as const;
