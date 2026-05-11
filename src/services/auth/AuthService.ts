import { ModalUI } from '../../ui/ModalUI';
import { ApiUtils } from '../../core/utils/ApiUtils';

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
                    const baseUrl = import.meta.env.BASE_URL;
                    // Standardize the redirect URL to be the current site origin + base path (stripping hashes/params)
                    const redirectUrl = window.location.origin + (baseUrl.endsWith('/') ? baseUrl : baseUrl + '/');
                    
                    console.log(`[AuthService] Initializing with Redirect URL: ${redirectUrl}`);

                    await Clerk.load({
                        appearance: {
                            baseTheme: undefined 
                        },
                        // Fix 404 on GH Pages by explicitly defining the sub-path
                        afterSignInUrl: redirectUrl,
                        afterSignUpUrl: redirectUrl,
                        signInUrl: redirectUrl,
                        signUpUrl: redirectUrl
                    });
                    
                    this.clerk = Clerk;
                    
                    // [NEW] Auth State Change Listener
                    this.clerk.addListener(async ({ user }: any) => {
                        if (user) {
                            console.log('[AuthService] User signed in detected. Triggering score sync...');
                            try {
                                const { ScoreManager } = await import('../../core/score/ScoreManager');
                                await ScoreManager.getInstance().syncWithServer();
                                
                                // [NEW] Refresh Economy for new user
                                const { EconomyManager } = await import('../../core/score/EconomyManager');
                                EconomyManager.getInstance().refresh();
                                
                                // Dispatch global event for UI updates
                                window.dispatchEvent(new CustomEvent('nexus-auth-changed', { detail: { isSignedIn: true } }));
                            } catch (e) {
                                console.error('[AuthService] Failed to sync scores after sign-in:', e);
                            }
                        } else {
                            // [FIX] When no user is detected (sign out), return everything to guest defaults
                            import('../../core/score/ScoreManager').then(({ ScoreManager }) => {
                                ScoreManager.getInstance().load();
                            });

                            import('../../core/ThemeManager').then(({ ThemeManager }) => {
                                ThemeManager.getInstance().setTheme('deep-space');
                            });

                            import('../../core/NoteSkinManager').then(({ NoteSkinManager }) => {
                                NoteSkinManager.getInstance().setSkin('classic-gel');
                            });

                            import('../../core/score/EconomyManager').then(({ EconomyManager }) => {
                                EconomyManager.getInstance().refresh();
                            });
                            window.dispatchEvent(new CustomEvent('nexus-character-changed', { detail: { charId: 'baby' } }));
                            
                            console.log('[AuthService] User signed out. All selections reset to factory defaults.');
                            window.dispatchEvent(new CustomEvent('nexus-auth-changed', { detail: { isSignedIn: false } }));
                        }
                    });

                    console.log('[AuthService] Official Clerk SDK loaded successfully.');
                    resolve();
                } catch (e) {
                    console.error('----------------------------------------------------');
                    console.error('[AuthService] CRITICAL AUTH INITIALIZATION ERROR:');
                    console.error(e);
                    console.error('----------------------------------------------------');
                    // We resolve instead of reject to allow the app to boot in GUEST mode
                    resolve(); 
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
        if (!this.clerk?.user) return 'Guest';
        
        let displayName = this.clerk.user.username;
        
        if (!displayName && this.clerk.user.emailAddresses && this.clerk.user.emailAddresses.length > 0) {
            displayName = this.clerk.user.emailAddresses[0].emailAddress;
        }

        if (!displayName) return 'Guest';

        if (displayName.includes('@')) {
            displayName = displayName.split('@')[0];
        }

        return displayName;
    }

    public async openSignIn(): Promise<void> {
        if (!this.clerk) {
            ModalUI.getInstance().show(
                'SYSTEM ERROR',
                'Authentication service is not ready. Please check your internet connection or try again later.',
                { type: 'error' }
            );
            return;
        }
        this.clerk.openSignIn();
    }

    public async signOut(): Promise<void> {
        await this.clerk?.signOut();
    }

    public isAdmin(): boolean {
        if (!this.isSignedIn()) return false;
        
        // Clerk uses publicMetadata for role-based access
        const role = this.clerk.user.publicMetadata?.role;
        
        // Hardcoded emergency admin ID or email domain can also be added here if needed
        // For now, we trust the metadata set by the backend/dashboard
        return role === 'admin';
    }

    public async adminGiveCoins(targetUserId: string, amount: number): Promise<{ success: boolean, message: string }> {
        if (!this.isAdmin()) return { success: false, message: 'Admin privileges required.' };
        
        try {
            const token = await this.clerk.session.getToken({ template: 'Default' });
            console.log("[AuthService] Admin Token (Gift):", token);
            
            const response = await ApiUtils.fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'give_coins',
                    targetUserId,
                    data: { amount }
                })
            });
            
            if (!response.ok) throw new Error(await response.text());
            return await response.json();
        } catch (e: any) {
            console.error('[AuthService] adminGiveCoins failed:', e);
            return { success: false, message: e.message };
        }
    }

    public async adminDeleteUser(targetUserId: string): Promise<{ success: boolean, message: string }> {
        if (!this.isAdmin()) return { success: false, message: 'Admin privileges required.' };
        
        try {
            const token = await this.clerk.session.getToken({ template: 'Default' });
            const response = await ApiUtils.fetch('/api/admin/users', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action: 'delete',
                    targetUserId
                })
            });
            
            if (!response.ok) throw new Error(await response.text());
            return await response.json();
        } catch (e: any) {
            console.error('[AuthService] adminDeleteUser failed:', e);
            return { success: false, message: e.message };
        }
    }

    public async fetchAdminUsers(): Promise<any[]> {
        if (!this.isAdmin()) return [];
        
        try {
            const token = await this.clerk.session.getToken({ template: 'Default' });
            console.log("[AuthService] Admin Token (Fetch):", token);

            const response = await ApiUtils.fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(await response.text());
            return await response.json();
        } catch (e) {
            console.error('[AuthService] fetchAdminUsers failed:', e);
            return [];
        }
    }
}
