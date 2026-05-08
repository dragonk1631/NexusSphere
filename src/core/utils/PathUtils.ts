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

    const externalUrl = import.meta.env.VITE_ASSET_EXTERNAL_URL || 
                        import.meta.env.VITE_R2_EXTERNAL_URL;
    
    const assetVersion = import.meta.env.VITE_ASSET_VERSION || '1.0.0';
    let normalizedPath = normalizePath(path);

    // [CORE-UI-BYPASS] 앱 실행 직후 보여야 하는 핵심 UI 리소스는 CDN을 거치지 않고 메인 호스트(GitHub Pages)에서 직접 로드합니다.
    const isCoreUI = normalizedPath.includes('assets/images/ui/') || 
                     normalizedPath.includes('assets/favicons/') ||
                     normalizedPath.includes('assets/logos/') ||
                     normalizedPath.includes('assets/images/characters/');

    // 2. 경로의 시작부분 슬래시 제거 (기초 경로와 중복 방지)
    normalizedPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;

    let resolved: string;

    if (externalUrl && !isCoreUI) {
        // [PHASE 1] External CDN Support (Production only or specified environment)
        const host = externalUrl.endsWith('/') ? externalUrl : `${externalUrl}/`;
        // Ensure we don't have double slashes if normalizedPath also starts with one
        const cleanPath = normalizedPath.startsWith('/') ? normalizedPath.slice(1) : normalizedPath;
        resolved = `${host}${cleanPath}`;
    } else {
        // [DEFAULT] Vite's BASE_URL (Core UI or Local Dev)
        const baseUrl = import.meta.env.BASE_URL || '/';
        const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
        resolved = `${base}${normalizedPath}`;
    }

    // [PHASE 1] Hashing Strategy: Append version query parameter
    // Skip versioning for external CDN/GitHub URLs to avoid potential loading issues with Raw content providers
    const isExternal = !!(externalUrl && !isCoreUI);
    if (!isExternal && !resolved.includes('v=') && !resolved.includes('cb=')) {
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

/**
 * 캐릭터 ID를 받아 표준화된 이미지 에셋 경로를 반환합니다.
 * 이 함수를 통해 캐릭터 이미지 경로 규칙을 중앙에서 관리합니다.
 */
export function getCharacterImagePath(charId: string): string {
    if (!charId || charId.startsWith('placeholder-')) return '';
    
    // [CENTRALIZED PATH MANAGEMENT]
    // 캐릭터 이미지의 기본 위치를 중앙에서 관리합니다.
    // 기존 3개 캐릭터와 동일하게 기본적으로 GitHub Raw 저장소를 참조하도록 설정되어 있습니다.
    const githubBase = 'https://raw.githubusercontent.com/dragonk1631/NexusSphere/main/public/assets/images/characters';
    
    // 환경 변수(VITE_CHARACTER_ASSET_URL)가 있으면 이를 우선 사용하고, 없으면 GitHub 주소를 사용합니다.
    // 나중에 R2 등으로 대량 이동 시 .env 파일에서 URL 하나만 바꾸면 모든 캐릭터 이미지가 즉시 반영됩니다.
    let charBaseUrl = import.meta.env.VITE_CHARACTER_ASSET_URL || githubBase;

    // [DEV FRIENDLY] 개발 환경에서는 로컬에 새로 추가한 이미지가 보이지 않는 문제를 방지하기 위해 
    // 로컬 경로를 우선적으로 참조하도록 지능적으로 처리할 수 있습니다.
    if (import.meta.env.DEV && !import.meta.env.VITE_CHARACTER_ASSET_URL) {
        return resolveAssetPath(`assets/images/characters/char_${charId}.png`);
    }
    
    const cleanBase = charBaseUrl.endsWith('/') ? charBaseUrl.slice(0, -1) : charBaseUrl;
    return `${cleanBase}/char_${charId}.png`;
}
