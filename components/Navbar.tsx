"use client";
import { useState } from "react";
import GlassSurface from "./GlassSurface";
import { Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; // Import thư viện

export default function Navbar() {
    const [isProductPage, setIsProductPage] = useState(false);
    const [isAddToCartExpand, setIsAddToCarExpand] = useState(false);

    return (
        <div className="w-full gap-2 flex justify-end items-end">
            <AnimatePresence >
                {isProductPage && (
                    <motion.div
                        initial={{ width: 0, opacity: 1, visibility: "hidden" }}
                        animate={{ width: "auto", opacity: 1, visibility: "visible" }}
                        exit={{ width: 0, opacity: 1, visibility: "hidden" }}
                        transition={{
                            type: "tween",
                            ease: "easeInOut",
                            duration: 0.3 // 0.3 giây
                        }}
                        layout
                        className={`overflow-hidden ${isAddToCartExpand ? "flex-1" : "flex-shrink-0"}`} // overflow-hidden để không bị tràn nội dung lúc width=0
                    >
                        <AddToCartBox isAddToCartExpand={isAddToCartExpand} setIsAddToCartExpand={setIsAddToCarExpand} />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bọc Nav trong motion.div với prop layout */}
            <motion.div
                layout
                transition={{
                    type: "tween",
                    ease: "easeInOut",
                    duration: 0.3 // 0.3 giây
                }}
                className={`${isAddToCartExpand ? "" : "flex-1"} min-w-0`} // min-w-0 giúp flex item co lại đúng cách
            >
                <Nav setIsProductPage={setIsProductPage} isProductPage={isProductPage} isAddToCartExpand={isAddToCartExpand} />
            </motion.div>
        </div>
    )
}

interface NavProps {
    setIsProductPage: React.Dispatch<React.SetStateAction<boolean>>;
    isProductPage: boolean;
    isAddToCartExpand?: boolean;
}

const Nav: React.FC<NavProps> = ({ setIsProductPage, isProductPage, isAddToCartExpand }) => {
    return (
        <GlassSurface
            width={"100%"}
            className={`${isAddToCartExpand ? "!p-0" : "!p-3"} flex w-full justify-between !overflow-visible items-end  rounded-3xl`}
            backgroundOpacity={0.08}
            displace={5}
            saturation={0}
            borderWidth={0}
            blur={5}
        >
            {!isAddToCartExpand &&
                <div className="flex justify-between flex-1">
                    <div className="p-2 flex justify-center items-center">
                        <ion-icon name="home" class="text-[22px] text-primary aspect-square !visible"></ion-icon>
                    </div>
                    <div className="p-2 flex justify-center items-center">
                        <ion-icon name="apps-outline" class="text-[22px] text-[#727272] aspect-square !visible"></ion-icon>
                    </div>
                </div>
            }
            <div className="relative h-5 top-7 w-28"
                onClick={() => { setIsProductPage(!isProductPage) }}
            >
                <div className={`h-24 w-24 ${isAddToCartExpand ? "-right-5" : "left-1/2 -translate-x-1/2"} rounded-full flex justify-center items-center  absolute bottom-0 aspect-square bg-[#E27100]`}>
                    <ion-icon name="cart" class="text-[60px] text-[#fff] aspect-square !visible"></ion-icon>
                </div>
            </div>
            {!isAddToCartExpand &&
                <div className="flex justify-between flex-1">
                    <div className="p-2 flex justify-center items-center">
                        <ion-icon name="search-outline" class="text-[22px] text-[#727272] aspect-square !visible"></ion-icon>
                    </div>
                    <div className="p-2 flex justify-center items-center">
                        <ion-icon name="person-outline" class="text-[22px] text-[#727272] aspect-square !visible"></ion-icon>
                    </div>
                </div>
            }
        </GlassSurface>
    )
}

interface AddToCartBoxProps {
    setIsAddToCartExpand: React.Dispatch<React.SetStateAction<boolean>>;
    isAddToCartExpand?: boolean;
}

const AddToCartBox: React.FC<AddToCartBoxProps> = ({ isAddToCartExpand, setIsAddToCartExpand }) => {
    return (
        <GlassSurface
            // width={"fit-content"}
            backgroundOpacity={0.08}
            displace={5}
            saturation={0}
            borderWidth={0}
            blur={5}
            className={`!w-full p-2 aspect-square !shadow-none`}
        >
            <div className="flex-1 py-[10px] bg-primary text-white rounded-xl flex justify-center items-center"
                onClick={() => { setIsAddToCartExpand(!isAddToCartExpand) }}
            >
                <Plus className="size-[22px]" />
                {isAddToCartExpand && <p>Add to cart</p>}
            </div>
        </GlassSurface >
    )
}

