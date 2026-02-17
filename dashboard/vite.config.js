import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';

export default ({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const haBase = env.VITE_HA_BASE_URL || 'http://localhost:8123';
  const haToken = env.VITE_HA_TOKEN || '';

  const calendarTarget = 'http://localhost:3001';
  return {
    plugins: [react()],
    server: {
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
  };
};
