/**
 * ClerkAuth.ts - Clerk SDK 서비스 래퍼
 * 
 * NOTE: 이 서비스를 초기화하려면 .env에 VITE_CLERK_PUBLISHABLE_KEY가 필요합니다.
 */

export class AuthService {
    private static instance: AuthService;
    private clerk: any = null; // window.Clerk
    private publishableKey: string = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';

    private constructor() {}

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    public async init(): Promise<void> {
        if (this.clerk || !this.publishableKey) return;
        
        // 브라우저 환경에서 이미 로드되어 있는지 확인
        if ((window as any).Clerk) {
            this.clerk = (window as any).Clerk;
            if (!this.clerk.isReady) await this.clerk.load();
            return;
        }

        // 1. Publishable Key에서 Frontend API URL 추출 (Clerk 공식 로직)
        // pk_test_... 또는 pk_live_... 에서 중간의 호스트 정보를 추출
        let frontendApi = '';
        try {
            const decoded = atob(this.publishableKey.split('_')[2]);
            frontendApi = decoded.split('$')[0];
        } catch (e) {
            console.error('[AuthService] Invalid Publishable Key format');
            return;
        }

        // 2. 동적으로 공식 SDK 스크립트 로드
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.setAttribute('data-clerk-publishable-key', this.publishableKey);
            script.async = true;
            // 공식 엔드포인트에서 SDK를 가져와야 모든 UI 컴포넌트(Standard Bundle)가 포함됩니다.
            script.src = `https://${frontendApi}/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`;
            
            script.onload = async () => {
                const Clerk = (window as any).Clerk;
                try {
                    await Clerk.load({
                        appearance: {
                            baseTheme: undefined // 테마 커스터마이징 가능
                        }
                    });
                    this.clerk = Clerk;
                    console.log('[AuthService] Official Clerk SDK loaded successfully.');
                    resolve();
                } catch (e) {
                    reject(e);
                }
            };
            
            script.onerror = () => reject(new Error('Clerk SDK load failed from official source'));
            document.body.appendChild(script);
        });
    }

    public getClerk(): any {
        return this.clerk;
    }

    public isSignedIn(): boolean {
        return this.clerk?.user ? true : false;
    }

    public getUserId(): string | null {
        return this.clerk?.user?.id || null;
    }

    public getUserName(): string {
        return this.clerk?.user?.fullName || 'Guest';
    }

    public async openSignIn(): Promise<void> {
        if (!this.clerk) {
            alert('Clerk이 아직 로드되지 않았거나 키 설정이 필요합니다.');
            return;
        }
        this.clerk.openSignIn();
    }

    public async signOut(): Promise<void> {
        await this.clerk?.signOut();
    }
}
