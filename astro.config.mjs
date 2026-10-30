// @ts-check
import partytown from "@astrojs/partytown";
import react from "@astrojs/react";
import tailwind from "@astrojs/tailwind";
import AstroPWA from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
    integrations: [
        react(),
        tailwind({
            applyBaseStyles: false,
        }),
        partytown({
            config: {
                forward: ["dataLayer.push"],
            },
        }),
        AstroPWA({
            // Las versiones nuevas se instalan solas al volver a abrir la web.
            registerType: "autoUpdate",
            workbox: {
                // Incluye los datos de Madrid para que la app funcione con mala cobertura.
                globPatterns: ["**/*.{js,css,html,png,ico,svg,json,wasm,bin}"],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                // Las páginas de revisión no son la app: que no se sustituyan por ella.
                navigateFallbackDenylist: [/\/revision\//],
                // El fondo del mapa viene de CARTO/OSM: se guardan las teselas
                // ya vistas para que se vean también sin conexión.
                runtimeCaching: [
                    {
                        urlPattern:
                            /^https:\/\/([a-d]\.basemaps\.cartocdn\.com|tile\.openstreetmap\.org)\//,
                        handler: "CacheFirst",
                        options: {
                            cacheName: "teselas",
                            expiration: {
                                maxEntries: 4000,
                                maxAgeSeconds: 60 * 60 * 24 * 60,
                            },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
            manifest: {
                name: "Hide+Seek Madrid",
                short_name: "Hide+Seek",
                description:
                    "Mapa para jugar al escondite de Jet Lag en la Comunidad de Madrid.",
                icons: [
                    {
                        src: "/Hide-Seek-Madrid/JLIcon.png",
                        sizes: "1080x1080",
                        type: "image/png",
                    },
                    {
                        src: "/Hide-Seek-Madrid/android-chrome-192x192.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "/Hide-Seek-Madrid/android-chrome-512x512.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
                theme_color: "#1F2F3F",
            },
        }),
    ],
    devToolbar: {
        enabled: false,
    },
    site: "https://paramaxksp.github.io",
    base: "Hide-Seek-Madrid",
});
