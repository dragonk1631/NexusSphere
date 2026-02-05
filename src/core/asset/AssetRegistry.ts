/**
 * NexusSphere Asset Registry
 * 모든 게임에서 공통으로 사용하는 에셋의 경로를 정의합니다.
 */

export const ASSET_PATHS = {
    IMAGES: {
        COMMON: {
            LANE: 'assets/images/common/lane.png',
            DIVIDER: 'assets/images/common/divider.png',
            GLOW: 'assets/images/common/glow.png',
        },
        UI: {
            BUTTON: 'assets/images/ui/button.png',
            PANEL: 'assets/images/ui/panel.png',
        }
    },
    AUDIO: {
        MIDI: {
            TEST: 'assets/audio/midi/test.mid',
        },
        SOUNDFONTS: {
            DEFAULT: 'assets/audio/soundfonts/default.sf2',
        }
    }
} as const;

export type AssetImageKey = keyof typeof ASSET_PATHS.IMAGES.COMMON | keyof typeof ASSET_PATHS.IMAGES.UI;
export type AssetMidiKey = keyof typeof ASSET_PATHS.AUDIO.MIDI;
export type AssetSoundFontKey = keyof typeof ASSET_PATHS.AUDIO.SOUNDFONTS;
