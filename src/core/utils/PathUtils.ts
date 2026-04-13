/**
 * NexusSphere Path Utilities
 * 에셋 경로 해결 및 URL 관리를 담당합니다.
 */

/**
 * 주어진 경로를 현재 환경(로컬 또는 GitHub Pages)에 맞게 해결합니다.
 * @param path 해결할 자산 경로 (예: 'assets/audio/ui/result.mp3')
 * @returns 해결된 절대 경로 (예: '/NexusSphere/assets/audio/ui/result.mp3')
 */
export function resolveAssetPath(path: string): string {
    // 1. 이미 프로토콜이 포함된 경우(http, https 등) 그대로 반환
    if (/^(http|https|data|blob):/i.test(path)) {
        return path;
    }

    // 2. Vite의 BASE_URL (예: '/' 또는 '/NexusSphere/')
    const baseUrl = import.meta.env.BASE_URL || '/';
    
    // 3. 경로의 시작부분 슬래시 제거 (기초 경로와 중복 방지)
    let normalizedPath = path.startsWith('/') ? path.slice(1) : path;

    // 4. 세그먼트별 URL 인코딩 (한글 경로 등 대응) - 전체 encodeURI는 쿼리 파라미터 등을 망칠 수 있으므로 조심스럽게 적용
    // 슬래시는 유지하면서 각 폴더/파일명만 인코딩합니다.
    normalizedPath = normalizedPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
    
    // 5. 기초 경로와 자산 경로 결합
    const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    
    return `${base}${normalizedPath}`;
}
