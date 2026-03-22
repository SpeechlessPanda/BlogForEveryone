const { defineConfig } = require('vite');
const vue = require('@vitejs/plugin-vue');
const path = require('path');

module.exports = defineConfig({
    root: path.resolve(__dirname, 'src/renderer'),
    base: './',
    plugins: [vue()],
    build: {
        outDir: path.resolve(__dirname, 'dist/renderer'),
        emptyOutDir: true
    },
    server: {
        port: 5173,
        strictPort: true
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, 'src/renderer/src')
        }
    }
});
