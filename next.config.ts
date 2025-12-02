import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    transpilePackages: ['@ionic/react', '@ionic/core', '@stencil/core', 'ionicons'],
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'production-cdn.pharmacity.io', // <--- Thêm domain này
                port: '',
                pathname: '/**', // Cho phép tải ảnh từ bất kỳ đường dẫn nào trên domain này
            },
            // Nếu có các domain khác, bạn thêm vào đây
        ],
    },
};

export default nextConfig;
