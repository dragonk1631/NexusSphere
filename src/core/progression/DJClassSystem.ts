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
            id: 'beginner', name: 'BEGINNER', minLevel: 1, color: '#a0a0a0', bgGlow: 'rgba(160, 160, 160, 0.3)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="m-beg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#bdc3c7"/><stop offset="100%" stop-color="#7f8c8d"/></linearGradient></defs>
                <path d="M35,5 L65,5 L65,40 L50,55 L35,40 Z" fill="#7f8c8d"/>
                <circle cx="50" cy="65" r="20" fill="url(#m-beg)"/>
                <circle cx="50" cy="65" r="14" fill="none" stroke="#fff" stroke-width="2" opacity="0.5"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-beg" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#bdc3c7"/><stop offset="100%" stop-color="#7f8c8d"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-beg)" opacity="0.6"/>
                <path d="M -5 25 L 20 75 L 50 115 L 80 75 L 105 25 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-beg)" opacity="0.4"/>
            </svg>`
        },
        {
            id: 'trainee', name: 'TRAINEE', minLevel: 6, color: '#0984e3', bgGlow: 'rgba(9, 132, 227, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#74b9ff"/><stop offset="100%" stop-color="#0984e3"/></linearGradient></defs>
                <path d="M30,0 L70,0 L65,45 L50,55 L35,45 Z" fill="#0984e3"/>
                <path d="M40,0 L60,0 L60,40 L50,45 L40,40 Z" fill="#74b9ff"/>
                <rect x="35" y="50" width="30" height="30" rx="5" fill="url(#g-gem-1)" transform="rotate(45 50 65)"/>
                <circle cx="50" cy="65" r="8" fill="#fff" opacity="0.6"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-tra" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#74b9ff"/><stop offset="100%" stop-color="#0984e3"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-tra)" opacity="0.8"/>
                <path d="M -5 25 L 20 75 L 50 115 L 80 75 L 105 25 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-tra)" opacity="0.5"/>
            </svg>`
        },
        {
            id: 'amateur', name: 'AMATEUR', minLevel: 11, color: '#00cec9', bgGlow: 'rgba(0, 206, 201, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#81ecec"/><stop offset="100%" stop-color="#00cec9"/></linearGradient></defs>
                <path d="M25,0 L45,0 L40,40 L30,50 Z" fill="#00cec9"/>
                <path d="M75,0 L55,0 L60,40 L70,50 Z" fill="#00cec9"/>
                <path d="M30,45 L70,45 L50,85 Z" fill="url(#g-gem-2)"/>
                <path d="M35,50 L65,50 L50,75 Z" fill="#fff" opacity="0.3"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-ama" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#81ecec"/><stop offset="100%" stop-color="#00cec9"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-ama)" opacity="0.8"/>
                <path d="M -5 25 L 20 75 L 50 115 L 80 75 L 105 25 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-ama)" opacity="0.5"/>
            </svg>`
        },
        {
            id: 'rookie', name: 'ROOKIE', minLevel: 16, color: '#1abc9c', bgGlow: 'rgba(26, 188, 156, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#55efc4"/><stop offset="100%" stop-color="#00b894"/></linearGradient></defs>
                <path d="M25,5 L75,5 L65,35 L50,45 L35,35 Z" fill="#1abc9c"/>
                <path d="M40,5 L60,5 L58,30 L50,38 L42,30 Z" fill="#55efc4"/>
                <path d="M35,40 L65,40 L75,60 L65,80 L35,80 L25,60 Z" fill="url(#g-gem-3)"/>
                <polygon points="50,45 53,52 60,52 54,57 56,64 50,60 44,64 46,57 40,52 47,52" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-roo" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#55efc4"/><stop offset="100%" stop-color="#00b894"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-roo)" opacity="0.8"/>
                <path d="M -10 -5 L 15 35 L 35 50 L 15 20 Z M 110 -5 L 85 35 L 65 50 L 85 20 Z" fill="url(#f-roo)" opacity="0.6"/>
            </svg>`
        },
        {
            id: 'street_dj', name: 'STREET DJ', minLevel: 21, color: '#2ecc71', bgGlow: 'rgba(46, 204, 113, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#55efc4"/><stop offset="100%" stop-color="#00b894"/></linearGradient></defs>
                <path d="M20,0 L80,0 L65,40 L50,60 L35,40 Z" fill="#2ecc71"/>
                <path d="M35,0 L65,0 L55,35 L50,45 L45,35 Z" fill="#27ae60"/>
                <path d="M30,45 L70,45 L80,65 L50,90 L20,65 Z" fill="url(#g-gem-4)"/>
                <path d="M35,50 L65,50 L72,65 L50,85 L28,65 Z" fill="none" stroke="#fff" stroke-width="2"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-str" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#55efc4"/><stop offset="100%" stop-color="#00b894"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-str)" opacity="0.8"/>
                <path d="M -15 30 L 20 75 L 50 120 L 80 75 L 115 30 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-str)" opacity="0.5"/>
            </svg>`
        },
        {
            id: 'middleman', name: 'MIDDLEMAN', minLevel: 26, color: '#badc58', bgGlow: 'rgba(186, 220, 88, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-5" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8e994"/><stop offset="100%" stop-color="#78e08f"/></linearGradient></defs>
                <path d="M15,5 L85,5 L75,25 L50,45 L25,25 Z" fill="#78e08f"/>
                <path d="M30,5 L70,5 L60,25 L50,35 L40,25 Z" fill="#badc58"/>
                <path d="M25,35 L75,35 L70,75 C50,95 50,95 50,95 C50,95 30,95 30,75 Z" fill="url(#g-gem-5)"/>
                <circle cx="50" cy="62" r="10" fill="#fff" opacity="0.8"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-mid" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#b8e994"/><stop offset="100%" stop-color="#78e08f"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-mid)" opacity="0.9"/>
                <path d="M -15 35 L 20 75 L 50 120 L 80 75 L 115 35 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-mid)" opacity="0.6"/>
            </svg>`
        },
        {
            id: 'pro_dj', name: 'PRO DJ', minLevel: 31, color: '#f1c40f', bgGlow: 'rgba(241, 196, 15, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-6" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffeaa7"/><stop offset="100%" stop-color="#fdcb6e"/></linearGradient></defs>
                <path d="M15,0 L85,0 L75,35 L50,55 L25,35 Z" fill="#fdcb6e"/>
                <path d="M20,0 L80,0 L70,30 L50,50 L30,30 Z" fill="#ffeaa7"/>
                <path d="M50,30 L65,45 L85,45 L70,65 L80,90 L50,75 L20,90 L30,65 L15,45 L35,45 Z" fill="url(#g-gem-6)"/>
                <circle cx="50" cy="62" r="10" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-pro" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffeaa7"/><stop offset="100%" stop-color="#fdcb6e"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-pro)" opacity="0.9"/>
                <path d="M -15 30 L 20 75 L 50 120 L 80 75 L 115 30 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-pro)" opacity="0.7"/>
                <path d="M -20 50 L 10 70 L 30 85 L 10 60 Z M 120 50 L 90 70 L 70 85 L 90 60 Z" fill="url(#f-pro)" opacity="0.5"/>
            </svg>`
        },
        {
            id: 'high_class', name: 'HIGH CLASS', minLevel: 41, color: '#ffb142', bgGlow: 'rgba(255, 177, 66, 0.5)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-7" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffb142"/><stop offset="100%" stop-color="#cc8e35"/></linearGradient></defs>
                <path d="M25,0 L45,0 L35,40 Z M75,0 L55,0 L65,40 Z" fill="#ffb142"/>
                <path d="M30,0 L70,0 L65,30 L50,50 L35,30 Z" fill="#cc8e35"/>
                <path d="M30,40 L70,40 L85,60 L70,85 L30,85 L15,60 Z" fill="url(#g-gem-7)"/>
                <polygon points="50,50 53,58 61,58 55,63 57,71 50,66 43,71 45,63 39,58 47,58" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-hcl" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ffb142"/><stop offset="100%" stop-color="#cc8e35"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-hcl)" opacity="0.9"/>
                <path d="M -15 30 L 20 75 L 50 120 L 80 75 L 115 30 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-hcl)" opacity="0.7"/>
                <path d="M 50 0 L 65 15 H 35 Z" fill="url(#f-hcl)" opacity="0.8"/>
            </svg>`
        },
        {
            id: 'professional', name: 'PROFESSIONAL', minLevel: 51, color: '#e67e22', bgGlow: 'rgba(230, 126, 34, 0.6)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-8" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fab1a0"/><stop offset="100%" stop-color="#e17055"/></linearGradient></defs>
                <path d="M20,0 L80,0 L70,40 L50,60 L30,40 Z" fill="#e67e22"/>
                <path d="M35,0 L65,0 L60,30 L50,40 L40,30 Z" fill="#d35400"/>
                <path d="M15,45 C30,35 70,35 85,45 C85,85 50,95 50,95 C50,95 15,85 15,45 Z" fill="url(#g-gem-8)"/>
                <path d="M25,50 C40,45 60,45 75,50 C75,75 50,85 50,85 C50,85 25,75 25,50 Z" fill="url(#g-gd1)"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-prf" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#fab1a0"/><stop offset="100%" stop-color="#e17055"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-prf)" opacity="0.9"/>
                <path d="M -15 30 L 20 75 L 50 120 L 80 75 L 115 30 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-prf)" opacity="0.8"/>
                <path d="M 50 -5 L 68 18 H 32 Z" fill="url(#f-prf)"/>
            </svg>`
        },
        {
            id: 'trend_setter', name: 'TREND SETTER', minLevel: 61, color: '#e74c3c', bgGlow: 'rgba(231, 76, 60, 0.6)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-9" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ff7675"/><stop offset="100%" stop-color="#d63031"/></linearGradient></defs>
                <path d="M10,0 L90,0 L85,40 L50,65 L15,40 Z" fill="#c0392b"/>
                <path d="M30,0 L70,0 L65,30 L50,45 L35,30 Z" fill="#e74c3c"/>
                <circle cx="50" cy="65" r="28" fill="url(#g-gem-9)"/>
                <polygon points="50,42 54,53 66,53 56,60 60,70 50,64 40,70 44,60 34,53 46,53" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-trs" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ff7675"/><stop offset="100%" stop-color="#d63031"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-trs)" opacity="1"/>
                <path d="M -15 30 L 20 75 L 50 120 L 80 75 L 115 30 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-trs)" opacity="0.8"/>
                <path d="M -25 45 L 10 70 L 35 90 L 15 60 Z M 125 45 L 90 70 L 65 90 L 85 60 Z" fill="url(#f-trs)" opacity="0.7"/>
            </svg>`
        },
        {
            id: 'headliner', name: 'HEADLINER', minLevel: 71, color: '#c0392b', bgGlow: 'rgba(192, 57, 43, 0.7)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-10" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#d63031"/><stop offset="100%" stop-color="#b33939"/></linearGradient></defs>
                <path d="M5,0 L95,0 L85,50 L50,80 L15,50 Z" fill="#1e272e"/>
                <path d="M25,0 L75,0 L68,40 L50,60 L32,40 Z" fill="#ff9f43"/>
                <path d="M50,30 L62,45 L85,45 L68,60 L75,85 L50,70 L25,85 L32,60 L15,45 L38,45 Z" fill="url(#g-gem-10)"/>
                <circle cx="50" cy="58" r="10" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-hdl" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#ff9f43"/><stop offset="100%" stop-color="#b33939"/></linearGradient></defs>
                <path d="M -10 10 L 25 65 L 50 105 L 75 65 L 110 10 L 85 55 L 50 90 L 15 55 Z" fill="url(#f-hdl)" opacity="1"/>
                <path d="M -15 25 L 20 75 L 50 115 L 80 75 L 115 25 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-hdl)" opacity="0.9"/>
                <path d="M 50 -10 L 75 15 H 25 Z" fill="url(#f-hdl)"/>
            </svg>`
        },
        {
            id: 'showstopper', name: 'SHOWSTOPPER', minLevel: 81, color: '#e84393', bgGlow: 'rgba(232, 67, 147, 0.7)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-11" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#fd79a8"/><stop offset="100%" stop-color="#e84393"/></linearGradient></defs>
                <path d="M10,0 L90,0 L85,45 L50,75 L15,45 Z" fill="#2d3436"/>
                <path d="M30,0 L70,0 L65,35 L50,50 L35,35 Z" fill="#d63031"/>
                <path d="M50,30 L75,45 L75,70 L50,95 L25,70 L25,45 Z" fill="url(#g-gem-11)"/>
                <path d="M50,40 L65,52 L65,65 L50,80 L35,65 L35,52 Z" fill="none" stroke="#fff" stroke-width="3"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-shs" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#fd79a8"/><stop offset="100%" stop-color="#e84393"/></linearGradient></defs>
                <path d="M -10 0 L 25 60 L 50 100 L 70 60 L 110 0 L 85 50 L 50 85 L 20 50 Z" fill="url(#f-shs)" opacity="1"/>
                <path d="M -15 20 L 20 75 L 50 120 L 80 75 L 115 20 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-shs)" opacity="0.9"/>
                <path d="M 50 -15 L 80 20 H 20 Z" fill="url(#f-shs)"/>
            </svg>`
        },
        {
            id: 'beat_maestro', name: 'BEAT MAESTRO', minLevel: 91, color: '#6c5ce7', bgGlow: 'rgba(108, 92, 231, 0.8)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-12" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#a29bfe"/><stop offset="100%" stop-color="#6c5ce7"/></linearGradient></defs>
                <path d="M0,0 L100,0 L90,50 L50,95 L10,50 Z" fill="#2d3436"/>
                <path d="M25,0 L75,0 L68,40 L50,60 L32,40 Z" fill="#fbc531"/>
                <circle cx="50" cy="55" r="32" fill="url(#g-gem-12)"/>
                <circle cx="50" cy="55" r="26" fill="none" stroke="#fdcb6e" stroke-width="4" stroke-dasharray="8 4"/>
                <polygon points="50,35 55,48 70,48 57,56 62,70 50,60 38,70 43,56 30,48 45,48" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-mae" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#a29bfe"/><stop offset="100%" stop-color="#6c5ce7"/></linearGradient></defs>
                <path d="M -10 0 L 25 60 L 50 105 L 75 60 L 110 0 L 85 50 L 50 90 L 15 50 Z" fill="url(#f-mae)" opacity="1"/>
                <path d="M -15 20 L 20 75 L 50 120 L 80 75 L 115 20 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-mae)" opacity="0.9"/>
                <path d="M 50 -20 L 85 25 H 15 Z" fill="url(#f-mae)"/>
                <path d="M -25 35 L 5 65 L 30 85 L 10 50 Z M 125 35 L 95 65 L 70 85 L 90 50 Z" fill="url(#f-mae)" opacity="0.7"/>
            </svg>`
        },
        {
            id: 'nexus_lord', name: 'THE LORD OF NEXUS', minLevel: 99, color: '#fff', bgGlow: 'rgba(255, 255, 255, 0.9)',
            emblemSVG: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-gem-13" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="50%" stop-color="#b2bec3"/><stop offset="100%" stop-color="#636e72"/></linearGradient></defs>
                <path d="M0,0 L100,0 L85,60 L50,110 L15,60 Z" fill="#111"/>
                <path d="M20,0 L80,0 L70,45 L50,75 L30,45 Z" fill="#a29bfe"/>
                <path d="M50,20 C80,20 95,45 85,85 C65,105 50,105 50,105 C50,105 35,105 15,85 C5,45 20,20 50,20 Z" fill="url(#g-gem-13)"/>
                <path d="M30,30 L40,45 L50,35 L60,45 L70,30 L65,65 L35,65 Z" fill="#fdcb6e"/>
                <circle cx="50" cy="55" r="6" fill="#fff"/>
            </svg>`,
            frameSVG: `<svg viewBox="0 0 100 100">
                <defs><linearGradient id="f-nex" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#a29bfe"/><stop offset="50%" stop-color="#fdcb6e"/><stop offset="100%" stop-color="#d63031"/></linearGradient></defs>
                <path d="M -10 0 L 25 60 L 50 105 L 75 60 L 110 0 L 85 50 L 50 90 L 15 50 Z" fill="url(#f-nex)" opacity="1"/>
                <path d="M -15 20 L 20 75 L 50 120 L 80 75 L 115 20 L 85 65 L 50 100 L 15 65 Z" fill="url(#f-nex)" opacity="0.8"/>
                <path d="M 50 -25 L 90 30 H 10 Z" fill="url(#f-nex)"/>
                <path d="M -30 25 L 0 65 L 30 95 L 5 50 Z M 130 25 L 100 65 L 70 95 L 95 50 Z" fill="url(#f-nex)" opacity="0.9"/>
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
