import { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'Đăng nhập - B.Duck Cityfuns Vietnam',
    description: 'Đăng nhập vào hệ thống quản lý nhân sự B.Duck Cityfuns Vietnam',
    openGraph: {
        title: 'Đăng nhập - B.Duck Cityfuns Vietnam',
        description: 'Đăng nhập vào hệ thống quản lý nhân sự B.Duck Cityfuns Vietnam',
        url: 'https://bduckcityfunsvietnam.vercel.app/login',
        siteName: 'B.Duck Cityfuns Vietnam',
        images: [
            {
                url: '/Artboard.png',
                width: 1200,
                height: 630,
                alt: 'B.Duck Cityfuns Vietnam Thumbnail',
            },
        ],
        locale: 'vi_VN',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Đăng nhập - B.Duck Cityfuns Vietnam',
        description: 'Đăng nhập vào hệ thống quản lý nhân sự B.Duck Cityfuns Vietnam',
        images: ['/Artboard.png'],
    },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
