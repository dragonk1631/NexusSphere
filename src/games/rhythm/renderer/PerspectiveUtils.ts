
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
    const startX = Math.floor((config.width - totalWidthAtY) / 2);
    return startX + (laneIndex * laneWidthAtY);
}

export function getPerspectiveWidth(y: number, config: PerspectiveConfig): number {
    const t = (y - config.horizonY) / (config.bottomY - config.horizonY);
    const totalWidthAtY = (config.laneTopWidth * config.laneCount) +
        ((config.laneBottomWidth * config.laneCount) - (config.laneTopWidth * config.laneCount)) * t;
    return totalWidthAtY / config.laneCount;
}

export function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
