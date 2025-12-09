"use client";
import { Bell, Menu, Search, ShoppingCart } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

export const HeaderWrapper = () => {
    const [isScrolled, setIsScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            // Kiểm tra nếu scroll quá 100px
            if (window.scrollY > 80) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };

        window.addEventListener("scroll", handleScroll);

        // Cleanup event listener khi component unmount
        return () => {
            window.removeEventListener("scroll", handleScroll);
        };
    }, []);

    return (
        <>
            <StickyHeader isScrolled={isScrolled} />
            <Header />
        </>
    );
};

// 4. StickyHeader nhận props isScrolled để đổi giao diện
const StickyHeader = ({ isScrolled }: { isScrolled: boolean }) => {
    return (
        <div className="flex h-[60px] text-white bg-primary sticky top-0 left-0 w-full p-3 gap-4 justify-between items-center z-50 transition-all duration-300">
            <div>
                <Menu />
            </div>

            {/* Logic chuyển đổi giữa Logo và Thanh tìm kiếm */}
            <div className="flex-1 flex justify-start transition-all duration-300">
                {isScrolled ? (
                    // Giao diện ô Search khi scroll xuống
                    <div className="w-full bg-white text-black h-10 rounded-md flex items-center px-3 gap-2 animate-in fade-in zoom-in duration-300">
                        <Search size={18} className="text-[#727272]" />
                        <input
                            type="text"
                            placeholder="Bạn đang tìm gì hôm nay..."
                            className="w-full text-sm outline-none text-black placeholder:text-[#727272] bg-transparent"
                        />
                    </div>
                ) : (
                    // Giao diện Logo mặc định
                    <div className="animate-in fade-in zoom-in duration-300">
                        <Image
                            src={'https://prod-cdn.pharmacity.io/e-com/images/static-website/pharmacity-logo.svg'}
                            alt="logo"
                            width={100}
                            height={100}
                            className="object-contain"
                        />
                    </div>
                )}
            </div>

            <div className="flex gap-4">
                <div className="size-10 bg-white text-black flex justify-center items-center rounded-full p-2">
                    <Bell className="size-full" strokeWidth={1.5} />
                </div>
                <div className="size-10 bg-white text-black flex justify-center items-center rounded-full p-2">
                    <ShoppingCart className="size-full" strokeWidth={1.5} />
                </div>
            </div>
        </div>
    );
};

const Header = () => {
    return (
        <div className="relative h-[60px] -top-[1px]">
            <Image
                src={'/menu/20240807152307-0-banner-header.avif'}
                alt="menu background"
                fill
                className="absolute -z-10 object-cover object-bottom"
                sizes="100vw"
            />

            <div className="w-full px-3 left-0 absolute -bottom-5 overflow-visible">
                <div className="w-full bg-white border rounded-md flex p-2 gap-2 shadow-sm">
                    <Search />
                    <p className="text-[#727272]">Bạn đang tìm gì hôm nay...</p>
                </div>
            </div>
        </div>
    );
};