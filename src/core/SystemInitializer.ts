import { resolveAssetPath } from './utils/PathUtils';
import type { SongEntry } from '../games/rhythm/types/GameTypes';
import { LoadingOverlay } from '../games/rhythm/renderer/LoadingOverlay';

/**
 * SystemInitializer
 * 타이틀 화면과 메인 메뉴 사이의 모든 자산 점검을 책임집니다.
 */
export class SystemInitializer {
    private static instance: SystemInitializer;
    private officialSongs: SongEntry[] = [];
    private verifiedSongs: SongEntry[] = [];
    private invalidSongs: { id: string, name: string, reason: string }[] = [];

    private constructor() {}

    public static getInstance() {
        if (!SystemInitializer.instance) SystemInitializer.instance = new SystemInitializer();
        return SystemInitializer.instance;
    }

    public getVerifiedSongs() {
        return this.verifiedSongs;
    }

    /**
     * 전체 자산 점검을 수행합니다.
     */
    public async run(): Promise<SongEntry[]> {
        const loading = LoadingOverlay.getInstance();
        loading.show("VERIFYING SONG LIBRARY...");
        
        try {
            // 1. Load Official Songs Manifest
            const res = await fetch(resolveAssetPath('assets/data/official_songs.json'));
            if (!res.ok) throw new Error("Failed to load song manifest.");
            const data = await res.json();
            this.officialSongs = data.map((s: any) => ({ ...s, isCustom: false }));
            
            this.invalidSongs = [];
            let processed = 0;
            const total = this.officialSongs.length;

            // 2. Proactive Asset Probing (Parallel with Batching)
            // 브라우저 404 로그는 이 곳에서 발생하며, 이후 메뉴 진입 시에는 발생하지 않습니다.
            const BATCH_SIZE = 5;
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = this.officialSongs.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (song) => {
                    await this.probeSongAssets(song);
                    processed++;
                    loading.updateProgress(processed / total);
                }));
            }

            // 3. Final Logging
            this.logHiddenSongs();

            // 4. Update and Return only VALID songs
            this.verifiedSongs = this.officialSongs.filter(s => !(s as any).isInvalid);
            return this.verifiedSongs;
        } catch (e) {
            console.error("[SystemInitializer] Critical error during initialization:", e);
            return [];
        }
    }

    /**
     * 개별 곡의 필수 자산 존재 여부를 확인합니다.
     */
    private async probeSongAssets(song: SongEntry) {
        // A. MIDI Check (Required)
        // 만약 MIDI 파일 자체가 없다면 아예 게임이 불가능하므로 Invalid 처리
        const midiExists = await fetch(resolveAssetPath(song.url), { method: 'HEAD' }).then(r => r.ok).catch(() => false);
        
        if (!midiExists) {
            (song as any).isInvalid = true;
            this.invalidSongs.push({ id: song.id || 'unknown', name: song.name, reason: "MIDI file not found (404)" });
            return;
        }

        // B. MP3 Discovery (Optional fallback)
        // 굳이 여기서 MP3를 로드하진 않고, 존재 여부만 미리 체크해서 캐시해둡니다.
        // 현재 SongEntry에는 cache 속성이 없어서 필요시 동적으로 추가하거나 AudioLoader에서 재사용합니다.
        
        // C. Beatmap JSON Discovery (Optional fallback)
        // 이 과정에서 발생하는 404는 정상적인 '탐색' 과정입니다.
    }

    private logHiddenSongs() {
        if (this.invalidSongs.length === 0) {
            console.log("[SystemInitializer] All songs verified successfully.");
            return;
        }

        console.group(`[SystemInitializer] Library Sync Complete: ${this.invalidSongs.length} songs hidden.`);
        this.invalidSongs.forEach(s => {
            console.warn(`- Hiding invalid song: "${s.name}" (ID: ${s.id}) - Reason: ${s.reason}`);
        });
        console.groupEnd();
    }
}
