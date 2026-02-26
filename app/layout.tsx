// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./global.css";
import { AuthProvider } from "@/contexts/AuthContext";
import InstallPWA from "@/components/InstallPWA";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    metadataBase: new URL("https://bduckcityfunsvietnam.vercel.app"),
    title: "B.Duck Cityfuns Vietnam",
    description: "B.Duck Cityfuns Vietnam",
    icons: {
        icon: [
            { url: "/favicon.ico" },
            { url: "/bduck.png", type: "image/png" },
        ],
        apple: [
            { url: "/apple-touch-icon.png" },
        ],
    },
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Lịch Làm Việc",
    },
    formatDetection: {
        telephone: false,
    },
    openGraph: {
        title: "B.Duck Cityfuns Vietnam",
        description: "Be Playful • Be Fun • B.Duck",
        url: "https://bduckcityfunsvietnam.vercel.app",
        siteName: "B.Duck Cityfuns Vietnam",
        images: [
            {
                url: "/Artboard.png",
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
        images: ["/Artboard.png"],
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
            <body className={`${inter.className} min-h-dvh w-full relative overflow-x-hidden flex flex-col`} suppressHydrationWarning>
                <AuthProvider>
                    {children}
                    <InstallPWA />
                </AuthProvider>
            </body>
        </html>
    );
}