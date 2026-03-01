import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    // 개발 모드에서는 루트(/), 빌드(배포) 시에는 저장소 이름을 base 경로로 설정합니다.
    base: command === 'serve' ? '/' : '/NexusSphere/',
    plugins: [
        basicSsl(),
        VitePWA({
            registerType: 'autoUpdate',
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
        strictPort: true,
        hmr: {
            protocol: 'wss',
            // Removed host: 'localhost' so mobile devices can connect to the dev server IP
        }
    },
    build: {
        outDir: 'dist',
    }
}));
