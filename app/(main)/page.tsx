"use client";

import React, { useState, useEffect } from 'react';
import { IoLogoFacebook, IoLogoTiktok } from "react-icons/io5";

interface SocialLink {
    name: string;
    url: string;
    icon: React.ReactNode;
    color: string;
}

export default function BioPage() {
    // State để kiểm soát việc hiển thị nội dung
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Đợi 1 giây sau khi trang load xong thì mới kích hoạt hiện nội dung
        const timer = setTimeout(() => {
            setIsVisible(true);
        }, 1000);

        return () => clearTimeout(timer);
    }, []);

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
    ];

    return (
        <div className="min-h-screen relative flex flex-col items-center px-6 py-12 overflow-x-hidden">
            {/* Background - Hiện ngay lập tức */}
            <div
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url('./Artboard.png')` }}
            >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"></div>
            </div>

            {/* Nội dung chính - Được bao bọc bởi hiệu ứng Transition */}
            <div className={`relative z-10 w-full max-w-md flex flex-col items-center transition-all duration-1000 ease-out ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
                }`}>

                {/* Logo Section */}
                <div className="w-full">
                    <div className="w-full h-full mb-4 flex items-center justify-center overflow-hidden">
                        <img
                            src="./logo.png"
                            alt="B.Duck Logo"
                            className="w-4/5 object-contain"
                        />
                    </div>
                </div>

                <h1 className="text-white text-2xl font-bold mb-1 text-center drop-shadow-md">
                    B.Duck Cityfuns Vietnam
                </h1>
                <p className="text-yellow-300 text-sm mb-8 italic drop-shadow-md">
                    Be Playful • Be Fun • B.Duck
                </p>

                {/* Links Section */}
                <div className="w-full space-y-4">
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
                            <span className="flex-1 ml-2 text-left font-bold text-gray-800 text-lg">
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

                
            </div>

            {/* Global Animation Styles */}
            <style jsx global>{`
                @keyframes bounce-slow {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-12px); }
                }
                .animate-bounce-slow {
                    animation: bounce-slow 3s ease-in-out infinite;
                }
            `}</style>
        </div>
    );
}