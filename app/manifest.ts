import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "B.Duck",
        short_name: "B.Duck",
        description: "Ứng dụng đăng ký và quản lý điểm ca làm việc",
        scope: '/',
        start_url: '/login',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#3b82f6',
        icons: [
            {
                src: '/Artboard.png', // Fallback to existing icon if standard ones are missing
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/logo-square.png', // Assuming user will add it or we create one
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
            }
        ],
    };
}
