/**
 * DJClassSystem - Handles progression tiers and visual emblems based on player level.
 * Inspired by the 'DJ CLASS EMBLEMS' hierarchy.
 */

export interface DJClassInfo {
    id: string;
    name: string;
    minLevel: number;
    color: string;
    bgGlow: string;
    emblemSVG: string;
    frameSVG: string;
}

export class DJClassSystem {
    private static CLASSES: DJClassInfo[] = [
        {
            id: 'beginner',
            name: 'BEGINNER',
            minLevel: 1,
            color: '#a0a0a0',
            bgGlow: 'rgba(160, 160, 160, 0.3)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-beginner" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#eee;stop-opacity:1"/><stop offset="100%" style="stop-color:#777;stop-opacity:1"/></linearGradient></defs><path d="M20,50 L50,20 L80,50 L50,80 Z" fill="url(#g-beginner)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><rect x="10" y="10" width="80" height="80" rx="4" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 2" opacity="0.4"/></svg>`
        },
        {
            id: 'trainee',
            name: 'TRAINEE',
            minLevel: 6,
            color: '#bdc3c7',
            bgGlow: 'rgba(189, 195, 199, 0.4)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-trainee" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#fff;stop-opacity:1"/><stop offset="100%" style="stop-color:#95a5a6;stop-opacity:1"/></linearGradient></defs><path d="M50,15 L85,75 L15,75 Z" fill="url(#g-trainee)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" stroke-width="2" opacity="0.5"/></svg>`
        },
        {
            id: 'amateur',
            name: 'AMATEUR',
            minLevel: 11,
            color: '#3498db',
            bgGlow: 'rgba(52, 152, 219, 0.4)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-amateur" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#54a0ff;stop-opacity:1"/><stop offset="100%" style="stop-color:#2e86de;stop-opacity:1"/></linearGradient></defs><path d="M50,10 L90,80 L10,80 Z" fill="url(#g-amateur)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M10,10 L90,10 L90,90 L10,90 Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="M0,0 L20,20 M100,0 L80,20 M0,100 L20,80 M100,100 L80,80" stroke="currentColor" stroke-width="1.5"/></svg>`
        },
        {
            id: 'rookie',
            name: 'ROOKIE',
            minLevel: 16,
            color: '#00d2ff',
            bgGlow: 'rgba(0, 210, 255, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-rookie" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00d2ff;stop-opacity:1"/><stop offset="100%" style="stop-color:#3a7bd5;stop-opacity:1"/></linearGradient></defs><path d="M50,5 L65,40 L95,50 L65,60 L50,95 L35,60 L5,50 L35,40 Z" fill="url(#g-rookie)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M20,5 L80,5 Q95,5 95,20 V80 Q95,95 80,95 H20 Q5,95 5,80 V20 Q5,5 20,5" fill="none" stroke="currentColor" stroke-width="4"/><path d="M0,50 L15,50 M85,50 L100,50" stroke="currentColor" stroke-width="2"/></svg>`
        },
        {
            id: 'street_dj',
            name: 'STREET DJ',
            minLevel: 21,
            color: '#1abc9c',
            bgGlow: 'rgba(26, 188, 156, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-street" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#1abc9c;stop-opacity:1"/><stop offset="100%" style="stop-color:#16a085;stop-opacity:1"/></linearGradient></defs><path d="M50,10 L85,45 L50,80 L15,45 Z" fill="url(#g-street)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M5,30 L50,5 L95,30 V70 L50,95 L5,70 Z" fill="none" stroke="currentColor" stroke-width="5"/></svg>`
        },
        {
            id: 'middleman',
            name: 'MIDDLEMAN',
            minLevel: 26,
            color: '#2ecc71',
            bgGlow: 'rgba(46, 204, 113, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-middle" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#2ecc71;stop-opacity:1"/><stop offset="100%" style="stop-color:#27ae60;stop-opacity:1"/></linearGradient></defs><path d="M50,15 L90,85 H10 Z" fill="url(#g-middle)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M50,5 L95,25 V75 L50,95 L5,75 V25 Z" fill="none" stroke="currentColor" stroke-width="6"/><path d="M0,50 Q20,30 40,30 M100,50 Q80,30 60,30" fill="none" stroke="currentColor" stroke-width="3" opacity="0.7"/></svg>`
        },
        {
            id: 'pro_dj',
            name: 'PRO DJ',
            minLevel: 31,
            color: '#27ae60',
            bgGlow: 'rgba(39, 174, 96, 0.6)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-prodj" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#2ecc71;stop-opacity:1"/><stop offset="100%" style="stop-color:#16a085;stop-opacity:1"/></linearGradient></defs><circle cx="50" cy="50" r="40" fill="url(#g-prodj)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M50,2 C76.5,2 98,23.5 98,50 C98,76.5 76.5,98 50,98 C23.5,98 2,76.5 2,50 C2,23.5 23.5,2 50,2" fill="none" stroke="currentColor" stroke-width="6"/><path d="M50,0 Q60,20 80,20 M50,0 Q40,20 20,20" fill="none" stroke="currentColor" stroke-width="4" opacity="0.8"/></svg>`
        },
        {
            id: 'high_class',
            name: 'HIGH CLASS',
            minLevel: 41,
            color: '#d4e157',
            bgGlow: 'rgba(212, 225, 87, 0.6)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-high" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#d4e157;stop-opacity:1"/><stop offset="100%" style="stop-color:#9e9d24;stop-opacity:1"/></linearGradient></defs><path d="M15,10 H85 V60 C85,85 50,95 50,95 C50,95 15,85 15,60 Z" fill="url(#g-high)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M10,20 L30,5 L70,5 L90,20 V70 Q90,95 50,95 Q10,95 10,70 Z" fill="none" stroke="currentColor" stroke-width="7"/><path d="M0,45 Q20,40 30,15 M100,45 Q80,40 70,15" fill="none" stroke="currentColor" stroke-width="4"/></svg>`
        },
        {
            id: 'professional',
            name: 'PROFESSIONAL',
            minLevel: 51,
            color: '#ecf0f1',
            bgGlow: 'rgba(236, 240, 241, 0.7)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-prof" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#fff;stop-opacity:1"/><stop offset="100%" style="stop-color:#bdc3c7;stop-opacity:1"/></linearGradient></defs><path d="M50,5 L61,35 L95,35 L68,55 L78,85 L50,65 L22,85 L32,55 L5,35 L39,35 Z" fill="url(#g-prof)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M50,2 L98,50 L50,98 L2,50 Z" fill="none" stroke="currentColor" stroke-width="5"/><path d="M20,20 L35,35 M80,20 L65,35 M20,80 L35,65 M80,80 L65,65" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></svg>`
        },
        {
            id: 'trend_setter',
            name: 'TREND SETTER',
            minLevel: 61,
            color: '#f1c40f',
            bgGlow: 'rgba(241, 196, 15, 0.6)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-trend" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#f1c40f;stop-opacity:1"/><stop offset="100%" style="stop-color:#f39c12;stop-opacity:1"/></linearGradient></defs><path d="M10,20 L50,80 L90,20 L70,20 L50,50 L30,20 Z" fill="url(#g-trend)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M50,5 Q95,5 95,50 Q95,95 50,95 Q5,95 5,50 Q5,5 50,5" fill="none" stroke="currentColor" stroke-width="8"/><path d="M50,0 Q65,30 95,30 M50,0 Q35,30 5,30" fill="none" stroke="currentColor" stroke-width="5"/></svg>`
        },
        {
            id: 'headliner',
            name: 'HEADLINER',
            minLevel: 71,
            color: '#e67e22',
            bgGlow: 'rgba(230, 126, 34, 0.6)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-head" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#f39c12;stop-opacity:1"/><stop offset="100%" style="stop-color:#d35400;stop-opacity:1"/></linearGradient></defs><path d="M10,20 L50,85 L90,20 L50,45 Z" fill="url(#g-head)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M50,15 L90,35 V75 L50,95 L10,75 V35 Z" fill="none" stroke="currentColor" stroke-width="8"/><path d="M20,10 L35,25 M80,10 L65,25" stroke="currentColor" stroke-width="10" stroke-linecap="round"/><path d="M50,0 L60,15 H40 Z" fill="currentColor"/></svg>`
        },
        {
            id: 'showstopper',
            name: 'SHOWSTOPPER',
            minLevel: 81,
            color: '#e74c3c',
            bgGlow: 'rgba(231, 76, 60, 0.7)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-show" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#ff4d4d;stop-opacity:1"/><stop offset="100%" style="stop-color:#b33939;stop-opacity:1"/></linearGradient></defs><path d="M50,5 L64,38 L98,38 L71,58 L82,92 L50,72 L18,92 L29,58 L2,38 L36,38 Z" fill="url(#g-show)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M50,10 L95,30 V70 L50,90 L5,70 V30 Z" fill="none" stroke="currentColor" stroke-width="10"/><path d="M20,10 Q50,-10 80,10 L90,30 L10,30 Z" fill="currentColor" opacity="0.8"/><path d="M50,0 L55,10 H45 Z" fill="currentColor"/></svg>`
        },
        {
            id: 'beat_maestro',
            name: 'BEAT MAESTRO',
            minLevel: 91,
            color: '#c0392b',
            bgGlow: 'rgba(192, 57, 43, 0.8)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-maestro" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#ff5252;stop-opacity:1"/><stop offset="100%" style="stop-color:#7f1d1d;stop-opacity:1"/></linearGradient></defs><circle cx="50" cy="50" r="30" fill="url(#g-maestro)"/><path d="M35,35 L40,40 M65,35 L60,40" stroke="#fff" stroke-width="2"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M10,40 C10,10 50,2 50,2 C50,2 90,10 90,40 C90,80 50,98 50,98 C50,98 10,80 10,40" fill="none" stroke="currentColor" stroke-width="10"/><path d="M50,0 L65,15 H35 Z" fill="currentColor"/><path d="M20,25 Q15,5 0,15 M80,25 Q85,5 100,15" fill="none" stroke="currentColor" stroke-width="5"/></svg>`
        },
        {
            id: 'nexus_lord',
            name: 'THE LORD OF NEXUS',
            minLevel: 99,
            color: '#9b59b6',
            bgGlow: 'rgba(155, 89, 182, 0.9)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-nexus" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" style="stop-color:#dcdde1;stop-opacity:1"/><stop offset="50%" style="stop-color:#9b59b6;stop-opacity:1"/><stop offset="100%" style="stop-color:#4834d4;stop-opacity:1"/></linearGradient></defs><path d="M10,80 L20,30 L40,60 L50,20 L60,60 L80,30 L90,80 Z" fill="url(#g-nexus)"/></svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><path d="M50,12 L95,32 V72 L50,92 L5,72 V32 Z" fill="none" stroke="currentColor" stroke-width="12"/><path d="M50,0 L65,20 H35 Z M20,15 L35,30 M80,15 L65,30" fill="currentColor" stroke="currentColor" stroke-width="2"/><path d="M0,40 Q20,35 30,10 M100,40 Q80,35 70,10" fill="none" stroke="currentColor" stroke-width="6"/></svg>`
        }
    ];

    public static getAllClasses(): DJClassInfo[] {
        return this.CLASSES;
    }

    public static getClassInfo(level: number): DJClassInfo {
        // Find the highest class where minLevel <= level
        let selected = this.CLASSES[0];
        for (const cls of this.CLASSES) {
            if (level >= cls.minLevel) {
                selected = cls;
            } else {
                break;
            }
        }
        return selected;
    }
}
