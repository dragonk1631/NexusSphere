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
     * @param onProgress 진행률 콜백 (percentage, statusText)
     */
    public async run(onProgress?: (p: number, status: string) => void): Promise<SongEntry[]> {
        const report = (p: number, status: string) => {
            if (onProgress) onProgress(p, status);
        };

        report(0, "Initializing Engine...");
        
        try {
            const al = AssetLoader.getInstance();
            const vault = OfflineDownloadManager.getInstance();

            // 0. Load Asset Manifest
            await al.loadManifest();
            const manifest = al.getManifest();
            if (manifest) {
                vault.setKnownAssets(manifest);
            }

            // 1. Load Official Songs Manifest
            report(0.05, "Fetching Catalog...");
            const res = await vault.vaultFetch('assets/data/official_songs.json');
            if (!res.ok) throw new Error("Failed to load song manifest.");
            const data = await res.json();
            this.officialSongs = data.map((s: any) => ({ ...s, isCustom: false }));
            
            // 2. Vault Sync Phase (0.1 ~ 0.70)
            const isSyncDone = (localStorage.getItem('nexus-vault-sync-v1') === 'done');
            
            if (!isSyncDone) {
                report(0.1, "Synchronizing Library (Initial)...");
                await vault.installLibrary(this.officialSongs, (p, status) => {
                    report(0.1 + (p * 0.6), status);
                });

                // [IMPORTANT] Sync 완료 후 최신 매니페스트와 곡 목록을 다시 로드하여 즉시 반영합니다.
                report(0.68, "Updating Catalog after Sync...");
                await al.loadManifest(true);
                const manifestAfterSync = al.getManifest();
                if (manifestAfterSync) vault.setKnownAssets(manifestAfterSync);

                const resRetry = await vault.vaultFetch('assets/data/official_songs.json');
                if (resRetry.ok) {
                    const dataRetry = await resRetry.json();
                    this.officialSongs = dataRetry.map((s: any) => ({ ...s, isCustom: false }));
                    console.log(`[SystemInitializer] Catalog updated after sync: ${this.officialSongs.length} songs.`);
                }
            } else {
                report(0.7, "Library Sync Verified.");
            }
            
            // 3. Asset Verification Phase (0.70 ~ 0.95)
            report(0.7, "Verifying Assets...");
            this.invalidSongs = [];
            let processed = 0;
            const total = this.officialSongs.length;

            // [Optimization] Mobile에서 이미 싱크가 완료된 경우 검증 배치를 크게 가져갑니다.
            const BATCH_SIZE = isSyncDone ? 25 : 10;
            
            for (let i = 0; i < total; i += BATCH_SIZE) {
                const batch = this.officialSongs.slice(i, i + BATCH_SIZE);
                await Promise.all(batch.map(async (song) => {
                    await this.probeSongAssets(song);
                    processed++;
                    const verifyProgress = 0.7 + (processed / total) * 0.25;
                    report(verifyProgress, `Verifying: ${song.name}`);
                }));
            }

            // 4. Finalizing (0.95 ~ 1.0)
            report(0.95, "Preparing Stage...");
            this.logHiddenSongs();
            this.verifiedSongs = this.officialSongs.filter(s => !(s as any).isInvalid);
            
            report(1, "Ready.");
            return this.verifiedSongs;
        } catch (e) {
            console.error("[SystemInitializer] Critical error during initialization:", e);
            report(1, "Initialization Failed.");
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
        const audioPath = song.audioUrl || await al.findAudioPath(song.name) || `assets/audio/mp3/${song.name}.mp3`;
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
