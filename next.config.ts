import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    transpilePackages: ['@ionic/react', '@ionic/core', '@stencil/core', 'ionicons'],
};

export default nextConfig;
