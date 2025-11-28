// src/lib/mock_data.ts

export const MOCK_PRODUCTS = [
  {
    name: "Áo Hoodie Essential Unisex",
    description: "Chất liệu nỉ bông 350gsm, form boxy rộng rãi, phù hợp cả nam và nữ.",
    is_active: true,
    category_id: "cat_hoodie_01",
    category_name: "Áo Hoodie",
    brand: "CoolMate",
    base_price: 350000,
    images: [
      "https://product.hstatic.net/200000690725/product/hoodie_den_1_4a0e3c.jpg",
      "https://product.hstatic.net/200000690725/product/hoodie_den_2_4a0e3c.jpg"
    ],
    variants: [
      {
        sku: "HOODIE-BK-M",
        size: "M",
        color: "Đen",
        stock_quantity: 50,
        price_modifier: 0,
        variant_image: "https://product.hstatic.net/200000690725/product/hoodie_den_1_4a0e3c.jpg"
      },
      {
        sku: "HOODIE-BK-L",
        size: "L",
        color: "Đen",
        stock_quantity: 30,
        price_modifier: 0
      },
      {
        sku: "HOODIE-GR-M",
        size: "M",
        color: "Xám",
        stock_quantity: 15,
        price_modifier: 20000 // Màu xám đắt hơn 20k
      }
    ],
    slug: "ao-hoodie-essential-unisex"
  },
  {
    name: "Quần Jeans Slimfit",
    description: "Vải Jeans co giãn 4 chiều, màu wash nhẹ.",
    is_active: true,
    category_id: "cat_jeans_02",
    category_name: "Quần Jeans",
    brand: "Levi's Fake",
    base_price: 500000,
    images: [
      "https://example.com/jeans-front.jpg"
    ],
    variants: [
      {
        sku: "JEAN-BLUE-29",
        size: "29",
        color: "Xanh Wash",
        stock_quantity: 100,
        price_modifier: 0
      },
      {
        sku: "JEAN-BLUE-30",
        size: "30",
        color: "Xanh Wash",
        stock_quantity: 90,
        price_modifier: 0
      }
    ],
    slug: "quan-jeans-slimfit"
  }
];