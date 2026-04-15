/**
 * NexusSphere Path Utilities
 * 에셋 경로 해결 및 URL 관리를 담당합니다.
 */

/**
 * 경로를 표준 형식(Unix style, NFC)으로 정규화합니다.
 */
export function normalizePath(path: string): string {
    if (!path) return '';
    
    // 1. 역슬래시를 슬래시로 변환 (Windows 환경 대응)
    let p = path.replace(/\\/g, '/');
    
    // 2. PROFESSIONAL: Normalize to NFC for Linux/Web standard compatibility.
    // especially for Korean/Japanese characters which might be NFD on Mac.
    p = p.normalize('NFC');
    
    return p;
}

/**
 * 주어진 경로를 현재 환경(로컬 또는 GitHub Pages)에 맞게 해결합니다.
 * @param path 해결할 자산 경로 (예: 'assets/audio/ui/result.mp3')
 * @returns 해결된 절대 경로 (예: '/NexusSphere/assets/audio/ui/result.mp3')
 */
export function resolveAssetPath(path: string): string {
    if (!path) return '';

    // 1. 이미 프로토콜이 포함된 경우(http, https, data, blob) 그대로 반환
    if (/^(http|https|data|blob):/i.test(path)) {
        return path;
    }

    const externalUrl = import.meta.env.VITE_ASSET_EXTERNAL_URL;
    const assetVersion = import.meta.env.VITE_ASSET_VERSION || '1.0.0';
    let normalizedPath = normalizePath(path);

    // 2. 경로의 시작부분 슬래시 제거 (기초 경로와 중복 방지)
    normalizedPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;

    let resolved: string;

    if (externalUrl) {
        // [PHASE 1] External CDN Support
        const host = externalUrl.endsWith('/') ? externalUrl : `${externalUrl}/`;
        resolved = `${host}${normalizedPath}`;
    } else {
        // [DEFAULT] Vite's BASE_URL (예: '/' 또는 '/NexusSphere/')
        const baseUrl = import.meta.env.BASE_URL || '/';
        const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        resolved = `${base}${normalizedPath}`;
    }

    // [PHASE 1] Hashing Strategy: Append version query parameter
    // If it already has version or cache-buster, skip.
    if (!resolved.includes('v=') && !resolved.includes('cb=')) {
        const separator = resolved.includes('?') ? '&' : '?';
        resolved = `${resolved}${separator}v=${assetVersion}`;
    }
    
    // 3. PROFESSIONAL: Idempotent Encoding
    const needsEncoding = /[\u0080-\uffff\s]/.test(resolved);
    const isAlreadyEncoded = resolved.includes('%');

    try {
        if (isAlreadyEncoded) {
            const decoded = decodeURI(resolved);
            return encodeURI(decoded).replace(/%5B/g, '[').replace(/%5D/g, ']');
        }
        
        if (needsEncoding) {
            return encodeURI(resolved).replace(/%5B/g, '[').replace(/%5D/g, ']');
        }
    } catch (e) {
        console.warn(`[PathUtils] Failed to process URI: ${resolved}`, e);
    }
    
    return resolved;
}
