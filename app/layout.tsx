// app/layout.tsx
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./global.css";
import { AuthProvider } from "@/contexts/AuthContext";
import InstallPWA from "@/components/InstallPWA";
import PwaRedirect from "@/components/PwaRedirect";
import SilentPwaUpdater from "@/components/shared/SilentPwaUpdater";
import RegisterSW from "@/components/shared/RegisterSW";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    viewportFit: 'cover', // Bắt buộc để app tràn viền lên tận tai thỏ/đục lỗ
    themeColor: [
        { media: '(prefers-color-scheme: light)', color: '#E6A800' },
        { media: '(prefers-color-scheme: dark)', color: '#E6A800' },
    ],
};

// 2. Cấu hình Metadata chính
export const metadata: Metadata = {
    metadataBase: new URL("https://employee.joyworld.vn"),
    title: "B.Duck Cityfuns Vietnam",
    description: "Be Playful • Be Fun • B.Duck",
    icons: {
        icon: [
            { url: "/summer_logo.png" },
        ],
        apple: [
            { url: "/summer_logo.png" },
        ],
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true, // Bắt buộc để chạy standalone trên iOS
        title: 'B.Duck Cityfuns', // Chỗ này lúc nãy bạn để 'Lịch Làm', mình đổi lại cho hợp với tên dự án nhé
        statusBarStyle: 'default',
    },
    formatDetection: {
        telephone: false,
    },
    openGraph: {
        title: "B.Duck Cityfuns Vietnam",
        description: "Be Playful • Be Fun • B.Duck",
        url: "https://employee.joyworld.vn",
        siteName: "B.Duck Cityfuns Vietnam",
        images: [
            {
                url: "/summer_backdrops.png",
                width: 1200,
                height: 630,
                alt: "B.Duck Cityfuns Vietnam Thumbnail",
            },
        ],
        locale: "vi_VN",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "B.Duck Cityfuns Vietnam",
        description: "Be Playful • Be Fun • B.Duck",
        images: ["/summer_backdrops.png"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="vi">
            <head>
                <Script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></Script>
                <Script noModule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></Script>
            </head>
            <body className={`${inter.className} min-h-dvh custom-scrollbar w-full relative overflow-x-hidden flex flex-col`} suppressHydrationWarning>
                <AuthProvider>
                    {children}
                    <InstallPWA />
                    <PwaRedirect />
                    {/* Register the Service Worker immediately at startup.
                        CRITICAL: Without this, SW is only registered when the user
                        grants notification permission, which means on a fresh
                        Vercel deployment the SW is never installed. */}
                    <RegisterSW />
                    <SilentPwaUpdater />
                </AuthProvider>
            </body>
        </html>
    );
}