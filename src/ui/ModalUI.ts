
export class ModalUI {
    private static instance: ModalUI;
    private container: HTMLDivElement | null = null;

    private constructor() {}

    public static getInstance(): ModalUI {
        if (!ModalUI.instance) {
            ModalUI.instance = new ModalUI();
        }
        return ModalUI.instance;
    }

    /**
     * Shows a premium in-game modal
     * @param title Modal Title
     * @param message Modal Message
     * @param options Options for buttons and style
     */
    public show(title: string, message: string, options: {
        confirmLabel?: string,
        cancelLabel?: string,
        onConfirm?: () => void,
        onCancel?: () => void,
        type?: 'info' | 'warning' | 'error'
    } = {}): void {
        this.close(); // Close any existing modal

        const overlay = document.createElement('div');
        overlay.id = 'nexus-modal-overlay';
        overlay.style.cssText = `
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
            display: flex; align-items: center; justify-content: center;
            opacity: 0; transition: opacity 0.3s ease;
        `;

        const typeColor = options.type === 'error' ? '#ff4757' : (options.type === 'warning' ? '#ffa502' : '#00ffcc');

        overlay.innerHTML = `
            <style>
                @keyframes modalIn {
                    from { opacity: 0; transform: scale(0.9) translateY(20px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                .modal-box {
                    background: rgba(10, 15, 25, 0.85);
                    border: 2px solid ${typeColor}88;
                    border-radius: 30px;
                    padding: 40px;
                    width: clamp(300px, 80vw, 500px);
                    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.8), 0 0 20px ${typeColor}33;
                    animation: modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
                    text-align: center;
                    color: white;
                    font-family: 'Outfit', sans-serif;
                }
                .modal-title {
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: 2rem;
                    margin-bottom: 15px;
                    background: linear-gradient(to bottom, #fff, #ccc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: 1px;
                }
                .modal-message {
                    font-size: 1.1rem;
                    line-height: 1.6;
                    opacity: 0.9;
                    margin-bottom: 35px;
                }
                .modal-footer {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                }
                .modal-btn {
                    padding: 12px 30px;
                    border-radius: 999px;
                    font-weight: 900;
                    font-size: 1rem;
                    cursor: pointer;
                    transition: 0.2s;
                    text-transform: uppercase;
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    min-width: 120px;
                }
                .modal-btn.confirm {
                    background: linear-gradient(135deg, ${typeColor} 0%, #00d2ff 100%);
                    color: white;
                    border: none;
                    box-shadow: 0 5px 15px ${typeColor}44;
                }
                .modal-btn.cancel {
                    background: rgba(255, 255, 255, 0.05);
                    color: rgba(255, 255, 255, 0.6);
                }
                .modal-btn:hover {
                    transform: scale(1.05) translateY(-2px);
                    filter: brightness(1.2);
                }
            </style>
            <div class="modal-box">
                <div class="modal-title">${title}</div>
                <div class="modal-message">${message}</div>
                <div class="modal-footer">
                    ${options.cancelLabel ? `<button class="modal-btn cancel" id="modal-cancel">${options.cancelLabel}</button>` : ''}
                    <button class="modal-btn confirm" id="modal-confirm">${options.confirmLabel || 'OK'}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        this.container = overlay;

        // Force reflow for transition
        setTimeout(() => overlay.style.opacity = '1', 10);

        const confirmBtn = overlay.querySelector('#modal-confirm');
        confirmBtn?.addEventListener('click', () => {
            this.close();
            if (options.onConfirm) options.onConfirm();
        });

        const cancelBtn = overlay.querySelector('#modal-cancel');
        cancelBtn?.addEventListener('click', () => {
            this.close();
            if (options.onCancel) options.onCancel();
        });
    }

    public close(): void {
        if (this.container) {
            const target = this.container; // Capture current container
            this.container = null; // Unset instance reference immediately
            
            target.style.opacity = '0';
            const box = target.querySelector('.modal-box') as HTMLElement;
            if (box) box.style.transform = 'scale(0.9) translateY(20px)';
            
            setTimeout(() => {
                if (target && target.parentNode) {
                    target.parentNode.removeChild(target);
                }
            }, 300);
        }
    }

    /**
     * Shows a premium auto-hiding notification (Toast)
     */
    public showNotification(title: string, message: string, duration: number = 2500, type: 'info' | 'warning' | 'error' = 'info', subtitle?: string): void {
        const typeColor = type === 'error' ? '#ff4757' : (type === 'warning' ? '#ffa502' : '#00ffcc');
        
        const notification = document.createElement('div');
        notification.className = 'nexus-notification-overlay';
        notification.style.cssText = `
            position: fixed; top: 40px; left: 50%; transform: translateX(-50%);
            z-index: 10000; pointer-events: none;
            opacity: 0; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        `;

        notification.innerHTML = `
            <style>
                @keyframes notifIn {
                    from { opacity: 0; transform: translateY(-20px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                .notif-box {
                    background: rgba(10, 15, 25, 0.9);
                    border: 2px solid ${typeColor};
                    border-radius: 20px;
                    padding: 20px 40px;
                    min-width: 350px;
                    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.9), 0 0 15px ${typeColor}44;
                    animation: notifIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
                    text-align: center;
                    color: white;
                    font-family: 'Outfit', sans-serif;
                    backdrop-filter: blur(15px);
                    -webkit-backdrop-filter: blur(15px);
                    position: relative;
                }
                .notif-title {
                    font-family: 'Black Han Sans', sans-serif;
                    font-size: 1.5rem;
                    margin-bottom: 5px;
                    background: linear-gradient(to bottom, #fff, #ccc);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    letter-spacing: 1px;
                    text-transform: uppercase;
                }
                .notif-message {
                    font-size: 1.1rem;
                    font-weight: 700;
                    opacity: 0.95;
                    letter-spacing: 0.5px;
                }
                .notif-subtitle {
                    font-size: 0.75rem;
                    font-weight: 800;
                    margin-top: 10px;
                    color: ${typeColor};
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    opacity: 0.8;
                }
                .notif-cloud-badge {
                    position: absolute;
                    top: -10px; right: -10px;
                    background: ${typeColor};
                    color: #000;
                    padding: 4px 10px;
                    border-radius: 999px;
                    font-size: 0.65rem;
                    font-weight: 900;
                    box-shadow: 0 0 10px ${typeColor};
                }
            </style>
            <div class="notif-box">
                ${subtitle && subtitle.includes('CLOUD') ? '<div class="notif-cloud-badge">CLOUD SYNC</div>' : ''}
                <div class="notif-title">${title}</div>
                <div class="notif-message">${message}</div>
                ${subtitle ? `<div class="notif-subtitle">${subtitle}</div>` : ''}
            </div>
        `;

        document.body.appendChild(notification);
        
        // Fade in
        setTimeout(() => {
            notification.style.opacity = '1';
        }, 10);

        // Auto hide
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(-20px) scale(0.95)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 400);
        }, duration);
    }
}
