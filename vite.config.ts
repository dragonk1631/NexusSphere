import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
    // [ADAPTIVE BASE] Cloudflare Pages는 루트(/)를 사용하며, 깃허브 페이지는 '/NexusSphere/' 서브디렉토리를 사용합니다.
    const isCloudflare = !!process.env.CF_PAGES || !!process.env.VITE_CF_PAGES;
    const base = isCloudflare ? '/' : (command === 'serve' ? '/' : '/NexusSphere/');

    return {
        base,
    plugins: [
        basicSsl(), // 모바일 테스트(전체화면, 센서 등)를 위해 SSL 다시 활성화
        // [ADD] Cloudflare Pages 25MB 파일 제한을 피하기 위한 자동 클린업 플러그인
        {
          name: 'cloudflare-pages-cleanup',
          closeBundle: async () => {
              const fs = await import('fs');
              const path = await import('path');
              const distPath = path.resolve('dist');
              const maxSize = 24 * 1024 * 1024; // 24MB

              const cleanup = (dir) => {
                  if (!fs.existsSync(dir)) return;
                  const files = fs.readdirSync(dir);
                  for (const file of files) {
                      const fullPath = path.join(dir, file);
                      const stat = fs.statSync(fullPath);
                      if (stat.isDirectory()) {
                          // R2에 있는 대용량 폴더는 통째로 삭제 (초기 UI 제외)
                          if (['audio', 'background-themes', 'videos'].includes(file)) {
                              console.log(`[Vite:Cleanup] Removing directory: ${file}`);
                              fs.rmSync(fullPath, { recursive: true, force: true });
                          } else {
                              cleanup(fullPath);
                          }
                      } else if (stat.size > maxSize) {
                          console.log(`[Vite:Cleanup] Removing large file: ${file} (${(stat.size / 1024 / 1024).toFixed(2)}MB)`);
                          fs.unlinkSync(fullPath);
                      }
                  }
              };
              console.log('[Vite:Cleanup] Starting post-build cleanup for CF Pages...');
              cleanup(distPath);
          }
        },
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: false // SSL 인증서 오류 방지를 위해 개발 모드에서는 SW 비활성화 (빌드 시 자동 활성화)
            },
            workbox: {
                // 대용량 사운드폰트(32MB+) 및 오디오 파일을 캐싱하기 위해 제한 해제 (150MB)
                maximumFileSizeToCacheInBytes: 150 * 1024 * 1024,
                globPatterns: ['**/*.{js,css,html,ico,png,svg,json,mp3,mid,sf2}'],
                
                // [PHASE 1] v=... 쿼리 파라미터가 캐시 적중을 방해하지 않도록 설정 (오프라인 핵심)
                ignoreURLParametersMatching: [/^v$/],
                
                // [PHASE 2] 외부 에셋(R2 등) 및 API 데이터 캐싱 규칙
                runtimeCaching: [
                    {
                        // 이미지, 오디오, 그리고 설정 파일(.json) 포함
                        // [Hardening] vault_sync 파라미터가 있는 요청(수동 동기화)은 서비스 워커가 간섭하지 않도록 제외함.
                        urlPattern: ({ url }) => {
                            const isAsset = /\.(?:png|jpg|jpeg|svg|mp3|wav|ogg|sf2|mid|json)(?:\?.*)?$/i.test(url.pathname);
                            const isSync = url.searchParams.has('vault_sync');
                            return isAsset && !isSync;
                        },
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
            protocol: 'wss',
            port: 5173
        },
        proxy: {
            // [BACKEND BRIDGE] Route all /api calls to the local Cloudflare Functions worker
            '/api': {
                target: 'http://localhost:8788',
                changeOrigin: true,
                secure: false,
            }
        }
    },
    build: {
        outDir: 'dist',
    }
    }
});
