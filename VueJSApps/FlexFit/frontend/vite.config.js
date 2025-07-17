import { fileURLToPath, URL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';

const FRONTEND_PORTS = [5173, 5174, 5175];
let FRONTEND_PORT = FRONTEND_PORTS[0];

const findAvailablePort = (portIndex = 0) => {
  if (portIndex >= FRONTEND_PORTS.length) {
    console.error("❌ No available ports for the frontend.");
    process.exit(1);
  }

  const testPort = FRONTEND_PORTS[portIndex];
  const net = require('net');
  const server = net.createServer();
  server.listen(testPort, () => {
    FRONTEND_PORT = testPort;
    server.close();
  });
  server.on('error', () => {
    console.warn(`⚠️ Port ${testPort} is in use. Trying next port...`);
    findAvailablePort(portIndex + 1);
  });
};

// Call the function before exporting the config
findAvailablePort();

export default defineConfig({
  plugins: [
    vue(),
    VueI18nPlugin({
      runtimeOnly: false,
      include: resolve(dirname(fileURLToPath(import.meta.url)), './src/i18n/locales/**'), // provide a path to the folder where you'll store translation data
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: FRONTEND_PORT,
  },
});