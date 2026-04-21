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
            id: 'beginner', name: 'BEGINNER', minLevel: 1, color: '#7f8c8d', bgGlow: 'rgba(127, 140, 141, 0.4)',
            emblemSVG: `<svg viewBox="0 0 100 100">
                <path d="M 25 30 L 75 30 L 50 70 Z" fill="none" stroke="#7f8c8d" stroke-width="4"/>
                <path d="M 35 30 L 65 30 L 50 55 Z" fill="none" stroke="#95a5a6" stroke-width="2"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"></svg>` // No frame for beginner
        },
        {
            id: 'trainee', name: 'TRAINEE', minLevel: 6, color: '#0984e3', bgGlow: 'rgba(9, 132, 227, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#74b9ff"/><stop offset="100%" stop-color="#0984e3"/></linearGradient></defs>
                <path d="M 20 25 L 40 25 L 50 45 L 60 25 L 80 25 L 50 80 Z" fill="#111"/>
                <path d="M 26 30 L 36 30 L 50 55 L 64 30 L 74 30 L 50 73 Z" fill="url(#g-gem-1)"/>
                <path d="M 40 30 L 60 30 L 50 48 Z" fill="url(#g-gem-1)"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-br1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e69950"/><stop offset="100%" stop-color="#8c521c"/></linearGradient></defs>
                <path d="M 30 75 L 50 90 L 70 75 L 60 85 L 50 80 L 40 85 Z" fill="url(#g-br1)"/>
            </svg>`
        },
        {
            id: 'amateur', name: 'AMATEUR', minLevel: 11, color: '#00cec9', bgGlow: 'rgba(0, 206, 201, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#81ecec"/><stop offset="100%" stop-color="#00cec9"/></linearGradient></defs>
                <path d="M 20 25 L 40 25 L 50 45 L 60 25 L 80 25 L 50 80 Z" fill="#111"/>
                <path d="M 26 30 L 36 30 L 50 55 L 64 30 L 74 30 L 50 73 Z" fill="url(#g-gem-2)"/>
                <path d="M 40 30 L 60 30 L 50 48 Z" fill="url(#g-gem-2)"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-br2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#e69950"/><stop offset="100%" stop-color="#8c521c"/></linearGradient></defs>
                <path d="M 20 65 L 35 85 L 50 90 L 65 85 L 80 65 L 70 75 L 50 80 L 30 75 Z" fill="url(#g-br2)"/>
                <path d="M 25 70 L 40 85 L 50 95 L 60 85 L 75 70 L 65 80 L 50 85 L 35 80 Z" fill="url(#g-br2)" opacity="0.6"/>
            </svg>`
        },
        {
            id: 'rookie', name: 'ROOKIE', minLevel: 16, color: '#1abc9c', bgGlow: 'rgba(26, 188, 156, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#55efc4"/><stop offset="100%" stop-color="#00b894"/></linearGradient></defs>
                <path d="M 20 25 L 40 25 L 50 45 L 60 25 L 80 25 L 50 80 Z" fill="#111"/>
                <path d="M 26 30 L 36 30 L 50 55 L 64 30 L 74 30 L 50 73 Z" fill="url(#g-gem-3)"/>
                <path d="M 40 30 L 60 30 L 50 48 Z" fill="url(#g-gem-3)"/>
                <polygon points="50,15 52,20 57,20 53,23 55,28 50,25 45,28 47,23 43,20 48,20" fill="#ffeaa7"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-br3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f8a5c2"/><stop offset="100%" stop-color="#8c521c"/></linearGradient></defs>
                <path d="M 15 55 L 30 75 L 50 90 L 70 75 L 85 55 L 75 65 L 50 75 L 25 65 Z" fill="url(#g-br3)"/>
                <path d="M 10 65 L 25 85 L 50 100 L 75 85 L 90 65 L 75 75 L 50 85 L 25 75 Z" fill="url(#g-br3)" opacity="0.6"/>
            </svg>`
        },
        {
            id: 'street_dj', name: 'STREET DJ', minLevel: 21, color: '#2ecc71', bgGlow: 'rgba(46, 204, 113, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#55efc4"/><stop offset="100%" stop-color="#00b894"/></linearGradient></defs>
                <path d="M 20 25 L 40 25 L 50 45 L 60 25 L 80 25 L 50 80 Z" fill="#111"/>
                <path d="M 26 30 L 36 30 L 50 55 L 64 30 L 74 30 L 50 73 Z" fill="url(#g-gem-4)"/>
                <path d="M 40 30 L 60 30 L 50 48 Z" fill="url(#g-gem-4)"/>
                <polygon points="50,12 53,20 61,20 54,25 56,33 50,28 44,33 46,25 39,20 47,20" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-sl1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#f5f6fa"/><stop offset="100%" stop-color="#718093"/></linearGradient></defs>
                <path d="M 15 55 L 30 75 L 50 95 L 70 75 L 85 55 L 75 65 L 50 80 L 25 65 Z" fill="url(#g-sl1)"/>
                <path d="M 10 45 L 20 60 L 35 75 L 25 60 Z M 90 45 L 80 60 L 65 75 L 75 60 Z" fill="url(#g-sl1)"/>
            </svg>`
        },
        {
            id: 'middleman', name: 'MIDDLEMAN', minLevel: 26, color: '#badc58', bgGlow: 'rgba(186, 220, 88, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-5" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8e994"/><stop offset="100%" stop-color="#78e08f"/></linearGradient></defs>
                <path d="M 20 30 L 40 30 L 50 50 L 60 30 L 80 30 L 50 85 Z" fill="#111"/>
                <path d="M 26 35 L 36 35 L 50 60 L 64 35 L 74 35 L 50 78 Z" fill="url(#g-gem-5)"/>
                <path d="M 40 35 L 60 35 L 50 53 Z" fill="url(#g-gem-5)"/>
                <polygon points="50,15 53,23 61,23 54,28 56,36 50,31 44,36 46,28 39,23 47,23" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-sl2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#a4b0be"/></linearGradient></defs>
                <path d="M 10 50 L 25 70 L 50 95 L 75 70 L 90 50 L 80 65 L 50 85 L 20 65 Z" fill="url(#g-sl2)"/>
                <path d="M 5 60 L 20 80 L 50 105 L 80 80 L 95 60 L 85 75 L 50 95 L 15 75 Z" fill="url(#g-sl2)" opacity="0.6"/>
                <path d="M 15 35 L 25 50 L 35 60 L 25 45 Z M 85 35 L 75 50 L 65 60 L 75 45 Z" fill="url(#g-sl2)"/>
            </svg>`
        },
        {
            id: 'pro_dj', name: 'PRO DJ', minLevel: 31, color: '#f1c40f', bgGlow: 'rgba(241, 196, 15, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-6" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffeaa7"/><stop offset="100%" stop-color="#fdcb6e"/></linearGradient></defs>
                <path d="M 20 30 L 40 30 L 50 50 L 60 30 L 80 30 L 50 85 Z" fill="#111"/>
                <path d="M 26 35 L 36 35 L 50 60 L 64 35 L 74 35 L 50 78 Z" fill="url(#g-gem-6)"/>
                <path d="M 40 35 L 60 35 L 50 53 Z" fill="url(#g-gem-6)"/>
                <polygon points="50,15 53,23 61,23 54,28 56,36 50,31 44,36 46,28 39,23 47,23" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-sl3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#2f3542"/></linearGradient></defs>
                <path d="M 5 45 L 25 70 L 50 98 L 75 70 L 95 45 L 80 65 L 50 85 L 20 65 Z" fill="url(#g-sl3)"/>
                <path d="M 0 55 L 20 80 L 50 110 L 80 80 L 100 55 L 85 75 L 50 100 L 15 75 Z" fill="url(#g-sl3)" opacity="0.6"/>
                <path d="M 10 30 L 25 50 L 40 65 L 30 45 Z M 90 30 L 75 50 L 60 65 L 70 45 Z" fill="url(#g-sl3)"/>
            </svg>`
        },
        {
            id: 'high_class', name: 'HIGH CLASS', minLevel: 41, color: '#ffb142', bgGlow: 'rgba(255, 177, 66, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-7" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffb142"/><stop offset="100%" stop-color="#cc8e35"/></linearGradient></defs>
                <path d="M 15 35 L 40 35 L 50 55 L 60 35 L 85 35 L 50 90 Z" fill="#111"/>
                <path d="M 22 40 L 35 40 L 50 70 L 65 40 L 78 40 L 50 83 Z" fill="url(#g-gem-7)"/>
                <path d="M 38 40 L 62 40 L 50 63 Z" fill="url(#g-gem-7)"/>
                <!-- Golden Double Star -->
                <polygon points="50,10 53,20 63,20 55,27 58,37 50,31 42,37 45,27 37,20 47,20" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gd1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffeaa7"/><stop offset="50%" stop-color="#fdcb6e"/><stop offset="100%" stop-color="#e1b12c"/></linearGradient></defs>
                <path d="M 10 40 L 30 65 L 50 90 L 70 65 L 90 40 L 75 60 L 50 75 L 25 60 Z" fill="url(#g-gd1)"/>
                <path d="M 5 50 L 25 75 L 50 100 L 75 75 L 95 50 L 80 70 L 50 85 L 20 70 Z" fill="url(#g-gd1)" opacity="0.8"/>
            </svg>`
        },
        {
            id: 'professional', name: 'PROFESSIONAL', minLevel: 51, color: '#e67e22', bgGlow: 'rgba(230, 126, 34, 0.6)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-8" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fab1a0"/><stop offset="100%" stop-color="#e17055"/></linearGradient></defs>
                <path d="M 15 35 L 40 35 L 50 55 L 60 35 L 85 35 L 50 90 Z" fill="#111"/>
                <path d="M 22 40 L 35 40 L 50 70 L 65 40 L 78 40 L 50 83 Z" fill="url(#g-gem-8)"/>
                <path d="M 38 40 L 62 40 L 50 63 Z" fill="url(#g-gem-8)"/>
                <polygon points="50,5 54,18 66,18 56,26 60,38 50,31 40,38 44,26 34,18 46,18" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gd2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffeaa7"/><stop offset="50%" stop-color="#fdcb6e"/><stop offset="100%" stop-color="#e1b12c"/></linearGradient></defs>
                <!-- Triple Gold Wings -->
                <path d="M 5 35 L 30 65 L 50 95 L 70 65 L 95 35 L 80 55 L 50 80 L 20 55 Z" fill="url(#g-gd2)"/>
                <path d="M 0 45 L 25 75 L 50 105 L 75 75 L 100 45 L 85 65 L 50 90 L 15 65 Z" fill="url(#g-gd2)" opacity="0.8"/>
                <path d="M 10 25 L 25 45 L 40 60 L 30 40 Z M 90 25 L 75 45 L 60 60 L 70 40 Z" fill="url(#g-gd2)"/>
            </svg>`
        },
        {
            id: 'trend_setter', name: 'TREND SETTER', minLevel: 61, color: '#e74c3c', bgGlow: 'rgba(231, 76, 60, 0.6)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-9" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7675"/><stop offset="100%" stop-color="#d63031"/></linearGradient></defs>
                <path d="M 15 35 L 40 35 L 50 55 L 60 35 L 85 35 L 50 90 Z" fill="#111"/>
                <path d="M 22 40 L 35 40 L 50 70 L 65 40 L 78 40 L 50 83 Z" fill="url(#g-gem-9)"/>
                <path d="M 38 40 L 62 40 L 50 63 Z" fill="url(#g-gem-9)"/>
                <polygon points="50,5 54,18 66,18 56,26 60,38 50,31 40,38 44,26 34,18 46,18" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gd3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffeaa7"/><stop offset="50%" stop-color="#fdcb6e"/><stop offset="100%" stop-color="#e1b12c"/></linearGradient></defs>
                <!-- Wide Sweeping Gold Wings -->
                <path d="M 0 30 L 30 65 L 50 95 L 70 65 L 100 30 L 80 55 L 50 80 L 20 55 Z" fill="url(#g-gd3)"/>
                <path d="M -5 45 L 25 75 L 50 105 L 75 75 L 105 45 L 85 65 L 50 90 L 15 65 Z" fill="url(#g-gd3)" opacity="0.8"/>
                <path d="M 10 20 L 30 45 L 45 60 L 30 35 Z M 90 20 L 70 45 L 55 60 L 70 35 Z" fill="url(#g-gd3)"/>
            </svg>`
        },
        {
            id: 'headliner', name: 'HEADLINER', minLevel: 71, color: '#c0392b', bgGlow: 'rgba(192, 57, 43, 0.7)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-10" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d63031"/><stop offset="100%" stop-color="#b33939"/></linearGradient></defs>
                <path d="M 10 40 L 40 40 L 50 60 L 60 40 L 90 40 L 50 95 Z" fill="#111"/>
                <path d="M 18 45 L 35 45 L 50 75 L 65 45 L 82 45 L 50 88 Z" fill="url(#g-gem-10)"/>
                <path d="M 38 45 L 62 45 L 50 68 Z" fill="url(#g-gem-10)"/>
                <polygon points="50,5 55,20 68,20 57,28 62,42 50,33 38,42 43,28 32,20 45,20" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-redgd1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7675"/><stop offset="50%" stop-color="#e1b12c"/><stop offset="100%" stop-color="#d63031"/></linearGradient></defs>
                <path d="M 0 30 L 30 65 L 50 95 L 70 65 L 100 30 L 80 55 L 50 80 L 20 55 Z" fill="url(#g-redgd1)"/>
                <path d="M -5 45 L 25 75 L 50 105 L 75 75 L 105 45 L 85 65 L 50 90 L 15 65 Z" fill="url(#g-redgd1)"/>
                <path d="M 10 15 L 30 40 L 45 55 L 30 30 Z M 90 15 L 70 40 L 55 55 L 70 30 Z" fill="url(#g-redgd1)"/>
            </svg>`
        },
        {
            id: 'showstopper', name: 'SHOWSTOPPER', minLevel: 81, color: '#e84393', bgGlow: 'rgba(232, 67, 147, 0.7)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-11" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fd79a8"/><stop offset="100%" stop-color="#e84393"/></linearGradient></defs>
                <path d="M 10 40 L 40 40 L 50 60 L 60 40 L 90 40 L 50 95 Z" fill="#111"/>
                <path d="M 18 45 L 35 45 L 50 75 L 65 45 L 82 45 L 50 88 Z" fill="url(#g-gem-11)"/>
                <path d="M 38 45 L 62 45 L 50 68 Z" fill="url(#g-gem-11)"/>
                <polygon points="50,5 55,20 68,20 57,28 62,42 50,33 38,42 43,28 32,20 45,20" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-redgd2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fd79a8"/><stop offset="50%" stop-color="#e1b12c"/><stop offset="100%" stop-color="#e84393"/></linearGradient></defs>
                <path d="M 0 25 L 30 65 L 50 95 L 70 65 L 100 25 L 80 55 L 50 80 L 20 55 Z" fill="url(#g-redgd2)"/>
                <path d="M -5 35 L 25 75 L 50 105 L 75 75 L 105 35 L 85 65 L 50 90 L 15 65 Z" fill="url(#g-redgd2)"/>
                <path d="M 10 10 L 30 40 L 45 55 L 30 25 Z M 90 10 L 70 40 L 55 55 L 70 25 Z" fill="url(#g-redgd2)"/>
                <polygon points="15,20 20,25 25,20 20,15" fill="#fff"/><polygon points="85,20 80,25 75,20 80,15" fill="#fff"/>
            </svg>`
        },
        {
            id: 'beat_maestro', name: 'BEAT MAESTRO', minLevel: 91, color: '#6c5ce7', bgGlow: 'rgba(108, 92, 231, 0.8)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-12" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a29bfe"/><stop offset="100%" stop-color="#6c5ce7"/></linearGradient></defs>
                <path d="M 5 45 L 35 45 L 50 65 L 65 45 L 95 45 L 50 100 Z" fill="#111"/>
                <path d="M 12 50 L 32 50 L 50 80 L 68 50 L 88 50 L 50 93 Z" fill="url(#g-gem-12)"/>
                <path d="M 35 50 L 65 50 L 50 75 Z" fill="url(#g-gem-12)"/>
                <polygon points="50,5 55,20 68,20 57,28 62,42 50,33 38,42 43,28 32,20 45,20" fill="#fff"/>
                <!-- Mini side stars -->
                <polygon points="25,25 27,33 34,33 28,37 31,45 25,40 19,45 22,37 16,33 23,33" fill="#fff"/>
                <polygon points="75,25 77,33 84,33 78,37 81,45 75,40 69,45 72,37 66,33 73,33" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-pl" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#dcdde1"/><stop offset="100%" stop-color="#718093"/></linearGradient></defs>
                <!-- Platinum Sharp Wings -->
                <path d="M 0 20 L 30 65 L 50 100 L 70 65 L 100 20 L 80 55 L 50 85 L 20 55 Z" fill="url(#g-pl)"/>
                <path d="M -5 35 L 25 75 L 50 110 L 75 75 L 105 35 L 85 65 L 50 95 L 15 65 Z" fill="url(#g-pl)"/>
                <path d="M 10 5 L 30 35 L 45 50 L 30 20 Z M 90 5 L 70 35 L 55 50 L 70 20 Z" fill="url(#g-pl)"/>
            </svg>`
        },
        {
            id: 'nexus_lord', name: 'THE LORD OF NEXUS', minLevel: 99, color: '#fff', bgGlow: 'rgba(255, 255, 255, 0.9)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-13" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#b2bec3"/><stop offset="100%" stop-color="#636e72"/></linearGradient></defs>
                <path d="M 0 45 L 35 45 L 50 65 L 65 45 L 100 45 L 50 105 Z" fill="#111"/>
                <path d="M 8 50 L 32 50 L 50 80 L 68 50 L 92 50 L 50 98 Z" fill="url(#g-gem-13)"/>
                <path d="M 35 50 L 65 50 L 50 75 Z" fill="url(#g-gem-13)"/>
                
                <!-- Epic Crown Structure -->
                <path d="M 30 10 L 40 25 L 50 15 L 60 25 L 70 10 L 65 40 L 35 40 Z" fill="#f1c40f"/>
                <circle cx="30" cy="8" r="3" fill="#ff7675"/>
                <circle cx="50" cy="12" r="4" fill="#74b9ff"/>
                <circle cx="70" cy="8" r="3" fill="#ff7675"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-ult" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a29bfe"/><stop offset="50%" stop-color="#fdcb6e"/><stop offset="100%" stop-color="#d63031"/></linearGradient></defs>
                <!-- Multi-layered Epic Wings -->
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#g-ult)"/>
                <path d="M -5 25 L 20 75 L 50 115 L 80 75 L 105 25 L 85 65 L 50 100 L 15 65 Z" fill="url(#g-ult)" opacity="0.8"/>
                <path d="M 10 -5 L 35 35 L 50 50 L 30 20 Z M 90 -5 L 65 35 L 50 50 L 70 20 Z" fill="url(#g-ult)"/>
                <path d="M 0 45 L 15 75 L 35 90 L 20 65 Z M 100 45 L 85 75 L 65 90 L 80 65 Z" fill="url(#g-ult)"/>
            </svg>`
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
