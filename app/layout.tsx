// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./global.css";
// import Footer from "@/components/Footer"; // Ví dụ component Footer

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "B.Duck Cityfuns Vietnam",
    description: "B.Duck Cityfuns Vietnam",
    icons: {
        icon: [
            { url: "/favicon.ico" }, // File nằm trong thư mục public/favicon.ico
            { url: "/bduck.png", type: "image/png" }, // File public/logo.png
        ],
        apple: [
            { url: "/apple-touch-icon.png" }, // Icon dành cho iPhone khi lưu ra màn hình chính
        ],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="vi" >
            <head>
                <Script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></Script>
                <Script noModule src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js"></Script>
            </head>
            <body className={`${inter.className} min-h-dvh w-full relative overflow-x-hidden flex flex-col`}>
                <main className="h-full" >
                    {children} {/* Nội dung của page.tsx sẽ hiển thị ở đây */}
                </main>
                <footer className="text-white/50 absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-light italic">
                    Designed for B.Duck Cityfuns Vietnam
                </footer>
                <footer className="text-white/70 text-xs absolute bottom-2 left-1/2 -translate-x-1/2">
                    © 2025 B.Duck Cityfuns Vietnam
                </footer>
            </body>
        </html>
    );
}