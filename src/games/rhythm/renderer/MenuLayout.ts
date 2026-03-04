/**
 * MenuLayoutResult defines all calculated coordinates and dimensions for the rhythm game menu.
 * This ensures that rendering and hit detection logic stay 100% in sync.
 */
export interface MenuLayoutResult {
    // ── Common ──
    tabH: number;
    padding: number;

    // ── Left Panels (Song Info & Options) ──
    leftPanelWidth: number;
    leftPanelX: number;

    // Song Info Panel
    visPanelY: number;
    visPanelH: number;

    // Options Panel
    infoY: number; // Final Y for the Options panel draw starting point
    infoH: number;
    optH: number;
    optW: number;
    col1CenterX: number;    // Center X of column 1
    col2CenterX: number;    // Center X of column 2
    col3CenterX: number;    // Center X of column 3
    row1CenterY: number;    // Center Y of row 1 (Interactive area)
    row2CenterY: number;    // Center Y of row 2 (Legacy/Alias)
    row3CenterY: number;    // Center Y of row 3 (Legacy/Alias)
    hitWidth: number;       // Horizontal collision radius for buttons
    hitHeight: number;      // Vertical collision radius for buttons

    // ── Right Panel (Song List) ──
    listX: number;
    listY: number; // Final Y for the Song List panel draw starting point
    listW: number;
    listH: number;
    listInnerY: number;     // Starting Y of list content (below tabs)
    listContentX: number;   // Starting X of list content (excluding scrollbar)
    listHitMaxX: number;    // Max X for clicking on list items
    itemHeight: number;     // Height of a single song list item
    visibleCount: number;   // Number of visible items on screen

    // ── PLAY Button ──
    btnX: number;
    btnY: number;
    btnW: number;
    btnH: number;

    // ── Top Main Menu Button ──
    mainMenuBtnX: number;   // Starting X of top right button
    mainMenuBtnY: number;   // Starting Y of top right button
    mainMenuBtnW: number;   // Width of the button
    mainMenuBtnH: number;   // Height of the button

    // ── Global Scaling ──
    scaleFactor: number;
}

/**
 * Computes the menu layout based on screen dimensions and device type.
 */
export function computeMenuLayout(width: number, height: number, isMobile: boolean): MenuLayoutResult {
    // 1. Calculate Universal Scale Factor (Landscape Only)
    const baseWidth = 1200;
    const baseHeight = 800;
    let scaleFactor = Math.min(width / baseWidth, height / baseHeight);

    // Visibility Boost for Mobile
    const visibilityBoost = isMobile ? 1.25 : 1.15;
    scaleFactor = Math.max(0.65, scaleFactor) * visibilityBoost;

    const padding = Math.floor(20 * scaleFactor);
    const tabH = Math.floor(26 * scaleFactor);

    // Panel Widths
    const leftPanelWidth = Math.min(width * 0.45, 540 * scaleFactor);
    const leftPanelX = padding;

    // TARGET TOTAL HEIGHT (Symmetric with Right Panel)
    const targetTotalH = height - padding * 2;

    // LEFT PANEL 2: OPTIONS (Fixed height, matches logic to fill bottom to same level as right panel)
    const infoH = Math.max(160 * scaleFactor, targetTotalH * 0.22);
    const infoY = Math.floor(height - padding - infoH);

    // LEFT PANEL 1: SONG INFO (Expands to fill everything above)
    const visPanelY = padding;
    const visPanelH = Math.floor(infoY - visPanelY - padding);

    // RIGHT PANEL: SONG LIST (Occupies full target height)
    const listX = Math.floor(leftPanelX + leftPanelWidth + padding);
    const listW = Math.floor(width - listX - padding);
    const listY = padding;
    const listH = targetTotalH;

    // Song List Item Layout
    const listInnerY = Math.floor(listY + tabH + (10 * scaleFactor));
    const visibleCount = isMobile ? 5 : 7;
    const btnAreaH = Math.max(50 * scaleFactor, height * 0.09);

    const listAvailH = Math.floor(listH - tabH - (20 * scaleFactor) - btnAreaH);
    const itemHeight = Math.floor(listAvailH / visibleCount);

    // Play Button
    const btnH = Math.floor(btnAreaH);
    const btnW = Math.floor(listW);
    const btnX = Math.floor(listX);
    const btnY = Math.floor(listY + listH - btnH);

    // Options Grid (Optimized for 3 items: Difficulty, Speed, KeyMode)
    const padUI = Math.floor(12 * scaleFactor);
    const innerH = Math.floor(infoH - 34 * scaleFactor - padUI * 2);
    const innerW = Math.floor(leftPanelWidth - padUI * 2);

    const optH = innerH;
    const itemW = Math.floor(innerW / 3);

    const col1CenterX = Math.floor(leftPanelX + padUI + itemW * 0.5);
    const col2CenterX = Math.floor(col1CenterX + itemW);
    const col3CenterX = Math.floor(col2CenterX + itemW);

    const row1CenterY = Math.floor(infoY + 34 * scaleFactor + (infoH - 34 * scaleFactor) * 0.5);

    const hitWidth = Math.floor(itemW * 0.45);
    const hitHeight = Math.floor((infoH - 34 * scaleFactor) * 0.45);

    // Precise coordinates for Song titles and Hits
    const scrollbarW = Math.floor(28 * scaleFactor);
    const listContentX = Math.floor(listX + scrollbarW + (10 * scaleFactor));
    const listHitMaxX = Math.floor(listX + listW);

    // Top Right Exit Button
    const mainMenuBtnW = Math.floor(120 * scaleFactor);
    const mainMenuBtnH = Math.floor(28 * scaleFactor);
    const mainMenuBtnX = Math.floor(width - padding - mainMenuBtnW);
    const mainMenuBtnY = Math.floor(10 * scaleFactor);

    return {
        padding: Math.floor(padding),
        tabH: Math.floor(tabH),
        leftPanelWidth: Math.floor(leftPanelWidth),
        leftPanelX: Math.floor(leftPanelX),
        visPanelY,
        visPanelH,
        infoY,
        infoH,
        optH,
        optW: itemW,
        col1CenterX,
        col2CenterX,
        col3CenterX,
        row1CenterY,
        row2CenterY: row1CenterY,
        row3CenterY: row1CenterY,
        hitWidth,
        hitHeight,
        listX,
        listY,
        listW,
        listH,
        listInnerY: Math.floor(listInnerY),
        listContentX,
        listHitMaxX,
        itemHeight: Math.floor(itemHeight),
        visibleCount,
        btnX: Math.floor(btnX),
        btnY: Math.floor(btnY),
        btnW: Math.floor(btnW),
        btnH: Math.floor(btnH),
        mainMenuBtnX,
        mainMenuBtnY,
        mainMenuBtnW,
        mainMenuBtnH,
        scaleFactor
    };
}
