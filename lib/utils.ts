import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export const formatPrice = (price: number | string) => {
    // Chuyển về number nếu đầu vào là string
    const amount = typeof price === 'string' ? parseFloat(price) : price;

    // 'vi-VN' tự động dùng dấu chấm phân cách hàng nghìn
    return new Intl.NumberFormat('vi-VN').format(amount);
};