import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        // host:true lets you open the app from a phone on the LAN.
        // Note: http://192.168.x.x is NOT a secure context, so geolocation is
        // blocked there. Use `npm run dev:https` for real-device testing.
        host: true,
        port: 5173,
    },
    build: {
        target: 'es2020',
        sourcemap: true,
    },
});
