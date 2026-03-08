
/**
 * Perspective-related calculations for the highway rendering.
 * Should be shared between HighwayRenderer and HUDRenderer.
 */

export interface PerspectiveConfig {
    width: number;
    horizonY: number;
    bottomY: number;
    laneCount: number;
    laneTopWidth: number;
    laneBottomWidth: number;
}

export function getPerspectiveX(laneIndex: number, y: number, config: PerspectiveConfig): number {
    const t = (y - config.horizonY) / (config.bottomY - config.horizonY);
    const laneWidthAtY = config.laneTopWidth + (config.laneBottomWidth - config.laneTopWidth) * t;
    const totalWidthAtY = laneWidthAtY * config.laneCount;
    const startX = (config.width - totalWidthAtY) / 2;
    return startX + (laneIndex * laneWidthAtY);
}

export function getPerspectiveWidth(y: number, config: PerspectiveConfig): number {
    const t = (y - config.horizonY) / (config.bottomY - config.horizonY);
    const totalWidthAtY = (config.laneTopWidth * config.laneCount) +
        ((config.laneBottomWidth * config.laneCount) - (config.laneTopWidth * config.laneCount)) * t;
    return totalWidthAtY / config.laneCount;
}

/**
 * Calculates lane widths based on requested note width at hit line.
 * @returns { laneTopWidth, laneBottomWidth }
 */
export function calculateLayout(
    hitLineY: number,
    horizonY: number,
    bottomY: number,
    targetNoteWidth: number,
    topRatio: number
): { laneTopWidth: number, laneBottomWidth: number } {
    const t = (hitLineY - horizonY) / (bottomY - horizonY);
    const laneBottomWidth = targetNoteWidth / (topRatio + (1 - topRatio) * t);
    const laneTopWidth = laneBottomWidth * topRatio;
    return { laneTopWidth, laneBottomWidth };
}

/**
 * Converts linear progress [0, 1] to perspective-projected progress.
 */
export function projectProgress(linearProgress: number, pDepth: number): number {
    return linearProgress / (pDepth - (pDepth - 1) * linearProgress);
}

/**
 * Calculates the projected Y coordinate based on linear progress.
 */
export function getProjectedY(linearProgress: number, horizonY: number, hitLineY: number, pDepth: number): number {
    const projected = projectProgress(linearProgress, pDepth);
    return horizonY + (hitLineY - horizonY) * projected;
}

export function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
