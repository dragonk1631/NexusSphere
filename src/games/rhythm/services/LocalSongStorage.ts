export interface LocalSongMetadata {
    id: string;
    title: string;
    artist: string;
    duration: number;
    bpm?: number;
    isCustom: boolean;
    createdAt: number;
    blobKey: string;
}

export class LocalSongStorage {
    private static DB_NAME = 'NexusSphere_Rhythm_DB';
    private static STORE_SONGS = 'songs';
    private static STORE_FILES = 'files';
    private static VERSION = 1;

    private db: IDBDatabase | null = null;

    private async ensureDb(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(LocalSongStorage.DB_NAME, LocalSongStorage.VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(LocalSongStorage.STORE_SONGS)) {
                    db.createObjectStore(LocalSongStorage.STORE_SONGS, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(LocalSongStorage.STORE_FILES)) {
                    db.createObjectStore(LocalSongStorage.STORE_FILES);
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    public async saveSong(metadata: LocalSongMetadata, blob: Blob): Promise<void> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([LocalSongStorage.STORE_SONGS, LocalSongStorage.STORE_FILES], 'readwrite');
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            const songsStore = transaction.objectStore(LocalSongStorage.STORE_SONGS);
            const filesStore = transaction.objectStore(LocalSongStorage.STORE_FILES);

            songsStore.put(metadata);
            filesStore.put(blob, metadata.blobKey);
        });
    }

    public async getAllMetadata(): Promise<LocalSongMetadata[]> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(LocalSongStorage.STORE_SONGS, 'readonly');
            const store = transaction.objectStore(LocalSongStorage.STORE_SONGS);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    public async getSongBlob(blobKey: string): Promise<Blob | null> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(LocalSongStorage.STORE_FILES, 'readonly');
            const store = transaction.objectStore(LocalSongStorage.STORE_FILES);
            const request = store.get(blobKey);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    public async deleteSong(id: string, blobKey: string): Promise<void> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([LocalSongStorage.STORE_SONGS, LocalSongStorage.STORE_FILES], 'readwrite');
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            const songsStore = transaction.objectStore(LocalSongStorage.STORE_SONGS);
            const filesStore = transaction.objectStore(LocalSongStorage.STORE_FILES);

            songsStore.delete(id);
            filesStore.delete(blobKey);
        });
    }
}
