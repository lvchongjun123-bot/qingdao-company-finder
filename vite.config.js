import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig(({ command }) => ({
  plugins: [vue()],
  // GitHub Pages 项目站点需要 /repo-name/ 作为 base path
  // 本地 dev 不受影响（command === 'serve' 时 base 默认 '/'）
  base: command === 'build' ? '/qingdao-company-finder/' : '/',
  server: {
    port: 5173,
    open: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mobile: resolve(__dirname, 'mobile/index.html')
      }
    }
  }
}))
