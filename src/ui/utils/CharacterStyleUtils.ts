import { getCharacterImagePath } from '../../core/utils/PathUtils';

export const CharacterFrame = {
    IDLE: 0,
    HAPPY: 1,
    MISS: 2,
    CRY: 3
} as const;

export type CharacterFrame = typeof CharacterFrame[keyof typeof CharacterFrame];

// 비율 캐싱을 통해 중복 로딩 및 계산을 방지합니다.
const ratioCache: Map<string, number> = new Map();

/**
 * 캐릭터 이미지의 가로세로 비율을 분석하여 최적의 스프라이트 스타일을 적용합니다.
 * 애니메이션 슬라이딩 현상과 깜빡임을 최소화하도록 최적화되었습니다.
 */
export async function applyCharacterSpriteStyle(element: HTMLElement, charId: string, frame: CharacterFrame = CharacterFrame.IDLE): Promise<void> {
    if (!element || !charId || charId.startsWith('placeholder-')) return;

    const imgUrl = getCharacterImagePath(charId);
    if (!imgUrl) return;

    const applyStyles = (ratio: number) => {
        // 프레임 좌표 계산 (2x2 그리드)
        const col = frame % 2; 
        const row = Math.floor(frame / 2); 
        
        // [완벽한 해결책]: 모든 이미지를 강제로 2x2 정방형 그리드로 매핑합니다. (200% x 200%)
        // 이렇게 하면 배경 이미지 상에서 한 프레임이 정확히 요소의 크기와 일치하게 되어, 
        // 어떠한 비율의 이미지라도 인접 시트가 보이지 않는 '제로 누수' 상태가 됩니다.
        element.style.backgroundSize = '200% 200%';
        element.style.backgroundPosition = `${col === 0 ? '0%' : '100%'} ${row === 0 ? '0%' : '100%'}`;
        element.style.backgroundRepeat = 'no-repeat';
        element.style.backgroundImage = `url('${imgUrl}')`;

        // 애니메이션 슬라이딩 방지
        const originalTransition = element.style.transition;
        element.style.transition = 'none';

        // [비율 복구 및 레터박스 모드]: 세로 기준으로 꽉 차게(100% height) 표시하고 
        // 가로쪽은 원래 비율을 유지하여 레터박스가 생기도록 합니다.
        if (ratio < 0.95) {
            // 세로형 (1:1.5 등): 세로 높이는 100%를 유지하고, 가로폭만 ratio만큼 줄입니다.
            // 이렇게 하면 전신이 다 보이면서 좌우에 깔끔한 레터박스가 생깁니다.
            element.style.transform = `scaleX(${ratio}) scaleY(1)`;
        } else {
            // 정방형 혹은 가로형: 기본 1:1 크기 유지
            element.style.transform = 'scale(1)';
        }

        // 강제 리플로우를 통해 트랜지션 없이 즉시 반영되도록 함
        element.offsetHeight; 
        element.style.transition = originalTransition;
    };

    // 1. 캐시 확인
    if (ratioCache.has(charId)) {
        applyStyles(ratioCache.get(charId)!);
        return;
    }

    // 2. 이미지 로딩 및 비율 계산
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const ratio = img.naturalWidth / img.naturalHeight;
            ratioCache.set(charId, ratio);
            applyStyles(ratio);
            resolve();
        };
        img.onerror = () => {
            console.warn(`[CharacterStyleUtils] Failed to load image for ${charId}`);
            resolve();
        };
        img.src = imgUrl;
    });
}
