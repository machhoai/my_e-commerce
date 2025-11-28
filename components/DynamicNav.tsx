"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    ShoppingCart,
    Home,
    LayoutGrid,
    Search,
    User,
    ChevronLeft,
    Plus,
    Minus,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- Utility: Merge ClassNames ---
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Component: Glass Container (Cấu trúc nền kính tối màu) ---
const GlassContainer = ({
    children,
    className,
    onClick,
}: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}) => (
    <motion.div
        layout
        onClick={onClick}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className={cn(
            "bg-[#1e1e1e]/90 backdrop-blur-md border border-white/10 shadow-2xl flex items-center overflow-hidden",
            className
        )}
    >
        {children}
    </motion.div>
);

// --- Component Chính ---
export default function DynamicNav() {
    // Giả lập prop: isProductPage (True = Trang chi tiết, False = Trang thường)
    // Bạn có thể đổi thành props truyền từ ngoài vào
    const [isProductPage, setIsProductPage] = useState(true);

    // State quản lý việc mở rộng Nav trong trang chi tiết
    // False = State 1 (Hiện Add to cart to), True = State 2 (Hiện Nav to)
    const [isNavExpanded, setIsNavExpanded] = useState(false);

    // State số lượng sản phẩm
    const [quantity, setQuantity] = useState(1);

    return (
        <div className="min-h-[300px] w-full bg-[#121212] flex flex-col justify-center items-center gap-8 p-4">
            {/* Nút giả lập để test các trạng thái (Dev only) */}
            <div className="fixed top-5 left-5 text-white bg-gray-800 p-4 rounded-lg text-xs space-y-2 z-50">
                <p className="font-bold text-gray-400 uppercase mb-2">Debug Controls</p>
                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={isProductPage}
                        onChange={(e) => {
                            setIsProductPage(e.target.checked);
                            setIsNavExpanded(false); // Reset trạng thái expand khi đổi trang
                        }}
                    />
                    <label>Đang ở trang Product Detail</label>
                </div>
            </div>

            {/* --- PHẦN UI CHÍNH BẮT ĐẦU TỪ ĐÂY --- */}
            <div className="flex items-center gap-3 h-20">
                <AnimatePresence mode="popLayout" initial={false}>
                    {/* === PART 1: PRODUCT ACTION AREA (Bên Trái) === */}

                    {/* Case A: State 1 - Full Add to Cart Panel */}
                    {isProductPage && !isNavExpanded && (
                        <GlassContainer
                            key="full-action-panel"
                            className="h-16 rounded-full px-2 gap-4"
                        >
                            {/* Counter */}
                            <div className="flex items-center gap-3 px-2">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                >
                                    <Minus size={16} />
                                </button>
                                <span className="text-white font-medium w-4 text-center">
                                    {quantity}
                                </span>
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors"
                                >
                                    <Plus size={16} />
                                </button>
                            </div>

                            {/* Add Button */}
                            <motion.button
                                whileTap={{ scale: 0.95 }}
                                className="bg-[#D97706] hover:bg-[#b45309] text-white px-6 py-3 rounded-full font-medium flex items-center gap-2 transition-colors"
                            >
                                <Plus size={18} />
                                <span>Add to cart</span>
                            </motion.button>
                        </GlassContainer>
                    )}

                    {/* Case B: State 2 - Small Plus Button */}
                    {isProductPage && isNavExpanded && (
                        <GlassContainer
                            key="mini-plus-btn"
                            className="h-16 w-16 rounded-[24px] justify-center cursor-pointer bg-[#D97706] border-[#D97706] hover:bg-[#b45309]"
                            onClick={() => setIsNavExpanded(false)} // Click để quay lại State 1
                        >
                            <Plus className="text-white" size={28} />
                        </GlassContainer>
                    )}
                </AnimatePresence>

                {/* === PART 2: NAVIGATION AREA (Bên Phải) === */}
                <motion.div layout transition={{ type: "spring", stiffness: 400, damping: 30 }}>
                    {/* Case C: State 1 - Collapsed Nav (Arrow + Cart) */}
                    {isProductPage && !isNavExpanded ? (
                        <GlassContainer className="h-16 rounded-full pl-1 pr-1 gap-1">
                            <button
                                onClick={() => setIsNavExpanded(true)} // Click để mở rộng Nav (State 2)
                                className="w-10 h-14 flex items-center justify-center text-white/70 hover:text-white"
                            >
                                <ChevronLeft size={28} />
                            </button>

                            {/* Cart Icon nổi bật */}
                            <div className="h-14 w-14 bg-[#D97706] rounded-full flex items-center justify-center shadow-lg relative">
                                <ShoppingCart className="text-white" size={24} fill="currentColor" />
                                {quantity > 0 && (
                                    <span className="absolute -top-1 -right-1 bg-white text-[#D97706] text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-[#1e1e1e]">
                                        {quantity}
                                    </span>
                                )}
                            </div>
                        </GlassContainer>
                    ) : (
                        // Case D: State 2 & 3 - Full Nav
                        <GlassContainer className="h-16 rounded-full px-6 gap-8 min-w-[320px] justify-between">
                            <NavItem icon={<Home size={22} />} />
                            <NavItem icon={<LayoutGrid size={22} />} />

                            {/* Cart to ở giữa */}
                            <div className="relative -mt-8"> {/* Hack margin top để nó nổi lên */}
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    className="h-16 w-16 bg-[#D97706] rounded-full flex items-center justify-center shadow-[0_8px_16px_rgba(217,119,6,0.4)] border-[4px] border-[#121212]"
                                >
                                    <ShoppingCart className="text-white" size={28} fill="currentColor" />
                                </motion.div>
                            </div>

                            <NavItem icon={<Search size={22} />} />
                            <NavItem icon={<User size={22} />} />
                        </GlassContainer>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

// --- Component con: Nav Item ---
const NavItem = ({ icon }: { icon: React.ReactNode }) => (
    <div className="text-white/50 hover:text-white cursor-pointer transition-colors p-2">
        {icon}
    </div>
);