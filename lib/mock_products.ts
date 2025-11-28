// Định nghĩa các nhóm size chuẩn theo data của bạn
const SIZE_CONFIG = {
    CLOTHING: ["S", "M", "L", "XL", "XXL"],
    FOOTWEAR: ["39", "40", "41", "42", "43"],
    ACCESSORY: ["Free Size"],
};

// Hàm nhỏ giúp sinh variants nhanh gọn (không cần copy thủ công)
const generateVariants = (skuBase: string, colors: string[], type: "CLOTHING" | "FOOTWEAR" | "ACCESSORY", price: number, img?: string) => {
    return colors.flatMap(color =>
        SIZE_CONFIG[type].map(size => ({
            sku: `${skuBase}-${color.toUpperCase()}-${size}`.replace(/\s+/g, ""),
            size: size,
            color: color,
            stock_quantity: Math.floor(Math.random() * 51), // Random 0 - 50
            price_modifier: 0,
            variant_image: img ? img : `https://via.placeholder.com/150?text=${skuBase}-${color}`
        }))
    );
};

// (Giữ nguyên các biến SIZE_CONFIG và hàm generateVariants như ở phần trước)
// Nếu bạn copy vào file mới thì nhớ khai báo lại nhé.

export const more_products = [
    // 11. Giày Đá Bóng Sân Futsal (Footwear)
    {
        name: "Giày Bóng Đá Trong Nhà Futsal Master",
        description: "Đế bằng cao su IC bám sàn gỗ/nhựa cực tốt, mũi giày khâu chắc chắn.",
        is_active: true,
        category_ids: ["giay-the-thao", "bong-da", "thoi-trang-nam"],
        category_names: ["Giày Thể Thao", "Bóng Đá", "Nam"],
        brand: "Striker",
        base_price: 480000,
        // Ảnh giày Futsal trong nhà
        images: ["https://images.unsplash.com/photo-1575361204480-aadea25d46f3?w=500&q=80"],
        slug: "giay-bong-da-trong-nha-futsal-master",
        created_at: new Date(),
        variants: generateVariants("G-FUTSAL", ["Cam", "XanhDen"], "FOOTWEAR", 480000, "https://images.unsplash.com/photo-1575361204480-aadea25d46f3?w=500&q=80"),
    },

    // 12. Thảm Tập Yoga TPE (Accessory)
    {
        name: "Thảm Tập Yoga TPE Chống Trượt",
        description: "Thảm dày 6mm, độ đàn hồi cao, kèm túi đựng tiện lợi.",
        is_active: true,
        category_ids: ["phu-kien", "gym-yoga", "thoi-trang-nu"],
        category_names: ["Phụ Kiện", "Gym & Yoga", "Nữ"],
        brand: "YogiFit",
        base_price: 250000,
        // Ảnh thảm Yoga
        images: ["https://images.unsplash.com/photo-1593164842264-85460449a651?w=500&q=80"],
        slug: "tham-tap-yoga-tpe-chong-truot",
        created_at: new Date(),
        variants: generateVariants("THAM-YOGA", ["Tim", "XanhNgoc"], "ACCESSORY", 250000, "https://images.unsplash.com/photo-1593164842264-85460449a651?w=500&q=80"),
    },

    // 13. Áo Hoodie Chạy Bộ Mùa Đông (Clothing)
    {
        name: "Áo Hoodie Chạy Bộ Winter Runner",
        description: "Chất liệu nỉ da cá giữ nhiệt, có mũ trùm đầu và túi kangaroo.",
        is_active: true,
        category_ids: ["ao-the-thao", "chay-bo", "bst-winter", "unisex"],
        category_names: ["Áo Thể Thao", "Chạy Bộ", "Winter Warmth", "Unisex"],
        brand: "WinterWear",
        base_price: 600000,
        // Ảnh Hoodie thể thao
        images: ["https://images.unsplash.com/photo-1556906781-9a412961d289?w=500&q=80"],
        slug: "ao-hoodie-chay-bo-winter-runner",
        created_at: new Date(),
        variants: generateVariants("HOODIE-WN", ["Xam", "Den"], "CLOTHING", 600000, "https://images.unsplash.com/photo-1556906781-9a412961d289?w=500&q=80"),
    },

    // 14. Quần Bơi Nam Boxer (Clothing)
    {
        name: "Quần Bơi Nam Boxer Pro Swim",
        description: "Dáng boxer nam tính, vải chống thấm nước, mau khô.",
        is_active: true,
        category_ids: ["quan-the-thao", "boi-loi", "thoi-trang-nam"],
        category_names: ["Quần Thể Thao", "Bơi Lội", "Nam"],
        brand: "AquaPro",
        base_price: 150000,
        // Ảnh quần bơi nam
        images: ["https://images.unsplash.com/photo-1563296291-14f2663965ee?w=500&q=80"],
        slug: "quan-boi-nam-boxer-pro-swim",
        created_at: new Date(),
        variants: generateVariants("QB-NAM", ["Den", "Xanh"], "CLOTHING", 150000, "https://images.unsplash.com/photo-1563296291-14f2663965ee?w=500&q=80"),
    },

    // 15. Áo Bra Thể Thao Nữ (Clothing)
    {
        name: "Áo Sports Bra Nâng Ngực High Support",
        description: "Hỗ trợ tối đa cho các bài tập cường độ cao, dây lưng đan chéo thời trang.",
        is_active: true,
        category_ids: ["ao-the-thao", "gym-yoga", "thoi-trang-nu"],
        category_names: ["Áo Thể Thao", "Gym & Yoga", "Nữ"],
        brand: "GymSharkFake",
        base_price: 280000,
        // Ảnh Sports Bra
        images: ["https://images.unsplash.com/photo-1620799140408-ed5341cd2431?w=500&q=80"],
        slug: "ao-sports-bra-nang-nguc",
        created_at: new Date(),
        variants: generateVariants("BRA-HI", ["Den", "HongPhan"], "CLOTHING", 280000, "https://images.unsplash.com/photo-1620799140408-ed5341cd2431?w=500&q=80"),
    },

    // 16. Băng Đô Thể Thao (Accessory)
    {
        name: "Băng Đô Headband Run To Heal",
        description: "Thấm hút mồ hôi trán, ngăn mồ hôi rơi vào mắt khi chạy bộ.",
        is_active: true,
        category_ids: ["phu-kien", "chay-bo", "bst-run-to-heal", "unisex"],
        category_names: ["Phụ Kiện", "Chạy Bộ", "Run To Heal", "Unisex"],
        brand: "RunLife",
        base_price: 50000,
        // Ảnh băng đô
        images: ["https://images.unsplash.com/photo-1522845015757-50bce044e5da?w=500&q=80"],
        slug: "bang-do-headband-run-to-heal",
        created_at: new Date(),
        variants: generateVariants("HEADBAND", ["Trang", "Do"], "ACCESSORY", 50000, "https://images.unsplash.com/photo-1522845015757-50bce044e5da?w=500&q=80"),
    },

    // 17. Quần Jogger Nỉ (Clothing)
    {
        name: "Quần Jogger Nỉ Ống Túm",
        description: "Phong cách Athleisure, vừa đi tập vừa đi chơi được.",
        is_active: true,
        category_ids: ["quan-the-thao", "thoi-trang-nam", "bst-winter"],
        category_names: ["Quần Thể Thao", "Nam", "Winter Warmth"],
        brand: "VietSports",
        base_price: 320000,
        // Ảnh quần Jogger
        images: ["https://images.unsplash.com/photo-1552346154-21d32810aba3?w=500&q=80"],
        slug: "quan-jogger-ni-ong-tum",
        created_at: new Date(),
        variants: generateVariants("JOGGER", ["XamTieu", "Den"], "CLOTHING", 320000, "https://images.unsplash.com/photo-1552346154-21d32810aba3?w=500&q=80"),
    },

    // 18. Áo Thun Cổ Tròn Olympic (Clothing)
    {
        name: "Áo Thun Cổ Tròn Olympic Spirit",
        description: "Áo thun cotton 100% in logo Olympic cách điệu.",
        is_active: true,
        category_ids: ["ao-the-thao", "bst-olympic", "unisex"],
        category_names: ["Áo Thể Thao", "Welcome Olympic", "Unisex"],
        brand: "VietSocks",
        base_price: 199000,
        // Ảnh áo thun trắng thể thao
        images: ["https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=500&q=80"],
        slug: "ao-thun-co-tron-olympic-spirit",
        created_at: new Date(),
        variants: generateVariants("TS-OLY", ["Trang", "Vang"], "CLOTHING", 199000, "https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=500&q=80"),
    },

    // 19. Giày Trail Running (Footwear)
    {
        name: "Giày Chạy Địa Hình Trail Explorer",
        description: "Gai đế lớn bám đất bùn, mũi giày bọc thép bảo vệ ngón chân.",
        is_active: true,
        category_ids: ["giay-the-thao", "chay-bo", "bst-summer-2025", "thoi-trang-nam"],
        category_names: ["Giày Thể Thao", "Chạy Bộ", "Summer Vibes 2025", "Nam"],
        brand: "RunLife",
        base_price: 1450000,
        // Ảnh giày Trail (địa hình)
        images: ["https://images.unsplash.com/photo-1539185441755-769473a23570?w=500&q=80"],
        slug: "giay-chay-dia-hinh-trail-explorer",
        created_at: new Date(),
        variants: generateVariants("TRAIL-EX", ["XanhLa", "Nau"], "FOOTWEAR", 1450000, "https://images.unsplash.com/photo-1539185441755-769473a23570?w=500&q=80"),
    },

    // 20. Túi Trống Thể Thao (Accessory)
    {
        name: "Túi Trống Gym Duffle Bag",
        description: "Ngăn chứa rộng rãi, có ngăn riêng đựng giày bẩn.",
        is_active: true,
        category_ids: ["phu-kien", "gym-yoga", "bong-da", "unisex"],
        category_names: ["Phụ Kiện", "Gym & Yoga", "Bóng Đá", "Unisex"],
        brand: "VietSports",
        base_price: 300000,
        // Ảnh túi trống
        images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80"],
        slug: "tui-trong-gym-duffle-bag",
        created_at: new Date(),
        variants: generateVariants("BAG-DUFF", ["Den"], "ACCESSORY", 300000, "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500&q=80"),
    }
];

export const products = [
    {
        name: "Áo Bóng Đá Nam Pro Match 2025",
        description: "Áo đấu thiết kế thoáng khí, thấm hút mồ hôi tốt dành cho thi đấu chuyên nghiệp.",
        is_active: true,
        category_ids: ["ao-the-thao", "bong-da", "thoi-trang-nam"],
        category_names: ["Áo Thể Thao", "Bóng Đá", "Nam"],
        brand: "VietSports",
        base_price: 250000,
        images: ["https://via.placeholder.com/500?text=ao-bong-da-1"],
        slug: "ao-bong-da-nam-pro-match-2025",
        created_at: new Date(),
        variants: generateVariants("ABD25", ["Do", "Xanh"], "CLOTHING", 250000),
    },
    {
        name: "Giày Chạy Bộ Speed Demon Run To Heal",
        description: "Nằm trong bộ sưu tập Run To Heal, đế giày êm ái hỗ trợ tối đa cho bàn chân.",
        is_active: true,
        category_ids: ["giay-the-thao", "chay-bo", "bst-run-to-heal", "unisex"],
        category_names: ["Giày Thể Thao", "Chạy Bộ", "Run To Heal", "Unisex"],
        brand: "RunLife",
        base_price: 1200000,
        images: ["https://via.placeholder.com/500?text=giay-chay-bo"],
        slug: "giay-chay-bo-speed-demon-rth",
        created_at: new Date(),
        variants: generateVariants("GCB-RTH", ["Den", "Trang"], "FOOTWEAR", 1200000),
    },
    {
        name: "Quần Legging Yoga Co Giãn 4 Chiều",
        description: "Chất liệu cao cấp, ôm sát cơ thể, phù hợp cho các bài tập Yoga và Gym.",
        is_active: true,
        category_ids: ["quan-the-thao", "gym-yoga", "thoi-trang-nu"],
        category_names: ["Quần Thể Thao", "Gym & Yoga", "Nữ"],
        brand: "YogiFit",
        base_price: 350000,
        images: ["https://via.placeholder.com/500?text=quan-legging"],
        slug: "quan-legging-yoga-nu",
        created_at: new Date(),
        variants: generateVariants("QL-YOGA", ["Hong", "Xam"], "CLOTHING", 350000),
    },
    {
        name: "Áo Khoác Gió Winter Warmth Edition",
        description: "Giữ ấm cơ thể trong mùa đông, chống nước nhẹ, thiết kế thời trang.",
        is_active: true,
        category_ids: ["ao-the-thao", "bst-winter", "unisex"],
        category_names: ["Áo Thể Thao", "Winter Warmth", "Unisex"],
        brand: "WinterWear",
        base_price: 550000,
        images: ["https://via.placeholder.com/500?text=ao-khoac-winter"],
        slug: "ao-khoac-gio-winter-warmth",
        created_at: new Date(),
        variants: generateVariants("AK-WIN", ["Den", "XanhReu"], "CLOTHING", 550000),
    },
    {
        name: "Kính Bơi Chuyên Nghiệp Olympic",
        description: "Kính bơi góc nhìn rộng, chống tia UV, đệm mắt silicon mềm mại.",
        is_active: true,
        category_ids: ["phu-kien", "boi-loi", "bst-olympic", "unisex"],
        category_names: ["Phụ Kiện", "Bơi Lội", "Welcome Olympic", "Unisex"],
        brand: "AquaPro",
        base_price: 180000,
        images: ["https://via.placeholder.com/500?text=kinh-boi"],
        slug: "kinh-boi-olympic-pro",
        created_at: new Date(),
        variants: generateVariants("KB-OLY", ["XanhDuong", "Den"], "ACCESSORY", 180000),
    },
    {
        name: "Quần Short Chạy Bộ 2 Lớp",
        description: "Thiết kế 2 lớp có túi đựng điện thoại, vải dù siêu nhẹ.",
        is_active: true,
        category_ids: ["quan-the-thao", "chay-bo", "thoi-trang-nam"],
        category_names: ["Quần Thể Thao", "Chạy Bộ", "Nam"],
        brand: "SpeedUp",
        base_price: 220000,
        images: ["https://via.placeholder.com/500?text=quan-short-chay"],
        slug: "quan-short-chay-bo-nam",
        created_at: new Date(),
        variants: generateVariants("QS-RUN", ["Den"], "CLOTHING", 220000),
    },
    {
        name: "Giày Đá Bóng Pro Striker",
        description: "Đinh dăm TF bám sân cực tốt, da PU mềm mại hỗ trợ cảm giác bóng.",
        is_active: true,
        category_ids: ["giay-the-thao", "bong-da", "thoi-trang-nam"],
        category_names: ["Giày Thể Thao", "Bóng Đá", "Nam"],
        brand: "Striker",
        base_price: 450000,
        images: ["https://via.placeholder.com/500?text=giay-da-bong"],
        slug: "giay-da-bong-pro-striker",
        created_at: new Date(),
        variants: generateVariants("GDB-PRO", ["Bac", "Vang"], "FOOTWEAR", 450000),
    },
    {
        name: "Áo Tanktop Gym Summer Vibes 2025",
        description: "Áo ba lỗ khoét sâu, khoe cơ bắp, chất vải cotton lạnh cực mát.",
        is_active: true,
        category_ids: ["ao-the-thao", "gym-yoga", "bst-summer-2025", "thoi-trang-nam"],
        category_names: ["Áo Thể Thao", "Gym & Yoga", "Summer Vibes 2025", "Nam"],
        brand: "GymSharkFake",
        base_price: 150000,
        images: ["https://via.placeholder.com/500?text=ao-tanktop"],
        slug: "ao-tanktop-summer-2025",
        created_at: new Date(),
        variants: generateVariants("TT-SUM", ["Trang", "DoDo"], "CLOTHING", 150000),
    },
    {
        name: "Combo 3 Đôi Tất Thể Thao",
        description: "Tất dệt kim dày dặn, chống trơn trượt, khử mùi.",
        is_active: true,
        category_ids: ["phu-kien", "chay-bo", "bong-da", "unisex"],
        category_names: ["Phụ Kiện", "Chạy Bộ", "Bóng Đá", "Unisex"],
        brand: "VietSocks",
        base_price: 99000,
        images: ["https://via.placeholder.com/500?text=tat-the-thao"],
        slug: "combo-3-doi-tat-the-thao",
        created_at: new Date(),
        variants: generateVariants("SOCK-03", ["Trang", "Den", "Xam"], "ACCESSORY", 99000),
    },
    {
        name: "Đồ Bơi Nữ Một Mảnh Summer 2025",
        description: "Thiết kế tôn dáng, che khuyết điểm, họa tiết nhiệt đới rực rỡ.",
        is_active: true,
        category_ids: ["ao-the-thao", "boi-loi", "bst-summer-2025", "thoi-trang-nu"],
        category_names: ["Áo Thể Thao", "Bơi Lội", "Summer Vibes 2025", "Nữ"],
        brand: "SeaBreeze",
        base_price: 380000,
        images: ["https://via.placeholder.com/500?text=do-boi-nu"],
        slug: "do-boi-nu-summer-2025",
        created_at: new Date(),
        variants: generateVariants("DB-NU-25", ["HoaTietXanh", "HoaTietDo"], "CLOTHING", 380000),
    }
];