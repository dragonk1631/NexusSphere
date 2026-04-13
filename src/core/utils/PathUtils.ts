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

    // 2. 이미 절대 경로로 인코딩된 것 같으면(예: http로 시작하지 않지만 %를 포함함) 그대로 반환하거나 처리
    // 단, %를 포함하더라도 BASE_URL이 안 붙어 있을 수 있으므로 신중히 처리
    let normalizedPath = normalizePath(path);

    // 3. Vite의 BASE_URL (예: '/' 또는 '/NexusSphere/')
    const baseUrl = import.meta.env.BASE_URL || '/';
    
    // 4. 경로의 시작부분 슬래시 제거 (기초 경로와 중복 방지)
    normalizedPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;

    // 5. 기초 경로와 자산 경로 결합
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const resolved = `${base}${normalizedPath}`;
    
    // 6. PROFESSIONAL: Idempotent Encoding
    // If the path already contains percent-encoded characters, decode it first to prevent double encoding.
    // Example: "너의 의미" -> "%EB%84%88..." -> resolve again -> "%25EB..." (ERROR)
    const needsEncoding = /[\u0080-\uffff\s]/.test(resolved);
    const isAlreadyEncoded = resolved.includes('%');

    try {
        if (isAlreadyEncoded) {
            // 이미 인코딩된 부분이 있다면 전체를 디코딩하고 다시 인코딩하여 표준화
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
