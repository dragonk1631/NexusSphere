export interface LocalSongMetadata {
    id: string;
    title: string;
    artist: string;
    duration: number;
    bpm?: number;
    isCustom: boolean;
    createdAt: number;
    blobKey: string;
    isFavorite?: boolean; // Added for custom songs
}

export interface SongState {
    url: string;
    isFavorite: boolean;
    lastDifficulty?: string;
    lastSpeed?: number;
}

export class LocalSongStorage {
    private static DB_NAME = 'NexusSphere_Rhythm_DB';
    private static STORE_SONGS = 'songs';
    private static STORE_FILES = 'files';
    private static STORE_STATES = 'song_states';
    private static VERSION = 2; // Bumped version for new store

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
                if (!db.objectStoreNames.contains(LocalSongStorage.STORE_STATES)) {
                    db.createObjectStore(LocalSongStorage.STORE_STATES, { keyPath: 'url' });
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
            const transaction = db.transaction([LocalSongStorage.STORE_SONGS, LocalSongStorage.STORE_FILES, LocalSongStorage.STORE_STATES], 'readwrite');
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);

            const songsStore = transaction.objectStore(LocalSongStorage.STORE_SONGS);
            const filesStore = transaction.objectStore(LocalSongStorage.STORE_FILES);

            songsStore.delete(id);
            filesStore.delete(blobKey);
            // We could also delete state, but keeping it is fine.
        });
    }

    public async updateSongMetadata(id: string, metadataUpdates: Partial<LocalSongMetadata>): Promise<void> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(LocalSongStorage.STORE_SONGS, 'readwrite');
            const store = transaction.objectStore(LocalSongStorage.STORE_SONGS);
            
            const getRequest = store.get(id);
            getRequest.onsuccess = () => {
                const data = getRequest.result;
                if (!data) {
                    reject(new Error(`Song ${id} not found.`));
                    return;
                }
                const updatedData = { ...data, ...metadataUpdates };
                const putRequest = store.put(updatedData);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            };
            getRequest.onerror = () => reject(getRequest.error);
        });
    }

    // ── Persistent User State (Favorites, etc.) ──

    public async toggleFavorite(url: string, isFavorite: boolean): Promise<void> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(LocalSongStorage.STORE_STATES, 'readwrite');
            const store = transaction.objectStore(LocalSongStorage.STORE_STATES);
            
            const getRequest = store.get(url);
            getRequest.onsuccess = () => {
                const existing = getRequest.result || { url };
                const updated = { ...existing, isFavorite };
                store.put(updated);
            };
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }

    public async getSongStates(): Promise<SongState[]> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(LocalSongStorage.STORE_STATES, 'readonly');
            const store = transaction.objectStore(LocalSongStorage.STORE_STATES);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
