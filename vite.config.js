const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue');
const pkg = require('./package.json');

module.exports = defineConfig({
  plugins: [vue()],
  base: './',
  // 编译期注入公共常量：版本号统一从 package.json 读取，env.js 里用 __APP_VERSION__ 引用
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 8080,
    strictPort: false,
    host: '0.0.0.0',
  },
});
