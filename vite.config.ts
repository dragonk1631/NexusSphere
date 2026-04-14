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
                enabled: false // 시크릿 창이 아닌 일반 창에서도 SSL 에러 없이 접속되도록 SW는 비활성화
            },
            workbox: {
                // [PHASE 2] 외부 에셋(R2 등) 캐싱 규칙 추가
                runtimeCaching: [
                    {
                        // 이미지 및 오디오 파일 확장자 매칭 (외부 URL 포함)
                        urlPattern: /\.(?:png|jpg|jpeg|svg|mp3|wav|ogg|sf2|mid)(?:\?.*)?$/i,
                        handler: 'CacheFirst', // 캐시에서 먼저 찾고 없으면 네트워크
                        options: {
                            cacheName: 'nexussphere-external-assets',
                            expiration: {
                                maxEntries: 200,             // 최대 200개 파일 보관
                                maxAgeSeconds: 60 * 60 * 24 * 365, // 1년간 보관 (Aggressive)
                            },
                            cacheableResponse: {
                                statuses: [0, 200], // 0(Opaque, CDN) 및 200 응답만 캐싱
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
