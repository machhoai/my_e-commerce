"use client";

import React, { useState, useEffect } from 'react';
import { IoLogoFacebook, IoLogoTiktok, IoQrCodeOutline, IoListOutline } from "react-icons/io5";
import { SiZalo } from "react-icons/si";
import { QRCodeSVG } from 'qrcode.react'; // Thư viện tạo QR nhanh và nhẹ

interface SocialLink {
    name: string;
    url: string;
    icon: React.ReactNode;
    color: string;
}

export default function BioPage() {
    // State để kiểm soát việc hiển thị nội dung
    const [isVisible, setIsVisible] = useState(false);
    const [showQR, setShowQR] = useState(false)

    useEffect(() => {
        // Đợi 1 giây sau khi trang load xong thì mới kích hoạt hiện nội dung
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

    const currentUrl = "https://bduckcityfunsvietnam.vercel.app";

    const socialLinks: SocialLink[] = [
        {
            name: 'B.Duck Cityfuns Vietnam',
            url: 'https://web.facebook.com/share/1GZr1FPT9N/?mibextid=wwXIfr&_rdc=1&_rdr',
            icon: <IoLogoFacebook />,
            color: 'text-[#1877F2]'
        },
        {
            name: 'b.duckcityfunsvietnam',
            url: 'https://www.tiktok.com/@b.duckcityfunsvietnam?_r=1&_t=ZS-927veGnUf7Q',
            icon: <IoLogoTiktok />,
            color: 'text-black'
        },
        {
            name: 'B.Duck Cityfuns Vietnam _ Cộng đồng',
            url: 'https://zalo.me/g/gzqohy222',
            icon: <SiZalo />,
            color: 'text-black'
        },
    ];

    return (
        <div className="min-h-screen relative flex flex-col items-center px-6 py-12 overflow-x-hidden">
            {/* Background */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('./Artboard.png')` }}
            >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>
            </div>

            <div className={`relative z-10 w-full max-w-md flex flex-col items-center transition-all duration-1000 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                }`}>

                {/* Logo Section */}
                <div className="w-full mb-4 flex items-center justify-center overflow-hidden">
                    <img src="./logo.png" alt="B.Duck Logo" className="w-4/5 object-contain" />
                </div>

                <h1 className="text-white text-2xl font-bold mb-1 text-center drop-shadow-md">
                    B.Duck Cityfuns Vietnam
                </h1>
                <p className="text-yellow-300 text-sm mb-6 italic drop-shadow-md text-center">
                    Be Playful • Be Fun • B.Duck
                </p>

                {/* Nút chuyển đổi QR / List */}
                <button
                    onClick={() => setShowQR(!showQR)}
                    className="absolute flex items-center gap-2 p-2 aspect-square right-0 bg-yellow-400 hover:bg-yellow-500 text-black font-bold rounded-full shadow-lg transition-transform active:scale-90"
                >
                    {showQR ? <IoListOutline size={20} /> : <IoQrCodeOutline size={20} />}
                </button>

                {/* Vùng nội dung thay đổi */}
                <div className="w-full min-h-[300px] flex justify-center items-start">
                    {!showQR ? (
                        /* Danh sách Links */
                        <div className="w-full space-y-4 animate-fade-in">
                            {socialLinks.map((link, index) => (
                                <a
                                    key={index}
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center p-4 bg-white/95 hover:bg-yellow-400 rounded-2xl transition-all shadow-xl group active:scale-95"
                                >
                                    <span className={`w-10 h-10 ${link.color} rounded-xl flex items-center justify-center text-[40px]`}>
                                        {link.icon}
                                    </span>
                                    <span className="flex-1 ml-4 text-left font-bold text-gray-800 text-lg uppercase tracking-tight">
                                        {link.name}
                                    </span>
                                    <span className="text-gray-400 group-hover:text-white transition-colors">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                                        </svg>
                                    </span>
                                </a>
                            ))}
                        </div>
                    ) : (
                        /* Khu vực mã QR */
                        <div className="bg-[#fffee1] p-8 rounded-[32px] shadow-2xl flex flex-col items-center animate-zoom-in">
                            <QRCodeSVG
                                value={currentUrl}
                                size={200}
                                bgColor={"#fffee1"}
                                fgColor={"#000"}
                                level={"H"}
                                title=''
                                includeMargin={false}
                                imageSettings={{
                                    src: "./bduck.png", // Chèn logo nhỏ vào giữa QR
                                    x: undefined,
                                    y: undefined,
                                    height: 40,
                                    width: 40,
                                    excavate: true,
                                }}
                            />
                        </div>
                    )}
                </div>
            </div>

            <style jsx global>{`
                .animate-fade-in {
                    animation: fadeIn 0.5s ease-in-out;
                }
                .animate-zoom-in {
                    animation: zoomIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes zoomIn {
                    from { opacity: 0; transform: scale(0.8); }
                    to { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}