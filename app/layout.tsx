// app/layout.tsx
import type { Metadata } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./global.css";
import Navbar from "@/components/Navbar"; // Ví dụ component Navbar
import Header from "@/components/Header";
// import Footer from "@/components/Footer"; // Ví dụ component Footer

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "Pharmacity",
    description: "Mô tả shop...",
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
            <body className={`${inter.className} h-screen w-full relative overflow-x-hidden`}>
                <main className="h-fit" >
                    {children} {/* Nội dung của page.tsx sẽ hiển thị ở đây */}
                </main>
            </body>
        </html>
    );
}