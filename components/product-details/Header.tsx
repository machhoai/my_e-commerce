"use client"
import { ChevronLeft, Home, Search, Share2, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";

export default function Header() {
    const router = useRouter();
    return (
        <div className="flex justify-between items-center sticky top-0 bg-white z-10 p-3">
            <div
                onClick={() => router.back()}
            >
                <ChevronLeft strokeWidth={1} size={30} />
            </div>
            <div className="flex gap-2">
                <div className="p-1">
                    <Search strokeWidth={1} size={22} />
                </div>
                <div className="p-1">
                    <Share2 strokeWidth={1} size={22} />
                </div>
                <div className="p-1">
                    <ShoppingCart strokeWidth={1} size={22} />
                </div>
                <div className="p-1">
                    <Home strokeWidth={1} size={22} />
                </div>
            </div>
        </div>
    );
}