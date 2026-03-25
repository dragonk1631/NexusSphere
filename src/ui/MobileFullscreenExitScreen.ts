
export class MobileFullscreenExitScreen {
    private container: HTMLDivElement;

    constructor() {
        this.container = document.createElement('div');
        this.container.id = 'mobile-fullscreen-exit-screen';

        this.applyStyles();
        // Append to documentElement to avoid body's forced rotation in portrait mode
        document.documentElement.appendChild(this.container);
        this.render();
    }

    private applyStyles() {
        const style = document.createElement('style');
        style.id = 'mobile-fullscreen-exit-style';
        style.textContent = `
            #mobile-fullscreen-exit-screen {
                position: fixed;
                top: 0; left: 0;
                width: 100vw; height: 100vh;
                background: linear-gradient(135deg, #0f0c29, #302b63, #24243e);
                z-index: 200000; /* Higher than MobileStartScreen */
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                font-family: 'Inter', 'Nunito', sans-serif;
                color: white;
                text-align: center;
                padding: 30px;
                box-sizing: border-box;
                pointer-events: auto;
                backdrop-filter: blur(10px);
            }
            .exit-screen-logo {
                font-size: 2.2rem;
                font-weight: 900;
                margin-bottom: 25px;
                background: linear-gradient(to right, #ff4e50, #f9d423);
                -webkit-background-clip: text;
                -webkit-text-fill-color: transparent;
                letter-spacing: -1px;
            }
            .exit-screen-desc {
                font-size: 1.15rem;
                margin-bottom: 45px;
                line-height: 1.7;
                color: #f0f0f0;
                max-width: 500px;
                word-break: keep-all;
            }
            .exit-screen-btn {
                background: linear-gradient(135deg, #00f2fe 0%, #4facfe 100%);
                color: white;
                border: 2px solid rgba(255,255,255,0.3);
                padding: 18px 45px;
                font-size: 1.3rem;
                font-weight: 800;
                border-radius: 40px;
                cursor: pointer;
                box-shadow: 0 8px 25px rgba(79, 172, 254, 0.4);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                font-family: inherit;
                text-transform: uppercase;
            }
            .exit-screen-btn:active {
                transform: scale(0.92);
                box-shadow: 0 4px 12px rgba(79, 172, 254, 0.3);
            }
            .exit-screen-btn:hover {
                transform: translateY(-3px);
                box-shadow: 0 12px 30px rgba(79, 172, 254, 0.5);
                border-color: white;
            }
        `;
        if (!document.getElementById('mobile-fullscreen-exit-style')) {
            document.head.appendChild(style);
        }
    }

    private render() {
        this.container.innerHTML = `
            <div class="exit-screen-logo">NEXUS SPHERE</div>
            <div class="exit-screen-desc">
                전체 화면 모드가 해제되었습니다.<br><br>
                최상의 게임 경험과 오동작 방지를 위해<br>
                전체 화면 모드에서만 실행이 가능합니다.<br><br>
                처음부터 다시 시작하려면 아래 버튼을 눌러주세요.
            </div>
            <button class="exit-screen-btn" id="btn-fullscreen-refresh">
                🔄 새로고침 (Restart)
            </button>
        `;

        const btn = document.getElementById('btn-fullscreen-refresh') as HTMLButtonElement;
        btn.addEventListener('click', () => {
            window.location.reload();
        });
    }

    public destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        const style = document.getElementById('mobile-fullscreen-exit-style');
        if (style && style.parentNode) {
            style.parentNode.removeChild(style);
        }
    }
}
