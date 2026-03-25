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
        background_color: '#E6A800',
        theme_color: '#E6A800',
        icons: [
            {
                src: '/summer_logo.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any',
            },
            {
                src: '/summer_logo.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any',
            },
        ],
    };
}
