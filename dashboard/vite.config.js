import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const haBase = env.VITE_HA_BASE_URL || 'http://localhost:8123';
  const haToken = env.VITE_HA_TOKEN || '';

  const calendarTarget = 'http://localhost:3001';
  return defineConfig({
    plugins: [react()],
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      pool: 'threads',
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/calendar-api': {
          target: calendarTarget,
          changeOrigin: true,
        },
        '/api': {
          target: haBase,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            if (haToken) {
              proxy.on('proxyReq', (proxyReq) => {
                proxyReq.setHeader('Authorization', `Bearer ${haToken}`);
              });
            }
          },
        },
      },
    },
  });
};
