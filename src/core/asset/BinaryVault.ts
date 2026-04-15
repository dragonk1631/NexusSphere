/**
 * BinaryVault (IndexedDB Specialized for Large Blobs)
 * 서비스 워커의 URL 기반 캐싱(Cache API)을 완전히 우회하기 위해 IndexedDB를 사용하여
 * 대용량 바이너리 파일을 '데이터'로서 관리합니다.
 */
export class BinaryVault {
    private static instance: BinaryVault;
    private static readonly DB_NAME = 'NexusSphere_Binary_Vault';
    private static readonly STORE_NAME = 'blobs';
    private static readonly VERSION = 1;

    private db: IDBDatabase | null = null;

    private constructor() {}

    public static getInstance(): BinaryVault {
        if (!BinaryVault.instance) {
            BinaryVault.instance = new BinaryVault();
        }
        return BinaryVault.instance;
    }

    private async ensureDb(): Promise<IDBDatabase> {
        if (this.db) return this.db;

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(BinaryVault.DB_NAME, BinaryVault.VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(BinaryVault.STORE_NAME)) {
                    db.createObjectStore(BinaryVault.STORE_NAME);
                }
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 바이너리 데이터를 저장합니다.
     */
    public async store(key: string, data: Blob | ArrayBuffer): Promise<void> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(BinaryVault.STORE_NAME, 'readwrite');
            const store = transaction.objectStore(BinaryVault.STORE_NAME);
            const request = store.put(data, key);

            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 바이너리 데이터를 가져옵니다.
     */
    public async get(key: string): Promise<Blob | null> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(BinaryVault.STORE_NAME, 'readonly');
            const store = transaction.objectStore(BinaryVault.STORE_NAME);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(request.error);
        });
    }

    /**
     * 데이터 존재 여부를 확인합니다.
     */
    public async has(key: string): Promise<boolean> {
        const db = await this.ensureDb();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(BinaryVault.STORE_NAME, 'readonly');
            const store = transaction.objectStore(BinaryVault.STORE_NAME);
            const request = store.count(key);

            request.onsuccess = () => resolve(request.result > 0);
            request.onerror = () => reject(request.error);
        });
    }
}
