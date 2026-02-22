import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
    // 개발 모드에서는 루트(/), 빌드(배포) 시에는 저장소 이름을 base 경로로 설정합니다.
    base: command === 'serve' ? '/' : '/NexusSphere/',
    plugins: [
        basicSsl()
    ],
    server: {
        https: true,
        host: true, // Listen on all addresses, including LAN IP
        strictPort: true,
        hmr: {
            host: 'localhost',
            protocol: 'wss',
        }
    },
    build: {
        outDir: 'dist',
    }
}));
