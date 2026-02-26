

export class MobileStartScreen {
    private container: HTMLDivElement;
    private onStart: () => void;

    constructor(onStart: () => void) {
        this.onStart = onStart;
        this.container = document.createElement('div');
        this.container.id = 'mobile-start-screen';

        this.applyStyles();
        // Append to documentElement to avoid body's forced rotation in portrait mode
        document.documentElement.appendChild(this.container);
        this.render();
    }

    private applyStyles() {
        const style = document.createElement('style');
        style.id = 'mobile-start-screen-style';
        style.textContent = `
            #mobile-start-screen {
                position: fixed;
                top: 0; left: 0;
                width: 100vw; height: 100vh;
                background: linear-gradient(135deg, #1a0b2e, #4a2b6e);
                z-index: 100000;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-family: 'Nunito', sans-serif;
                color: white;
                text-align: center;
                padding: 20px;
                box-sizing: border-box;
                pointer-events: auto; /* Ensure clicks register */
            }
            .mobile-start-logo {
                font-size: 2.5rem;
                font-weight: 900;
                margin-bottom: 20px;
                text-shadow: 0 4px 10px rgba(0,0,0,0.5);
                background: linear-gradient(to bottom, #ff9a9e, #fecfef, #fede7f);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
            }
            .mobile-start-desc {
                font-size: 1.1rem;
                margin-bottom: 40px;
                line-height: 1.5;
                color: #e0e0e0;
            }
            .mobile-start-btn {
                background: linear-gradient(160deg, #ff9a9e 0%, #f772a1 50%, #fecfef 100%);
                color: #B53471;
                border: 2px solid white;
                padding: 15px 30px;
                font-size: 1.4rem;
                font-weight: 900;
                border-radius: 30px;
                cursor: pointer;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                transition: transform 0.2s, box-shadow 0.2s;
                font-family: inherit;
            }
            .mobile-start-btn:active {
                transform: scale(0.95);
                box-shadow: 0 2px 5px rgba(0,0,0,0.3);
            }
        `;
        if (!document.getElementById('mobile-start-screen-style')) {
            document.head.appendChild(style);
        }
    }

    private render() {
        this.container.innerHTML = `
            <div class="mobile-start-logo">NexusSphere</div>
            <div class="mobile-start-desc">
                최상의 게임 경험을 위해<br>
                전체 화면(가로 모드)으로 시작합니다.
            </div>
            <button class="mobile-start-btn" id="btn-mobile-start">
                🚀 화면 터치하여 시작
            </button>
        `;

        const btn = document.getElementById('btn-mobile-start') as HTMLButtonElement;
        btn.addEventListener('click', async () => {
            // 1. Request Fullscreen immediately on user gesture
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen().catch((err) => {
                    console.warn("Fullscreen error", err);
                });
            }

            // 2. Lock Orientation to landscape
            if (screen.orientation && (screen.orientation as any).lock) {
                await (screen.orientation as any).lock('landscape').catch(() => { });
            }

            this.destroy();
            this.onStart();
        });
    }

    public destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        const style = document.getElementById('mobile-start-screen-style');
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }
}
