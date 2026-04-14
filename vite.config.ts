import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    // 개발 모드에서는 루트(/), 빌드(배포) 시에는 저장소 이름을 base 경로로 설정합니다.
    base: command === 'serve' ? '/' : '/NexusSphere/',
    plugins: [
        basicSsl(), // 모바일 테스트(전체화면, 센서 등)를 위해 SSL 다시 활성화
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: true // 개발 단계에서도 Service Worker를 활성화하여 캐싱을 테스트함
            },
            workbox: {
                // 대용량 사운드폰트(32MB+) 및 오디오 파일을 캐싱하기 위해 제한 해제 (100MB)
                maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,mp3,mid,sf2}'],
                
                // [PHASE 2] 외부 에셋(R2 등) 및 API 데이터 캐싱 규칙
                runtimeCaching: [
                    {
                        // 이미지, 오디오, 그리고 설정 파일(.json) 포함
                        urlPattern: /\.(?:png|jpg|jpeg|svg|mp3|wav|ogg|sf2|mid|json)(?:\?.*)?$/i,
                        handler: 'CacheFirst', // 로컬 캐시 우선 (있으면 네트워크 안 탐)
                        options: {
                            cacheName: 'nexussphere-asset-vault',
                            expiration: {
                                maxEntries: 500,
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1년간 보관
                            },
                            cacheableResponse: {
                                statuses: [0, 200],
                            },
                        },
                    },
                ],
            },
            manifest: {
                name: 'NexusSphere Portal',
                short_name: 'NexusSphere',
                start_url: './',
                display: 'fullscreen',
                orientation: 'landscape',
                background_color: '#111111',
                theme_color: '#00ffcc',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    }
                ]
            }
        })
    ],
    server: {
        https: {},
        host: true, // Listen on all addresses, including LAN IP
        port: 5173, // 기존 배치 파일과의 호환성을 위해 5173으로 복구합니다.
        strictPort: true,
        hmr: {
            // HTTPS 환경에서의 HMR 안정성을 위해 설정을 원래대로 복구하거나 자동으로 맡깁니다.
        }
    },
    build: {
        outDir: 'dist',
    }
}));
