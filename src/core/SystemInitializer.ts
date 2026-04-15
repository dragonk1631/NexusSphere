import type { SongEntry } from '../games/rhythm/types/GameTypes';
import { AssetLoader } from './asset/AssetLoader';
import { OfflineDownloadManager } from './asset/OfflineDownloadManager';

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
     * @param onProgress 진행률 콜백 (0.0 ~ 1.0)
     */
    public async run(onProgress?: (p: number) => void): Promise<SongEntry[]> {
        if (onProgress) onProgress(0);
        
        try {
            const al = AssetLoader.getInstance();

            // 0. Load Asset Manifest (Ensures zero-noise probing)
            await al.loadManifest();

            // 0.5. Vault에 매니페스트를 공유하여, 존재하지 않는 파일의 다운로드를 원천 차단합니다.
            const vault = OfflineDownloadManager.getInstance();
            const manifest = al.getManifest();
            if (manifest) {
                vault.setKnownAssets(manifest);
            }

            // 1. Load Official Songs Manifest (Vault 우선 → R2 요청 방지)
            const res = await vault.vaultFetch('assets/data/official_songs.json');
            if (!res.ok) throw new Error("Failed to load song manifest.");
            const data = await res.json();
            this.officialSongs = data.map((s: any) => ({ ...s, isCustom: false }));
            
            // [OFFLINE VAULT SYNC] 모든 시스템 자산을 오프라인 저장소(Vault)에 설치합니다.
            await vault.installLibrary(this.officialSongs, (p) => {
                const percent = Math.floor(p * 100);
                const status = p < 0.2 ? 'Instruments' : 'Library';
                if (onProgress) onProgress(0.1 + (p * 0.9));
                // Console logging as a substitute for the missing UI call
                console.log(`[Vault] Syncing ${status}... (${percent}%)`);
            });
            
            this.invalidSongs = [];
            let processed = 0;
            const total = this.officialSongs.length;

            // 2. Silent Asset Verification (Using the manifest loaded in Step 0)
            const BATCH_SIZE = 10;
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = this.officialSongs.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (song) => {
                    await this.probeSongAssets(song);
                    processed++;
                    if (onProgress) onProgress(processed / total);
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

    private async probeSongAssets(song: SongEntry) {
        const al = AssetLoader.getInstance();

        // A. MIDI Check (Required)
        // Silent check using manifest
        const midiExists = await al.checkAssetExists(song.url);
        
        if (!midiExists) {
            (song as any).isInvalid = true;
            this.invalidSongs.push({ id: song.id || 'unknown', name: song.name, reason: "MIDI file not found in manifest" });
            return;
        }

        // B. MP3 Discovery (Proactive normalization check)
        // Explicit audioUrl이 있다면 그것을 우선적으로 확인합니다.
        const audioPath = song.audioUrl || `assets/audio/mp3/${song.name}.mp3`;
        const audioExists = await al.checkAssetExists(audioPath);
        if (audioExists) {
            (song as any).hasAudio = true;
        }

        // C. Beatmap JSON Discovery
        const beatmapPath = song.beatmapUrl || `assets/data/beatmaps/${song.name}.json`;
        const beatmapExists = await al.checkJsonExists(beatmapPath);
        if (beatmapExists) {
            (song as any).hasBeatmap = true;
        }
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
