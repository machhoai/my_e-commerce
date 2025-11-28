// src/lib/mock_sizes.ts
import { Size } from "./schemas";

// --- 1. SIZE QUẦN ÁO (CLOTHING) ---
const CLOTHING_SIZES = [
    {
        name: "S",
        description: "Cao 1m50 - 1m60 | Nặng 45kg - 55kg",
        type: "CLOTHING",
        order: 1 // Hiển thị đầu tiên
    },
    {
        name: "M",
        description: "Cao 1m60 - 1m70 | Nặng 55kg - 65kg",
        type: "CLOTHING",
        order: 2
    },
    {
        name: "L",
        description: "Cao 1m70 - 1m75 | Nặng 65kg - 75kg",
        type: "CLOTHING",
        order: 3
    },
    {
        name: "XL",
        description: "Cao 1m75 - 1m80 | Nặng 75kg - 85kg",
        type: "CLOTHING",
        order: 4
    },
    {
        name: "XXL",
        description: "Cao trên 1m80 | Nặng trên 85kg",
        type: "CLOTHING",
        order: 5
    }
];

// --- 2. SIZE GIÀY DÉP (FOOTWEAR) ---
const FOOTWEAR_SIZES = [
    {
        name: "39",
        description: "Chiều dài bàn chân: 24.5cm",
        type: "FOOTWEAR",
        order: 1
    },
    {
        name: "40",
        description: "Chiều dài bàn chân: 25cm",
        type: "FOOTWEAR",
        order: 2
    },
    {
        name: "41",
        description: "Chiều dài bàn chân: 26cm",
        type: "FOOTWEAR",
        order: 3
    },
    {
        name: "42",
        description: "Chiều dài bàn chân: 26.5cm",
        type: "FOOTWEAR",
        order: 4
    },
    {
        name: "43",
        description: "Chiều dài bàn chân: 27.5cm",
        type: "FOOTWEAR",
        order: 5
    }
];

// --- 3. SIZE PHỤ KIỆN (ACCESSORY) ---
const ACCESSORY_SIZES = [
    {
        name: "Free Size",
        description: "Kích thước tiêu chuẩn, có thể điều chỉnh dây.",
        type: "ACCESSORY",
        order: 1
    }
];

// Gộp lại để export
export const MOCK_SIZES = [
    ...CLOTHING_SIZES,
    ...FOOTWEAR_SIZES,
    ...ACCESSORY_SIZES
];