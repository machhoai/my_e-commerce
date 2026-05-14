import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    // DISABLED: Serwist webpack plugin requires self.__SW_MANIFEST in the SW source.
    // Our minimal SW (app/sw.ts) intentionally omits Workbox precaching because
    // Workbox's install-time precaching causes the SW to fail activation on Vercel
    // when any pre-cache request fails. We serve public/sw.js as a plain static file.
    disable: true,
});

// Auto-generate build version on every build: format YYMMDD.HHMM (Vietnam Time GMT+7)
const now = new Date();
const d = new Date(now.getTime() + (7 * 60 * 60 * 1000));
const buildVer = `${d.getUTCFullYear().toString().slice(2)}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}`;

const nextConfig: NextConfig = {
    /* config options here */
    turbopack: {},
    transpilePackages: [
        '@ionic/react', '@ionic/core', '@stencil/core', 'ionicons',
    ],
    serverExternalPackages: ['ai', '@ai-sdk/google', '@ai-sdk/react', '@ai-sdk/provider', '@ai-sdk/provider-utils', 'zkteco-js'],
    env: {
        NEXT_PUBLIC_BUILD_VERSION: buildVer,
    },
    // Allow large API request bodies (base64 ID card photos)
    experimental: {
        serverActions: {
            bodySizeLimit: '10mb',
        },
    },
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'production-cdn.pharmacity.io',
                port: '',
                pathname: '/**',
            },
        ],
    },
};

export default withSerwist(nextConfig);
