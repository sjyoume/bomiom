import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // 🔥 1. 사주 API만 특정해서 공공데이터포털로 직접 연결 (우선순위 1번)
      '/api/saju': {
        target: 'http://apis.data.go.kr/B090041/openapi/service/LrsrCldInfoService/getLunCalInfo',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/saju/, '')
      },
      // 2. 그 외 나머지 /api 요청은 원래대로 기존 로컬 백엔드(server.cjs)로 연결
      '/api': {
        target: 'http://localhost:8080', 
        changeOrigin: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
})