"use client";
import { useState } from "react";
import GlassSurface from "./GlassSurface";
import { ChevronLeft, Clipboard, Headset, House, LayoutGrid, Minus, Plus, User2, } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; // Import thư viện

const springTransition = {
    type: "spring",
    stiffness: 400,
    damping: 30,
};

export default function Navbar() {

    return (
        <div className="flex text-xs text-[#727272] bg-white border-t p-2 pb-4" >
            <div className="flex flex-col flex-1 justify-center items-center">
                <span>
                    <House strokeWidth={1.5} />
                </span>
                <p>Trang chủ</p>
            </div>
            <div className="flex flex-col flex-1 justify-center items-center">
                <span>
                    <LayoutGrid strokeWidth={1.5} />
                </span>
                <p>Danh mục</p>
            </div>
            <div className="flex flex-col flex-1 justify-end items-center">
                <span className="size-12 p-2 text-white bg-primary absolute -top-6 rounded-full">
                    <ion-icon name="headset" className="size-full" />
                </span>
                <p>Tư vấn</p>
            </div>
            <div className="flex flex-col flex-1 justify-center items-center">
                <span>
                    <Clipboard strokeWidth={1.5} />
                </span>
                <p>Đơn hàng</p>
            </div>
            <div className="flex flex-col flex-1 justify-center items-center">
                <span>
                    <User2 strokeWidth={1.5} />
                </span>
                <p>Tài khoản</p>
            </div>
        </div>
    )
}

interface NavProps {
    setIsProductPage: React.Dispatch<React.SetStateAction<boolean>>;
    isProductPage: boolean;
    isAddToCartExpand?: boolean;
    setIsAddToCartExpand: React.Dispatch<React.SetStateAction<boolean>>;
}

const Nav: React.FC<NavProps> = ({ setIsProductPage, isProductPage, isAddToCartExpand, setIsAddToCartExpand }) => {
    return (
        <GlassSurface
            width={"100%"}
            className={`${isAddToCartExpand ? "!p-0" : "!p-3"} flex w-full justify-between relative !overflow-visible items-end  rounded-3xl`}
            backgroundOpacity={0.08}
            displace={5}
            saturation={0}
            borderWidth={0}
            blur={5}
        >
            {/* GROUP ICON TRÁI */}
            <AnimatePresence>
                {!isAddToCartExpand && (
                    <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={springTransition}
                        className="flex justify-between flex-1 overflow-hidden whitespace-nowrap"
                    >
                        <div className="p-2 flex justify-center items-center">
                            {/* @ts-ignore */}
                            <ion-icon name="home" class="text-[22px] text-primary aspect-square md hydrated"></ion-icon>
                        </div>
                        <div className="p-2 flex justify-center items-center">
                            {/* @ts-ignore */}
                            <ion-icon name="apps-outline" class="text-[22px] text-[#727272] aspect-square md hydrated"></ion-icon>
                        </div>
                    </motion.div>
                )}

                {isAddToCartExpand && (
                    <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={springTransition}
                        className="flex justify-between overflow-hidden absolute whitespace-nowrap left-0"
                        onClick={() => setIsAddToCartExpand(!isAddToCartExpand)}
                    >
                        <div className="p-2 flex justify-center items-center">
                            <ChevronLeft className="size-6" />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
            <div className="relative h-5 top-7 w-28 flex-grow-0"
                onClick={() => { setIsProductPage(!isProductPage) }}
            >
                <motion.div
                    layout
                    transition={springTransition}
                    // Xóa -translate-x-1/2 đi và dùng kỹ thuật margin auto để căn giữa
                    className={`h-24 w-24 rounded-full flex justify-center items-center absolute bottom-0 aspect-square bg-[#E27100] shadow-xl
        ${isAddToCartExpand
                            ? "-right-5 left-auto mx-0"  // Khi mở rộng: Nằm bên phải, reset margin
                            : "left-0 right-0 mx-auto"   // Khi thu nhỏ: Căn giữa bằng margin auto (thay vì translate)
                        }
    `}
                >
                    {/* @ts-ignore */}
                    <ion-icon name="cart" class="text-[60px] text-[#fff] aspect-square md hydrated"></ion-icon>
                </motion.div>
            </div>
            <AnimatePresence>
                {!isAddToCartExpand && (
                    <motion.div
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: "auto" }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={springTransition}
                        className="flex justify-between flex-1 overflow-hidden whitespace-nowrap"
                    >
                        <div className="p-2 flex justify-center items-center">
                            {/* @ts-ignore */}
                            <ion-icon name="search-outline" class="text-[22px] text-[#727272] aspect-square md hydrated"></ion-icon>
                        </div>
                        <div className="p-2 flex justify-center items-center">
                            {/* @ts-ignore */}
                            <ion-icon name="person-outline" class="text-[22px] text-[#727272] aspect-square md hydrated"></ion-icon>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </GlassSurface>
    )
}

interface AddToCartBoxProps {
    setIsAddToCartExpand: React.Dispatch<React.SetStateAction<boolean>>;
    isAddToCartExpand?: boolean;
}

const AddToCartBox: React.FC<AddToCartBoxProps> = ({ isAddToCartExpand, setIsAddToCartExpand }) => {
    const [quantity, setQuantity] = useState(1);

    return (
        <GlassSurface
            // width={"fit-content"}
            backgroundOpacity={0.08}
            displace={5}
            saturation={0}
            borderWidth={0}
            blur={5}
            className={`!w-full p-2 aspect-square overflow-visible !shadow-none`}
        >
            <motion.div
                layout
                transition={springTransition}
                className={`w-full h-full flex overflow-hidden gap-2`}
            >
                {
                    isAddToCartExpand && (
                        <div className="flex items-center gap-2 !text-[#727272]">
                            <CircleBtn onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                                <Minus size={16} />
                            </CircleBtn>
                            <span className="font-medium w-4 text-center select-none">
                                {quantity}
                            </span>
                            <CircleBtn onClick={() => setQuantity(quantity + 1)}>
                                <Plus size={16} />
                            </CircleBtn>
                        </div>
                    )
                }
                <span
                    className="w-full h-full flex justify-center bg-primary text-white rounded-xl cursor-pointer"
                    onClick={() => { setIsAddToCartExpand(!isAddToCartExpand) }}
                >
                    <motion.div layout className="flex items-center justify-center">
                        <Plus className="size-[22px]" />
                    </motion.div>

                    <AnimatePresence mode="wait">
                        {isAddToCartExpand && (
                            <motion.div
                                initial={{ width: 0, opacity: 0, marginLeft: 0 }}
                                animate={{ width: "auto", opacity: 1, marginLeft: 8 }}
                                exit={{ width: 0, opacity: 0, marginLeft: 0 }}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                className="overflow-visible h-full flex items-center" // Che phần chữ chưa hiện ra
                            >
                                <motion.p
                                    layout="position"
                                    className="whitespace-nowrap font-medium w-max"
                                >
                                    Add item
                                </motion.p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </span>
            </motion.div>
        </GlassSurface >
    )
}

const CircleBtn = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
    <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={onClick}
        className="w-8 h-8 rounded-full bg-[#727272]/20 flex items-center justify-center hover:bg-white/20 transition-colors"
    >
        {children}
    </motion.button>
);

