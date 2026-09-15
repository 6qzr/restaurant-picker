import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
            manifest: {
                id: '/',
                name: "Chef's Choice",
                short_name: "Chef's Choice",
                description: 'Three places to eat near you, and never the same three twice.',
                // "." is relative and breaks launching the installed app from a
                // deep link -- which matters now that share links exist.
                start_url: '/',
                scope: '/',
                display: 'standalone',
                orientation: 'portrait',
                background_color: '#f7f4f1',
                theme_color: '#f7f4f1',
                icons: [
                    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,woff2,svg,png}'],
                // The service worker precaches the app shell and NOTHING else.
                // Overpass results are already persisted by our own IndexedDB
                // layer (caching them again would be redundant), and caching
                // Google responses would cross the terms boundary that the data
                // layer is structured to enforce.
                navigateFallbackDenylist: [/^\/api/],
                runtimeCaching: [],
            },
            devOptions: { enabled: false },
        }),
    ],
    server: {
        // host:true lets you open the app from a phone on the LAN. Note that
        // http://192.168.x.x is NOT a secure context, so geolocation is blocked
        // there -- use a tunnel or a local HTTPS cert for real-device testing.
        host: true,
        port: 5173,
    },
    build: {
        target: 'es2020',
        sourcemap: true,
    },
});
