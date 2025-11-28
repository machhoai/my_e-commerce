// src/lib/mock_categories.ts
import { Category } from "./schemas";

// 1. Nhóm Loại Sản Phẩm (PRODUCT_TYPE)
const TYPE_CATS = [
    { name: "Áo Thể Thao", slug: "ao-the-thao", group: "PRODUCT_TYPE", order: 1 },
    { name: "Quần Thể Thao", slug: "quan-the-thao", group: "PRODUCT_TYPE", order: 2 },
    { name: "Giày Thể Thao", slug: "giay-the-thao", group: "PRODUCT_TYPE", order: 3 },
    { name: "Phụ Kiện", slug: "phu-kien", group: "PRODUCT_TYPE", order: 4 },
];

// 2. Nhóm Môn Thể Thao (SPORT)
const SPORT_CATS = [
    { name: "Bóng Đá", slug: "bong-da", group: "SPORT", order: 1 },
    { name: "Chạy Bộ", slug: "chay-bo", group: "SPORT", order: 2 },
    { name: "Bơi Lội", slug: "boi-loi", group: "SPORT", order: 3 },
    { name: "Gym & Yoga", slug: "gym-yoga", group: "SPORT", order: 4 },
];

// 3. Nhóm Giới Tính (GENDER)
const GENDER_CATS = [
    { name: "Nam", slug: "thoi-trang-nam", group: "GENDER", order: 1 },
    { name: "Nữ", slug: "thoi-trang-nu", group: "GENDER", order: 2 },
    { name: "Unisex", slug: "unisex", group: "GENDER", order: 3 },
];

// 4. Nhóm Bộ Sưu Tập (COLLECTION)
const COLLECTION_CATS = [
    { name: "Summer Vibes 2025", slug: "bst-summer-2025", group: "COLLECTION", order: 1 },
    { name: "Winter Warmth", slug: "bst-winter", group: "COLLECTION", order: 2 },
    { name: "Welcome Olympic", slug: "bst-olympic", group: "COLLECTION", order: 3 },
    { name: "Run To Heal", slug: "bst-run-to-heal", group: "COLLECTION", order: 4 },
];

// Hàm helper để gán các giá trị mặc định (image_url, description...) đỡ phải viết lặp lại
const addDefaults = (cats: any[]) => cats.map(c => ({
    ...c,
    description: `Danh mục ${c.name}`,
    image_url: `https://via.placeholder.com/150?text=${c.slug}`, // Ảnh dummy
    is_active: true
}));

export const MOCK_ALL_CATEGORIES = [
    ...addDefaults(TYPE_CATS),
    ...addDefaults(SPORT_CATS),
    ...addDefaults(GENDER_CATS),
    ...addDefaults(COLLECTION_CATS)
];