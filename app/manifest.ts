import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Lịch Làm Việc",
        short_name: "Lịch Làm",
        description: "Ứng dụng đăng ký và quản lý điểm ca làm việc",
        scope: '/',
        start_url: '/',
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
                src: '/logo.png', // Assuming user will add it or we create one
                sizes: '512x512',
                type: 'image/png',
                purpose: 'maskable'
            }
        ],
    };
}
