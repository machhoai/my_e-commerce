// file: model_schema.js
import { z } from "zod";

// --- 1. SCHEMA SẢN PHẨM (PRODUCT) ---
export const ProductSchema = z.object({
    name: z.string().min(1, "Tên sản phẩm không được để trống"),
    description: z.string().optional(),
    is_active: z.boolean().default(true),

    // Ví dụ: ["ao-the-thao", "bong-da", "thoi-trang-nam"]
    category_ids: z.array(z.string()).min(1, "Sản phẩm phải thuộc ít nhất 1 danh mục"),

    // Lưu luôn tên danh mục để hiển thị UI cho nhanh (Denormalization)
    // Ví dụ: ["Áo Thể Thao", "Bóng Đá", "Thời Trang Nam"]
    category_names: z.array(z.string()).optional(),
    // ----------------------

    brand: z.string().optional(),
    base_price: z.number().min(0, "Giá không được âm"),
    images: z.array(z.string().url()).optional(),

    variants: z.array(z.object({
        sku: z.string(),
        size: z.string(),
        color: z.string(),
        stock_quantity: z.number().int().min(0),
        price_modifier: z.number().default(0),
        variant_image: z.string().url().optional()
    })),

    created_at: z.date().default(() => new Date()),
    slug: z.string()
});

// --- 2. SCHEMA USER (NGƯỜI DÙNG) ---
export const UserSchema = z.object({
    email: z.string().email("Email không hợp lệ"),
    full_name: z.string(),
    avatar_url: z.string().url().optional(),
    role: z.enum(["customer", "admin"]).default("customer"), // Chỉ cho phép 2 quyền này

    shipping_address: z.object({
        address: z.string().optional(),
        city: z.string().optional(),
        ward: z.string().optional(),
        phone: z.string().regex(/^[0-9]{10,11}$/, "Số điện thoại sai định dạng").optional()
    }).optional(),

    is_email_verified: z.boolean().default(false),
    cart_id: z.string().optional(), // ID giỏ hàng hiện tại
    created_at: z.date().default(() => new Date())
});

// --- 3. SCHEMA ĐƠN HÀNG (ORDER) ---
export const OrderSchema = z.object({
    order_number: z.string(), // Mã đơn tự sinh (VD: ORD-2023...)
    user_id: z.string(),
    status: z.enum(["Pending", "Processing", "Shipped", "Delivered", "Canceled"]).default("Pending"),

    // Snapshot thông tin người nhận lúc đặt
    shipping_info: z.object({
        full_name: z.string(),
        phone: z.string(),
        address: z.string(),
        city: z.string(),
        ward: z.string()
    }),

    // Snapshot sản phẩm
    items: z.array(z.object({
        product_id: z.string(),
        variant_sku: z.string(),
        quantity: z.number().min(1),
        snapshot_name: z.string(), // Lưu tên lúc mua đề phòng đổi tên
        snapshot_price: z.number() // Lưu giá lúc mua
    })),

    payment_info: z.object({
        method: z.enum(["COD", "VNPAY", "MOMO"]),
        transaction_id: z.string().optional(),
        status: z.enum(["Paid", "Pending", "Failed"]).default("Pending")
    }),

    total_amount: z.number(),
    created_at: z.date().default(() => new Date())
});

// --- 4. SCHEMA GIỎ HÀNG (CART) ---
export const CartSchema = z.object({
    user_id: z.string().nullable().optional(), // Null nếu là khách vãng lai
    session_id: z.string().nullable().optional(), // Dùng cho khách chưa đăng nhập

    items: z.array(z.object({
        product_id: z.string(),
        variant_sku: z.string(),
        quantity: z.number().int().min(1),
        snapshot_price: z.number().min(0), // Giá tại thời điểm thêm vào giỏ
        name: z.string(), // Tên sản phẩm để hiển thị nhanh
        variant_image: z.string().optional() // Ảnh variant nếu có
    })),

    total_price: z.number().min(0).default(0),
    total_items: z.number().int().min(0).default(0),
    updated_at: z.date().default(() => new Date()),
    expires_at: z.date().optional() // Dùng để xóa giỏ hàng rác sau X ngày
});

// --- 5. SCHEMA KHUYẾN MÃI (VOUCHER) ---
export const VoucherSchema = z.object({
    code: z.string().min(3, "Mã voucher quá ngắn").toUpperCase(), // Tự động in hoa
    description: z.string().optional(),
    is_active: z.boolean().default(true),

    // Cấu hình giảm giá
    discount_type: z.enum(["PERCENT", "FIXED"]), // Giảm theo % hoặc số tiền cố định
    discount_value: z.number().min(0), // Giá trị (VD: 10 (10%) hoặc 50000 (50k))
    max_discount_amount: z.number().optional(), // Mức giảm tối đa (chỉ dùng cho PERCENT)
    min_order_value: z.number().default(0), // Đơn hàng tối thiểu để áp dụng

    // Điều kiện áp dụng
    applicable_categories: z.array(z.string()).optional(), // List ID danh mục được áp dụng
    applicable_payment_methods: z.array(z.enum(["COD", "VNPAY", "MOMO"])).optional(),

    // Giới hạn sử dụng
    usage_limit_total: z.number().int().optional(), // Tổng số lần dùng toàn hệ thống
    current_usage_count: z.number().int().default(0), // Đã dùng bao nhiêu lần
    max_usage_per_user: z.number().int().default(1), // Mỗi người được dùng mấy lần

    start_date: z.date(),
    end_date: z.date(),
    created_by: z.string(), // Admin ID
    created_at: z.date().default(() => new Date())
}).refine((data) => data.end_date > data.start_date, {
    message: "Ngày kết thúc phải sau ngày bắt đầu",
    path: ["end_date"]
});

// --- 6. SCHEMA DANH MỤC (CATEGORY) ---
export const CategorySchema = z.object({
    name: z.string().min(1, "Tên danh mục không được trống"),
    description: z.string().optional(),
    image_url: z.string().url().optional(),
    slug: z.string(),
    is_active: z.boolean().default(true),

    // --- BỔ SUNG TRƯỜNG GROUP ---
    // Phân nhóm để Frontend dễ render Menu
    group: z.enum(["PRODUCT_TYPE", "SPORT", "GENDER", "COLLECTION"]),
    // - PRODUCT_TYPE: Áo, Quần, Giày...
    // - SPORT: Bóng đá, Chạy bộ...
    // - GENDER: Nam, Nữ...
    // - COLLECTION: Mùa hè, Olympic...

    // Số thứ tự hiển thị trong nhóm đó (Ví dụ: Áo lên trước Quần)
    order: z.number().int().default(0)
});

// --- 7. SCHEMA KÍCH THƯỚC (SIZE) ---
// Thường dùng để quản lý danh sách Size chuẩn cho Admin chọn nhanh
export const SizeSchema = z.object({
    name: z.string().min(1), // S, M, L, XL, 39, 40...
    description: z.string().optional(), // "Small", "Medium"
    type: z.enum(["CLOTHING", "FOOTWEAR", "ACCESSORY"]).default("CLOTHING"), // Phân loại size
    order: z.number().int().default(0) // Dùng để sắp xếp thứ tự hiển thị (S < M < L)
});

// --- EXPORT TYPES ---
// Tự động tạo Type TypeScript từ Schema
export type Cart = z.infer<typeof CartSchema>;
export type Voucher = z.infer<typeof VoucherSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Size = z.infer<typeof SizeSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type User = z.infer<typeof UserSchema>;
export type Order = z.infer<typeof OrderSchema>;