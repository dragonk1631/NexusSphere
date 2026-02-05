import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
    // GitHub Pages 배포 시 저장소 이름을 base 경로로 설정합니다.
    base: '/NexusSphere/',
    build: {
        outDir: 'dist',
    }
});
