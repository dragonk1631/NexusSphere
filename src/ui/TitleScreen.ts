export class TitleScreen {
    private container: HTMLDivElement;
    private onStart: () => void;

    constructor(onStart: () => void) {
        this.onStart = onStart;
        this.container = document.createElement('div');
        this.container.id = 'title-screen';
        this.applyStyles();
        this.buildUI();
        document.body.appendChild(this.container);
    }

    private applyStyles() {
        const style = document.createElement('style');
        style.id = 'title-screen-style';
        style.textContent = `
            #title-screen {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: linear-gradient(125deg, #a1c4fd 0%, #c2e9fb 30%, #fbc2eb 70%, #a18cd1 100%);
                background-size: 400% 400%;
                animation: gradientBG 15s ease infinite;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                font-family: 'Nunito', 'Segoe UI', sans-serif;
                user-select: none;
                overflow: hidden;
                cursor: pointer;
            }

            @keyframes gradientBG {
                0% { background-position: 0% 50%; }
                50% { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }

            .aesthetic-bg-elements {
                position: absolute;
                top: 0; left: 0; width: 100vw; height: 100vh;
                pointer-events: none;
                z-index: -1;
                overflow: hidden;
            }

            /* Falling Star Trails */
            .falling-star {
                position: absolute;
                width: 3px;
                border-radius: 999px;
                animation: fallStar linear infinite;
                opacity: 0;
            }

            @keyframes fallStar {
                0%   { transform: translateY(-120px) rotate(var(--angle)); opacity: 0; }
                5%   { opacity: 0.9; }
                80%  { opacity: 0.6; }
                100% { transform: translateY(130vh) rotate(var(--angle)); opacity: 0; }
            }

            .float-bubble {
                position: absolute;
                border-radius: 50%;
                background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.9), rgba(255,255,255,0.2) 60%, transparent 100%);
                animation: floatUp ease-in-out infinite alternate;
            }

            @keyframes floatUp {
                0%   { transform: translateY(0) scale(1); opacity: 0.5; }
                100% { transform: translateY(-100px) scale(1.1); opacity: 0.8; }
            }

            .title-version {
                position: absolute;
                top: 20px; left: 20px;
                background: linear-gradient(135deg, #74b9ff, #0984e3);
                color: white;
                padding: 8px 16px;
                border-radius: 20px;
                font-weight: bold;
                font-size: clamp(0.8rem, 2.5vw, 1.2rem);
                border: 3px solid white;
                box-shadow: 0 4px 8px rgba(0,0,0,0.2);
                display: flex; align-items: center; gap: 8px;
            }

            .title-logo-container {
                margin-bottom: 40px;
                animation: floatLogo 4s ease-in-out infinite;
                transform-origin: center;
                text-align: center;
            }

            /* GRAVITY-STYLE FONT: thick black multi-layer outline */
            .title-logo {
                font-size: clamp(3rem, 12vw, 7rem);
                font-weight: 900;
                text-transform: uppercase;
                margin: 0;
                line-height: 1;
                background: linear-gradient(to bottom, #ff9a9e 0%, #fecfef 50%, #fede7f 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                /* Gravity-style: thick layered black outline */
                -webkit-text-stroke: 6px black;
                filter:
                    drop-shadow(0px 10px 0px #e6628c)
                    drop-shadow(4px 4px 0px rgba(0,0,0,0.85))
                    drop-shadow(-4px -4px 0px rgba(0,0,0,0.85))
                    drop-shadow(4px -4px 0px rgba(0,0,0,0.85))
                    drop-shadow(-4px 4px 0px rgba(0,0,0,0.85))
                    drop-shadow(0 20px 30px rgba(0,0,0,0.5));
                letter-spacing: 2px;
            }

            .title-logo-sub {
                font-size: clamp(2.5rem, 10vw, 6rem);
                font-weight: 900;
                text-transform: uppercase;
                margin: -10px 0 0 0;
                line-height: 1;
                background: linear-gradient(to bottom, #fdcb6e 0%, #ffeaa7 100%);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                background-clip: text;
                -webkit-text-stroke: 6px black;
                filter:
                    drop-shadow(0px 10px 0px #e17055)
                    drop-shadow(4px 4px 0px rgba(0,0,0,0.85))
                    drop-shadow(-4px -4px 0px rgba(0,0,0,0.85))
                    drop-shadow(4px -4px 0px rgba(0,0,0,0.85))
                    drop-shadow(-4px 4px 0px rgba(0,0,0,0.85))
                    drop-shadow(0 20px 30px rgba(0,0,0,0.5));
                letter-spacing: 4px;
            }

            .title-start-btn {
                background: linear-gradient(to bottom, #74b9ff, #0984e3);
                border: 4px solid white;
                border-radius: 50px;
                padding: 15px 50px;
                color: white;
                font-size: clamp(1.2rem, 4vw, 2rem);
                font-weight: 800;
                text-transform: uppercase;
                box-shadow: 0 10px 0 #005f9e, 0 15px 20px rgba(0,0,0,0.3);
                cursor: pointer;
                transition: transform 0.1s;
                animation: pulseStart 2s infinite;
            }

            .title-start-btn:active {
                transform: translateY(10px);
                box-shadow: 0 0px 0 #005f9e, 0 5px 10px rgba(0,0,0,0.3);
            }

            @keyframes floatLogo {
                0%, 100% { transform: translateY(0) rotate(-1deg); }
                50% { transform: translateY(-15px) rotate(1deg); }
            }

            @keyframes pulseStart {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }

            .aesthetic-sparkle {
                position: absolute;
                width: 30px; height: 30px;
                background: radial-gradient(circle, white 20%, transparent 60%);
                clip-path: polygon(50% 0%, 60% 40%, 100% 50%, 60% 60%, 50% 100%, 40% 60%, 0% 50%, 40% 40%);
                animation: twinkle 1.5s infinite alternate;
            }
            .s1 { top: 25%; left: 25%; transform: scale(1.5); animation-delay: 0s; }
            .s2 { top: 30%; right: 28%; transform: scale(1); animation-delay: 0.5s; }
            .s3 { bottom: 35%; left: 35%; transform: scale(1.2); animation-delay: 1s; }
            .s4 { bottom: 40%; right: 30%; transform: scale(0.8); animation-delay: 0.2s; }
            .s5 { top: 15%; right: 15%; transform: scale(2); background: radial-gradient(circle, #ffeaa7 20%, transparent 60%); }

            @keyframes twinkle {
                0% { opacity: 0.2; transform: scale(0.5) rotate(0deg); }
                100% { opacity: 1; transform: scale(1.2) rotate(45deg); }
            }
        `;
        if (!document.getElementById('title-screen-style')) {
            document.head.appendChild(style);
        }
    }

    private buildUI() {
        // Font
        const fontLink = document.createElement('link');
        fontLink.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@700;900&display=swap';
        fontLink.rel = 'stylesheet';
        document.head.appendChild(fontLink);

        // Dynamic Background Elements
        const bgLayer = document.createElement('div');
        bgLayer.className = 'aesthetic-bg-elements';

        // Create 12 falling stars with unique properties
        const starColors = [
            ['rgba(255,255,255,0.9)', 'rgba(255,255,200,0.6)'],
            ['rgba(255,200,255,0.9)', 'rgba(200,150,255,0.5)'],
            ['rgba(200,230,255,0.9)', 'rgba(100,180,255,0.5)'],
            ['rgba(255,240,180,0.9)', 'rgba(255,200,100,0.5)'],
        ];

        for (let i = 0; i < 18; i++) {
            const star = document.createElement('div');
            star.className = 'falling-star';
            const [starTop, starTail] = starColors[i % starColors.length];
            const starHeight = 60 + Math.random() * 180;
            const angle = 10 + Math.random() * 25; // degrees, slight left-right tilt

            star.style.setProperty('--angle', `${angle}deg`);
            star.style.left = `${Math.random() * 110 - 5}vw`;
            star.style.top = `-${starHeight}px`;
            star.style.height = `${starHeight}px`;
            star.style.background = `linear-gradient(to bottom, ${starTop}, ${starTail}, transparent)`;
            star.style.boxShadow = `0 0 6px 2px ${starTop}`;
            star.style.animationDuration = `${2.5 + Math.random() * 4}s`;
            star.style.animationDelay = `${-Math.random() * 8}s`;
            bgLayer.appendChild(star);
        }

        // Create 10 bubbles
        for (let i = 0; i < 10; i++) {
            const bubble = document.createElement('div');
            bubble.className = 'float-bubble';
            const size = 20 + Math.random() * 60;
            bubble.style.width = `${size}px`;
            bubble.style.height = `${size}px`;
            bubble.style.left = `${Math.random() * 100}vw`;
            bubble.style.top = `${Math.random() * 100}vh`;
            bubble.style.animationDuration = `${3 + Math.random() * 4}s`;
            bubble.style.animationDelay = `${-Math.random() * 4}s`;
            bgLayer.appendChild(bubble);
        }

        this.container.appendChild(bgLayer);

        // Version Badge
        const versionBadge = document.createElement('div');
        versionBadge.className = 'title-version';
        versionBadge.innerHTML = `<span>🎮</span> VERSION 1.0`;
        this.container.appendChild(versionBadge);

        // Logo
        const logoContainer = document.createElement('div');
        logoContainer.className = 'title-logo-container';

        const logoTop = document.createElement('h1');
        logoTop.className = 'title-logo';
        logoTop.textContent = 'RHYTHM';

        const logoBottom = document.createElement('h2');
        logoBottom.className = 'title-logo-sub';
        logoBottom.textContent = 'MASTER';

        logoContainer.appendChild(logoTop);
        logoContainer.appendChild(logoBottom);
        this.container.appendChild(logoContainer);

        // Start Button
        const startBtn = document.createElement('div');
        startBtn.className = 'title-start-btn';
        startBtn.textContent = 'PRESS START';
        this.container.appendChild(startBtn);

        // Sparkles
        ['s1', 's2', 's3', 's4', 's5'].forEach(c => {
            const sp = document.createElement('div');
            sp.className = `aesthetic-sparkle ${c}`;
            this.container.appendChild(sp);
        });

        // Click Handler
        this.container.addEventListener('click', () => {
            // Play a sound effect if possible here
            this.startTransition();
        });

        // Touch Handler
        this.container.addEventListener('touchstart', (e) => {
            e.preventDefault(); // prevent double firing with click
            this.startTransition();
        });
    }

    private startTransition() {
        // Flash white effect
        const flash = document.createElement('div');
        flash.style.position = 'fixed';
        flash.style.top = '0';
        flash.style.left = '0';
        flash.style.width = '100vw';
        flash.style.height = '100vh';
        flash.style.backgroundColor = 'white';
        flash.style.opacity = '0';
        flash.style.transition = 'opacity 0.3s ease-out';
        flash.style.zIndex = '10001';
        this.container.appendChild(flash);

        // Trigger reflow
        void flash.offsetWidth;
        flash.style.opacity = '1';

        // Clean up and start
        setTimeout(() => {
            this.destroy();
            this.onStart();
        }, 300);
    }

    public destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        const style = document.getElementById('title-screen-style');
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }
}
