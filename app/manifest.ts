import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "B.Duck Cityfuns",
        short_name: "B.Duck Cityfuns",
        description: "Ứng dụng nội bộ Joy World Entertainment",
        scope: '/',
        start_url: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FFB800',
        theme_color: '#FFB800',
        icons: [
            {
                src: '/logo-square.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/logo-square.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
        ],
    };
}
