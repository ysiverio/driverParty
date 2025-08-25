import { defineConfig } from 'vite';

export default defineConfig({
  root: 'public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'public/index.html',
        driver: 'public/driver.html',
        client: 'public/client.html'
      }
    }
  },
  server: {
    port: 8080,
    host: true,
    open: true
  },
  preview: {
    port: 8080,
    host: true
  },
  define: {
    'process.env': {}
  }
});
