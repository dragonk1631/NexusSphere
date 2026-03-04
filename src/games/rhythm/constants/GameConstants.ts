export const LANE_COLORS = [
    ['#ff0066', '#ff3385'], // Lane 0: Neon Pink
    ['#ffcc00', '#ffdb4d'], // Lane 1: Electric Gold
    ['#00ff99', '#33ffad'], // Lane 2: Spring Green
    ['#00e5ff', '#33ebff'], // Lane 3: Cyber Cyan
    ['#2979ff', '#5393ff'], // Lane 4: Azure Blue
    ['#aa00ff', '#bb33ff'], // Lane 5: Electric Purple
] as const;

export const JUDGMENT_WINDOWS = {
    PERFECT: 70,
    GREAT: 120,
    GOOD: 160,
    HIT: 170
} as const;

export const SPEED_OPTIONS = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0] as const;

export const DIFFICULTY_OPTIONS = ['EASY', 'NORMAL', 'HARD'] as const;

export const HUD_PALETTES: Record<string, {
    hpPanel: string;
    scorePanel: string;
    hpBarMid: string;
    hpBarEnd: string;
    hpBarStart: string;
    labelFill: string;
    labelShadow: string;
    comboFill: string;
    comboOutline: string;
    comboGlow: string;
    comboGradTop: string;
    comboGradBot: string;
    scoreFill: string;
    scoreGlow: string;
}> = {
    'deep-space': {
        hpPanel: '#e056a0',
        scorePanel: '#00e5ff',
        hpBarMid: '#e056a0', hpBarEnd: '#00e5ff', hpBarStart: '#4a6cf7',
        labelFill: '#e8daef', labelShadow: '#9b59b6',
        comboFill: '#ffffff', comboOutline: '#1a1a2e', comboGlow: '#00e5ff',
        comboGradTop: '#00e5ff', comboGradBot: '#e056a0',
        scoreFill: '#ffffff', scoreGlow: '#00e5ff',
    },
    'cyber-neon': {
        hpPanel: '#FF0055',
        scorePanel: '#00F0FF',
        hpBarMid: '#FF0055', hpBarEnd: '#00F0FF', hpBarStart: '#7000FF',
        labelFill: '#e0e0e0', labelShadow: '#FF0055',
        comboFill: '#ffffff', comboOutline: '#0a0a1a', comboGlow: '#00F0FF',
        comboGradTop: '#00F0FF', comboGradBot: '#FF0055',
        scoreFill: '#ffffff', scoreGlow: '#00F0FF',
    },
    'sunset-overdrive': {
        hpPanel: '#FF416C',
        scorePanel: '#FFD700',
        hpBarMid: '#FF6B6B', hpBarEnd: '#FFD700', hpBarStart: '#FF8E53',
        labelFill: '#fff5e6', labelShadow: '#FF416C',
        comboFill: '#ffffff', comboOutline: '#2d1b2e', comboGlow: '#FF416C',
        comboGradTop: '#FFD700', comboGradBot: '#FF416C',
        scoreFill: '#ffffff', scoreGlow: '#FFD700',
    },
    'matrix-grid': {
        hpPanel: '#00CC66',
        scorePanel: '#00FF00',
        hpBarMid: '#00CC66', hpBarEnd: '#00FF00', hpBarStart: '#003300',
        labelFill: '#b8f5d0', labelShadow: '#009933',
        comboFill: '#00FF00', comboOutline: '#001a00', comboGlow: '#00FF00',
        comboGradTop: '#88FF88', comboGradBot: '#00CC00',
        scoreFill: '#00FF00', scoreGlow: '#00FF00',
    },
    'vaporwave': {
        hpPanel: '#FF80CC',
        scorePanel: '#FF80CC',   // Vaporwave Pink — matches purple/pink bg
        hpBarMid: '#b388ff', hpBarEnd: '#00FFFF', hpBarStart: '#FF00FF',
        labelFill: '#e8d5f5', labelShadow: '#9c27b0',
        comboFill: '#ffffff', comboOutline: '#1a0a2e', comboGlow: '#b388ff',
        comboGradTop: '#FF80CC', comboGradBot: '#b388ff',
        scoreFill: '#ffffff', scoreGlow: '#FF80CC',
    },
    'midnight-ocean': {
        hpPanel: '#1F8A70',
        scorePanel: '#4dd0e1',    // Teal Cyan — harmonizes with deep navy/teal bg
        hpBarMid: '#1F8A70', hpBarEnd: '#64ffda', hpBarStart: '#004D40',
        labelFill: '#d4efdf', labelShadow: '#117a65',
        comboFill: '#ffffff', comboOutline: '#001a12', comboGlow: '#64ffda',
        comboGradTop: '#64ffda', comboGradBot: '#1F8A70',
        scoreFill: '#ffffff', scoreGlow: '#4dd0e1',
    },
    'crimson-flare': {
        hpPanel: '#FF6600',
        scorePanel: '#FFCC00',
        hpBarMid: '#FF6600', hpBarEnd: '#FFCC00', hpBarStart: '#8B0000',
        labelFill: '#ffe0b2', labelShadow: '#bf360c',
        comboFill: '#ffffff', comboOutline: '#1a0000', comboGlow: '#FFCC00',
        comboGradTop: '#FFCC00', comboGradBot: '#FF6600',
        scoreFill: '#ffffff', scoreGlow: '#FFCC00',
    },
    'marchen': {
        hpPanel: '#e91e8c',
        scorePanel: '#f48fb1',    // Pastel Pink — fairy-tale warmth
        hpBarMid: '#f06292', hpBarEnd: '#f8bbd9', hpBarStart: '#880e4f',
        labelFill: '#fce4ec', labelShadow: '#ad1457',
        comboFill: '#ffffff', comboOutline: '#2d0a2e', comboGlow: '#ce93d8',
        comboGradTop: '#f8bbd9', comboGradBot: '#e91e8c',
        scoreFill: '#ffffff', scoreGlow: '#f48fb1',
    },
    'monochrome-tech': {
        hpPanel: '#888888',
        scorePanel: '#DDDDDD',
        hpBarMid: '#888888', hpBarEnd: '#DDDDDD', hpBarStart: '#333333',
        labelFill: '#cccccc', labelShadow: '#555555',
        comboFill: '#ffffff', comboOutline: '#111111', comboGlow: '#DDDDDD',
        comboGradTop: '#ffffff', comboGradBot: '#999999',
        scoreFill: '#ffffff', scoreGlow: '#DDDDDD',
    },
    'winter-snow': {
        hpPanel: '#4fc3f7',
        scorePanel: '#b2ebf2',
        hpBarMid: '#29b6f6', hpBarEnd: '#b2ebf2', hpBarStart: '#01579b',
        labelFill: '#e0f7fa', labelShadow: '#0288d1',
        comboFill: '#ffffff', comboOutline: '#05122C', comboGlow: '#80deea',
        comboGradTop: '#b2ebf2', comboGradBot: '#0288d1',
        scoreFill: '#ffffff', scoreGlow: '#80deea',
    },
};

export const MAX_PARTICLES = 300;
export const JUDGMENT_DURATION = 500;
export const HORIZON_Y_RATIO = 0.0;
export const BOTTOM_Y_RATIO = 1.0;
export const HIT_LINE_Y_RATIO = 0.85;

export const LANE_BORDER = '#444444';
export const HIT_LINE_GLOW = '#00ffff';
export const HUD_BG = 'rgba(0, 0, 0, 0.7)';
export const TEXT_GLOW = '#ffffff';

export const INITIAL_COLORS = {
    LANES: LANE_COLORS,
    LANE_BORDER,
    HIT_LINE_GLOW,
    HUD_BG,
    TEXT_GLOW
};
