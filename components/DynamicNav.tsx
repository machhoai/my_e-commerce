"use client";

import React, { useState } from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
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

// --- Utility ---
function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// --- Cấu hình Animation chuẩn "Apple-style" ---
// Dùng spring nhẹ nhàng, ít nảy (low bounce) để tạo cảm giác đầm tay
const SPRING_TRANSITION = {
    type: "spring",
    bounce: 0.15,
    duration: 0.5,
};

// --- Component: Glass Wrapper ---
// Tách riêng để code gọn hơn
const GlassSurface = ({
    children,
    className,
    onClick,
    layoutId,
}: {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    layoutId?: string;
}) => (
    <motion.div
        layout
        layoutId={layoutId} // Giúp motion track đúng phần tử khi layout đổi
        onClick={onClick}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={SPRING_TRANSITION}
        className={cn(
            "bg-[#1e1e1e]/90 backdrop-blur-xl border border-white/10 shadow-2xl flex items-center overflow-hidden relative",
            className
        )}
    >
        {children}
    </motion.div>
);

export default function DynamicNavV2() {
    const [isProductPage, setIsProductPage] = useState(true);
    const [isNavExpanded, setIsNavExpanded] = useState(false);
    const [quantity, setQuantity] = useState(1);

    return (
        <div className="min-h-[300px] w-full bg-[#121212] flex flex-col justify-center items-center gap-8 p-4">
            {/* --- Debug Controls --- */}
            <div className="fixed top-5 left-5 text-white bg-gray-800 p-4 rounded-lg text-xs space-y-2 z-50">
                <p className="font-bold text-gray-400 uppercase mb-2">Controls</p>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={isProductPage}
                        onChange={(e) => {
                            setIsProductPage(e.target.checked);
                            setIsNavExpanded(false);
                        }}
                    />
                    Is Product Page
                </label>
            </div>

            {/* --- UI CHÍNH --- */}
            {/* LayoutGroup giúp đồng bộ chuyển động của tất cả các con bên trong */}
            <LayoutGroup>
                <div className="flex items-center h-20 w-full justify-center">

                    {/* === LEFT SIDE (Action Panel) === */}
                    <AnimatePresence mode="popLayout">
                        {isProductPage && !isNavExpanded && (
                            <motion.div
                                key="action-panel"
                                layout
                                initial={{ width: 0, opacity: 0, marginRight: 0 }}
                                animate={{ width: "auto", opacity: 1, marginRight: 12 }} // Margin thay cho gap
                                exit={{ width: 0, opacity: 0, marginRight: 0 }}
                                transition={SPRING_TRANSITION}
                                className="overflow-hidden flex-shrink-0" // Quan trọng: che nội dung thừa
                            >
                                {/* Wrapper cố định width để nội dung không bị méo khi cha co lại */}
                                <div className="w-max">
                                    <GlassSurface className="h-16 rounded-full px-2 gap-4">
                                        {/* Counter */}
                                        <div className="flex items-center gap-3 px-2">
                                            <CircleBtn onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                                                <Minus size={16} />
                                            </CircleBtn>
                                            <span className="text-white font-medium w-4 text-center select-none">
                                                {quantity}
                                            </span>
                                            <CircleBtn onClick={() => setQuantity(quantity + 1)}>
                                                <Plus size={16} />
                                            </CircleBtn>
                                        </div>

                                        {/* Add Button */}
                                        <motion.button
                                            whileTap={{ scale: 0.95 }}
                                            className="bg-[#D97706] hover:bg-[#b45309] text-white px-6 py-3 rounded-full font-medium flex items-center gap-2 transition-colors whitespace-nowrap"
                                        >
                                            <Plus size={18} />
                                            <span>Add to cart</span>
                                        </motion.button>
                                    </GlassSurface>
                                </div>
                            </motion.div>
                        )}

                        {isProductPage && isNavExpanded && (
                            <motion.div
                                key="mini-plus"
                                layout
                                initial={{ width: 0, opacity: 0, marginRight: 0, scale: 0.8 }}
                                animate={{ width: "auto", opacity: 1, marginRight: 12, scale: 1 }}
                                exit={{ width: 0, opacity: 0, marginRight: 0, scale: 0.8 }}
                                transition={SPRING_TRANSITION}
                                className="overflow-hidden flex-shrink-0"
                            >
                                <GlassSurface
                                    className="h-16 w-16 rounded-[24px] justify-center cursor-pointer bg-[#D97706] border-[#D97706] hover:bg-[#b45309]"
                                    onClick={() => setIsNavExpanded(false)}
                                >
                                    <Plus className="text-white" size={28} />
                                </GlassSurface>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* === RIGHT SIDE (Navigation) === */}
                    <motion.div
                        layout // Tự động trượt khi thằng bên trái biến mất
                        transition={SPRING_TRANSITION}
                        className="flex-shrink-0 relative z-10" // z-10 để nó nổi lên trên nếu có overlap
                    >
                        {isProductPage && !isNavExpanded ? (
                            // State 1: Collapsed Nav
                            <GlassSurface
                                key="nav-collapsed"
                                layoutId="nav-container" // layoutId giúp morphing giữa 2 trạng thái nav mượt hơn
                                className="h-16 rounded-full pl-1 pr-1 gap-1"
                            >
                                <button
                                    onClick={() => setIsNavExpanded(true)}
                                    className="w-10 h-14 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                                >
                                    <ChevronLeft size={28} />
                                </button>

                                <div className="h-14 w-14 bg-[#D97706] rounded-full flex items-center justify-center shadow-lg relative">
                                    <ShoppingCart className="text-white" size={24} fill="currentColor" />
                                    {quantity > 0 && (
                                        <motion.span
                                            initial={{ scale: 0 }} animate={{ scale: 1 }}
                                            className="absolute -top-1 -right-1 bg-white text-[#D97706] text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full border-2 border-[#1e1e1e]"
                                        >
                                            {quantity}
                                        </motion.span>
                                    )}
                                </div>
                            </GlassSurface>
                        ) : (
                            // State 2 & 3: Full Nav
                            <GlassSurface
                                key="nav-full"
                                layoutId="nav-container"
                                className="h-16 rounded-full px-6 gap-8 min-w-[320px] justify-between"
                            >
                                <NavItem icon={<Home size={22} />} />
                                <NavItem icon={<LayoutGrid size={22} />} />

                                {/* Cart Icon to (Floating) */}
                                <div className="relative -mt-8">
                                    <motion.div
                                        layoutId="cart-bubble" // Kết nối với cart nhỏ ở trên nếu muốn animation phức tạp hơn, nhưng ở đây scale là đủ
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={{ ...SPRING_TRANSITION, delay: 0.1 }}
                                        className="h-16 w-16 bg-[#D97706] rounded-full flex items-center justify-center shadow-[0_8px_16px_rgba(217,119,6,0.4)] border-[4px] border-[#121212]"
                                    >
                                        <ShoppingCart className="text-white" size={28} fill="currentColor" />
                                    </motion.div>
                                </div>

                                <NavItem icon={<Search size={22} />} />
                                <NavItem icon={<User size={22} />} />
                            </GlassSurface>
                        )}
                    </motion.div>

                </div>
            </LayoutGroup>
        </div>
    );
}

// --- Sub Components ---
const CircleBtn = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
    >
        {children}
    </motion.button>
);

const NavItem = ({ icon }: { icon: React.ReactNode }) => (
    <div className="text-white/50 hover:text-white cursor-pointer transition-colors p-2">
        {icon}
    </div>
);