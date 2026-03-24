import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
    swSrc: "app/sw.ts",
    swDest: "public/sw.js",
    disable: process.env.NODE_ENV === "development",
});

// Auto-generate build version on every build: format YYMMDD.HHMM
const d = new Date();
const buildVer = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;

const nextConfig: NextConfig = {
    /* config options here */
    turbopack: {},
    transpilePackages: ['@ionic/react', '@ionic/core', '@stencil/core', 'ionicons'],
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
