export interface FlashSale {
    isActive: boolean;
    startTime: string; // ISO date
    endTime: string;   // ISO date
    salePrice: number;
}

// 2. Cấu trúc Khuyến mãi
export interface Promotion {
    title: string; // Ví dụ: "Giảm 50k"
    type: 'DISCOUNT_PERCENT' | 'DISCOUNT_AMOUNT' | 'GIFT';
    value: number; // 50 hoặc 50000
}

export interface ProductSpecs {
    Category: string;
    Generic: string;      // Tên gốc/Hoạt chất
    Manufacturer: string; // Nhà sản xuất
    Uses: string;         // Công dụng
    Specifications: string; // Quy cách đóng gói
    Note?: string;        // Lưu ý
}

export interface Classification {
    groupName: string; // VD: "Màu sắc"
    options: {
        id: string;
        label: string; // VD: "Xanh", "Đỏ"
        priceModifier?: number; // Giá thay đổi theo option (nếu có)
    }[];
}

export interface Product {
    _id: string;
    Slug: string;
    Name: string;
    Brand: string;
    Price: number; // Giá gốc
    Category: string;
    Images: string[];

    FlashSale?: FlashSale;
    Promotion?: Promotion;

    classification?: Classification[]; // Mảng các phân loại

    Description: ProductSpecs; // Object thông số kỹ thuật
    Describe: string;          // HTML string hoặc Markdown mô tả dài
}