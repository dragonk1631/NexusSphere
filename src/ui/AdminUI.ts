import { AuthService } from '../services/auth/AuthService';
import { ApiUtils } from '../core/utils/ApiUtils';
import { ModalUI } from './ModalUI';

export class AdminUI {
    private static instance: AdminUI;
    private container: HTMLDivElement | null = null;
    private users: any[] = [];

    public static getInstance(): AdminUI {
        if (!AdminUI.instance) AdminUI.instance = new AdminUI();
        return AdminUI.instance;
    }

    public async show(): Promise<void> {
        const auth = AuthService.getInstance();
        if (!auth.isAdmin()) {
            ModalUI.getInstance().show('ACCESS DENIED', 'You do not have administrative privileges.', { type: 'error' });
            return;
        }

        this.createContainer();
        await this.refreshUserList();
    }

    private createContainer() {
        if (this.container) this.container.remove();

        this.container = document.createElement('div');
        this.container.id = 'admin-panel';
        this.container.className = 'admin-overlay';
        this.container.innerHTML = `
            <div class="admin-window">
                <div class="admin-header">
                    <h2>NEXUS SPHERE - COMMAND CENTER</h2>
                    <button class="close-btn">&times;</button>
                </div>
                <div class="admin-stats-summary">
                    <div class="stat-box">Total Users: <span id="admin-total-users">0</span></div>
                    <div class="stat-box">System Status: <span class="status-online">ACTIVE</span></div>
                    <button id="admin-recalc-btn" class="adm-btn warning">FIX ALL USER STATS (RECALC)</button>
                </div>
                <div class="admin-table-container">
                    <table class="admin-table">
                        <thead>
                            <tr>
                                <th>User</th>
                                <th>Level</th>
                                <th>Coins</th>
                                <th>Total Score</th>
                                <th>Last Updated</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="admin-user-list">
                            <!-- User rows will be injected here -->
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.appendChild(this.container);

        this.container.querySelector('.close-btn')?.addEventListener('click', () => {
            this.container?.remove();
            this.container = null;
        });

        this.container.querySelector('#admin-recalc-btn')?.addEventListener('click', async () => {
            if (!confirm('CRITICAL: Recalculate ALL user stats? This will fix XP/Level anomalies for everyone.')) return;
            
            const btn = document.getElementById('admin-recalc-btn') as HTMLButtonElement;
            btn.disabled = true;
            btn.textContent = 'RECALCULATING...';

            try {
                const auth = AuthService.getInstance();
                const token = await auth.getClerk()?.session?.getToken();
                const response = await ApiUtils.fetch('/api/admin/recalculate', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    ModalUI.getInstance().show('REPAIR COMPLETE', data.message);
                    this.refreshUserList();
                } else {
                    ModalUI.getInstance().show('REPAIR FAILED', 'Server error during recalculation.', { type: 'error' });
                }
            } catch (e) {
                ModalUI.getInstance().show('ERROR', 'System connection failed.');
            } finally {
                btn.disabled = false;
                btn.textContent = 'FIX ALL USER STATS (RECALC)';
            }
        });
    }

    private async refreshUserList() {
        const listBody = document.getElementById('admin-user-list');
        if (!listBody) return;

        listBody.innerHTML = '<tr><td colspan="6" style="text-align:center">Loading Nexus Data...</td></tr>';

        try {
            const auth = AuthService.getInstance();
            const token = await auth.getClerk()?.session?.getToken();
            
            const response = await ApiUtils.fetch('/api/admin/users', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                this.users = await response.json();
                document.getElementById('admin-total-users')!.textContent = this.users.length.toString();
                this.renderUsers();
            } else {
                const errorMsg = await response.text();
                ModalUI.getInstance().show('ACCESS DENIED', `Server says: ${errorMsg}`, { type: 'error' });
                listBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:red">FORBIDDEN: ${errorMsg}</td></tr>`;
            }
        } catch (e) {
            console.error('[AdminUI] Load Error:', e);
            listBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red">SYSTEM ERROR: Data connection failed</td></tr>';
        }
    }

    private renderUsers() {
        const listBody = document.getElementById('admin-user-list');
        if (!listBody) return;

        listBody.innerHTML = this.users.map(u => `
            <tr>
                <td class="user-cell">
                    <img src="${u.avatar_url || ''}" class="admin-avatar">
                    <div class="user-info">
                        <span class="u-name">${u.display_name || 'Unknown'}</span>
                        <span class="u-id">${u.user_id}</span>
                    </div>
                </td>
                <td>Lv.${u.level}</td>
                <td><input type="number" class="coin-input" value="${u.total_coins}" data-uid="${u.user_id}"></td>
                <td>${Number(u.total_score).toLocaleString()}</td>
                <td>${new Date(u.updated_at).toLocaleDateString()}</td>
                <td class="action-cell">
                    <button class="adm-btn save" onclick="window.AdminUI_Update('${u.user_id}')">Update</button>
                    <button class="adm-btn delete" onclick="window.AdminUI_Delete('${u.user_id}')">Purge</button>
                </td>
            </tr>
        `).join('');

        // Expose functions to window for onclick handlers
        (window as any).AdminUI_Update = (uid: string) => this.handleUpdate(uid);
        (window as any).AdminUI_Delete = (uid: string) => this.handleDelete(uid);
    }

    private async handleUpdate(uid: string) {
        const input = document.querySelector(`.coin-input[data-uid="${uid}"]`) as HTMLInputElement;
        const newCoins = parseInt(input.value);
        const user = this.users.find(u => u.user_id === uid);

        if (!user) return;

        try {
            const auth = AuthService.getInstance();
            const token = await auth.getClerk()?.session?.getToken();

            const response = await ApiUtils.fetch('/api/admin/users', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'update_stats',
                    targetUserId: uid,
                    data: {
                        total_coins: newCoins,
                        level: user.level,
                        exp: user.exp
                    }
                })
            });

            if (response.ok) {
                ModalUI.getInstance().show('SUCCESS', `User ${user.display_name} updated.`);
                this.refreshUserList();
            }
        } catch (e) {
            ModalUI.getInstance().show('ERROR', 'Update failed.');
        }
    }

    private async handleDelete(uid: string) {
        if (!confirm('CRITICAL: Are you sure you want to PERMANENTLY DELETE this user and all their records?')) return;

        try {
            const auth = AuthService.getInstance();
            const token = await auth.getClerk()?.session?.getToken();

            const response = await ApiUtils.fetch('/api/admin/users', {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action: 'delete',
                    targetUserId: uid
                })
            });

            if (response.ok) {
                ModalUI.getInstance().show('PURGED', 'User records deleted.');
                this.refreshUserList();
            }
        } catch (e) {
            ModalUI.getInstance().show('ERROR', 'Purge failed.');
        }
    }
}
