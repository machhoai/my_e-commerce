'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase'; // ĐẢM BẢO ĐƯỜNG DẪN ĐÚNG
import { collection, writeBatch, doc } from 'firebase/firestore';

// --- 1. DEFINITIONS (INTERFACE) ---
export interface FlashSale {
    isActive: boolean;
    startTime: string;
    endTime: string;
    salePrice: number;
}

export interface Promotion {
    title: string;
    type: 'DISCOUNT_PERCENT' | 'DISCOUNT_AMOUNT' | 'GIFT';
    value: number;
}

export interface ProductSpecs {
    Category: string;
    Generic: string;
    Manufacturer: string;
    Uses: string;
    Specifications: string;
    Note?: string;
}

export interface Classification {
    groupName: string;
    options: {
        id: string;
        label: string;
        priceModifier?: number;
    }[];
}

export interface Product {
    _id: string;
    Slug: string;
    Name: string;
    Brand: string;
    Price: number;
    Category: string;
    Images: string[];
    FlashSale?: FlashSale;
    Promotion?: Promotion;
    classification?: Classification[];
    Description: ProductSpecs;
    Describe: string;
}

// --- 2. UTILS ---
function slugify(text: string) {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD') // Bỏ dấu tiếng Việt
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

// --- 3. DATA PREPARATION ---
const createMockData = (): Omit<Product, '_id'>[] => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Danh sách 10 sản phẩm "thủ công" chi tiết
    const detailedProducts: Omit<Product, '_id'>[] = [
        {
            Name: "Panadol Extra with Optizorb",
            Slug: "panadol-extra-with-optizorb",
            Brand: "GSK",
            Price: 180000,
            Category: "Thuốc không kê đơn",
            Images: ["https://placehold.co/600x600?text=Panadol+Extra"],
            Description: {
                Category: "Thuốc giảm đau",
                Generic: "Paracetamol, Caffeine",
                Manufacturer: "GSK (Anh)",
                Uses: "Điều trị đau nhẹ đến vừa và hạ sốt.",
                Specifications: "Hộp 15 vỉ x 12 viên",
                Note: "Không dùng quá liều quy định."
            },
            Describe: "<p>Panadol Extra chứa công nghệ Optizorb giúp giải phóng dược chất nhanh chóng.</p>",
            classification: [
                {
                    groupName: "Quy cách",
                    options: [
                        { id: "box", label: "Hộp 15 vỉ" },
                        { id: "blister", label: "Vỉ lẻ 12 viên", priceModifier: -165000 }
                    ]
                }
            ]
        },
        {
            Name: "Efferalgan 500mg Viên Sủi",
            Slug: "efferalgan-500mg-vien-sui",
            Brand: "UPSA",
            Price: 50000,
            Category: "Thuốc không kê đơn",
            Images: ["https://placehold.co/600x600?text=Efferalgan"],
            FlashSale: {
                isActive: true,
                startTime: yesterday.toISOString(),
                endTime: tomorrow.toISOString(),
                salePrice: 35000
            },
            Description: {
                Category: "Thuốc hạ sốt",
                Generic: "Paracetamol",
                Manufacturer: "UPSA (Pháp)",
                Uses: "Hạ sốt, giảm đau nhanh.",
                Specifications: "Tuýp 16 viên sủi",
            },
            Describe: "<p>Viên sủi dễ uống, tác dụng nhanh, hương chanh dễ chịu.</p>"
        },
        {
            Name: "Nước Rửa Mặt La Roche-Posay Effaclar",
            Slug: "nuoc-rua-mat-la-roche-posay-effaclar",
            Brand: "La Roche-Posay",
            Price: 385000,
            Category: "Dược mỹ phẩm",
            Images: ["https://placehold.co/600x600?text=LRP+Cleanser"],
            classification: [
                {
                    groupName: "Dung tích",
                    options: [
                        { id: "400ml", label: "400ml" },
                        { id: "200ml", label: "200ml", priceModifier: -160000 }
                    ]
                }
            ],
            Description: {
                Category: "Sữa rửa mặt",
                Generic: "Nước khoáng, Zinc PCA",
                Manufacturer: "L'Oreal (Pháp)",
                Uses: "Làm sạch sâu cho da dầu mụn.",
                Specifications: "Chai vòi nhấn",
            },
            Describe: "<p>Gel rửa mặt tạo bọt nhẹ nhàng dành cho da dầu nhạy cảm.</p>"
        },
        {
            Name: "Thực Phẩm Chức Năng Blackmores Omega-3",
            Slug: "blackmores-omega-3-fish-oil",
            Brand: "Blackmores",
            Price: 550000,
            Category: "Thực phẩm chức năng",
            Images: ["https://placehold.co/600x600?text=Omega+3"],
            Promotion: {
                title: "Mua 2 Tặng 1",
                type: "GIFT",
                value: 1
            },
            Description: {
                Category: "Dầu cá",
                Generic: "Omega 3 tự nhiên",
                Manufacturer: "Blackmores (Úc)",
                Uses: "Bổ mắt, tốt cho não bộ và tim mạch.",
                Specifications: "Lọ 400 viên",
            },
            Describe: "<p>Nguồn Omega-3 chất lượng cao từ cá nước lạnh.</p>"
        },
        {
            Name: "Kem Chống Nắng Anessa Perfect UV Milk",
            Slug: "kem-chong-nang-anessa-perfect-uv-milk",
            Brand: "Anessa",
            Price: 550000,
            Category: "Dược mỹ phẩm",
            Images: ["https://placehold.co/600x600?text=Anessa"],
            FlashSale: {
                isActive: true,
                startTime: now.toISOString(),
                endTime: nextWeek.toISOString(),
                salePrice: 480000
            },
            Description: {
                Category: "Kem chống nắng",
                Generic: "Zinc Oxide, Titanium Dioxide",
                Manufacturer: "Shiseido (Nhật Bản)",
                Uses: "Chống nắng phổ rộng, chống nước.",
                Specifications: "Chai 60ml",
            },
            Describe: "<p>Công nghệ Aqua Booster EX giúp lớp màng chống nắng bền vững hơn khi gặp nước.</p>"
        },
        {
            Name: "Viên Ngậm Ho Bảo Thanh",
            Slug: "vien-ngam-ho-bao-thanh",
            Brand: "Hoa Linh",
            Price: 35000,
            Category: "Thuốc không kê đơn",
            Images: ["https://placehold.co/600x600?text=Bao+Thanh"],
            Description: {
                Category: "Trị ho",
                Generic: "Thảo dược",
                Manufacturer: "Dược phẩm Hoa Linh",
                Uses: "Bổ phế, trừ ho, hóa đờm.",
                Specifications: "Hộp 20 viên",
            },
            Describe: "<p>Dạng kẹo ngậm tiện lợi, vị thảo dược ngọt dịu.</p>"
        },
        {
            Name: "Vitamin C DHC Hard Capsule",
            Slug: "vitamin-c-dhc-hard-capsule",
            Brand: "DHC",
            Price: 140000,
            Category: "Thực phẩm chức năng",
            Images: ["https://placehold.co/600x600?text=DHC+VitC"],
            classification: [
                {
                    groupName: "Liệu trình",
                    options: [
                        { id: "60d", label: "60 ngày (120 viên)" },
                        { id: "30d", label: "30 ngày (60 viên)", priceModifier: -60000 },
                        { id: "90d", label: "90 ngày (180 viên)", priceModifier: 70000 }
                    ]
                }
            ],
            Description: {
                Category: "Vitamin",
                Generic: "Vitamin C 1000mg",
                Manufacturer: "DHC (Nhật Bản)",
                Uses: "Tăng đề kháng, sáng da, mờ thâm.",
                Specifications: "Gói zip",
            },
            Describe: "<p>Hàm lượng Vitamin C tương đương 33 quả chanh trong mỗi 2 viên.</p>"
        },
        {
            Name: "Dung Dịch Vệ Sinh Phụ Nữ Dạ Hương",
            Slug: "dung-dich-ve-sinh-da-huong",
            Brand: "Hoa Linh",
            Price: 32000,
            Category: "Chăm sóc cá nhân",
            Images: ["https://placehold.co/600x600?text=Da+Huong"],
            Promotion: {
                title: "Giảm 10%",
                type: "DISCOUNT_PERCENT",
                value: 10
            },
            Description: {
                Category: "Vệ sinh phụ nữ",
                Generic: "Muối, Lô hội, Bạc hà",
                Manufacturer: "Dược phẩm Hoa Linh",
                Uses: "Làm sạch vùng kín nhẹ nhàng.",
                Specifications: "Chai 100ml",
            },
            Describe: "<p>Sản phẩm quốc dân được tin dùng nhiều năm liền.</p>"
        },
        {
            Name: "Sâm Alipas Platinum",
            Slug: "sam-alipas-platinum",
            Brand: "Ecogreen",
            Price: 750000,
            Category: "Sức khỏe nam giới",
            Images: ["https://placehold.co/600x600?text=Alipas"],
            Description: {
                Category: "Sinh lý nam",
                Generic: "Eurycoma Longifolia",
                Manufacturer: "St. Paul Brands (Mỹ)",
                Uses: "Tăng cường testosterone nội sinh.",
                Specifications: "Lọ 30 viên",
            },
            Describe: "<p>Công thức Platinum mới tác dụng nhanh và bền vững hơn.</p>"
        },
        {
            Name: "Băng Cá Nhân Urgo",
            Slug: "bang-ca-nhan-urgo-washproof",
            Brand: "Urgo",
            Price: 20000,
            Category: "Thiết bị y tế",
            Images: ["https://placehold.co/600x600?text=Urgo"],
            Description: {
                Category: "Băng gạc",
                Generic: "Nilon, Gạc",
                Manufacturer: "Urgo (Pháp)",
                Uses: "Bảo vệ vết thương nhỏ.",
                Specifications: "Hộp 30 miếng",
            },
            Describe: "<p>Loại Washproof không thấm nước, độ dính cao.</p>"
        }
    ];

    // Generate thêm 20 sản phẩm nữa để đủ 30
    const categories = ["Thuốc không kê đơn", "Thực phẩm chức năng", "Dược mỹ phẩm", "Chăm sóc cá nhân", "Thiết bị y tế"];
    const brands = ["Pharmacity", "Eucerin", "Vichy", "Traphaco", "Rohto", "Mega We Care"];

    const generatedProducts: Omit<Product, '_id'>[] = Array.from({ length: 20 }).map((_, i) => {
        const id = i + 11;
        const name = `Sản phẩm mẫu ${brands[i % brands.length]} ${id}`;
        const price = (Math.floor(Math.random() * 50) + 1) * 10000; // Giá ngẫu nhiên
        const hasFlashSale = i % 5 === 0; // Cứ 5 sp thì có 1 cái sale

        return {
            Name: name,
            Slug: slugify(name),
            Brand: brands[i % brands.length],
            Price: price,
            Category: categories[i % categories.length],
            Images: [`https://placehold.co/600x600?text=Product+${id}`],
            ...(hasFlashSale ? {
                FlashSale: {
                    isActive: true,
                    startTime: now.toISOString(),
                    endTime: nextWeek.toISOString(),
                    salePrice: price * 0.8 // Giảm 20%
                }
            } : {}),
            Description: {
                Category: "Hàng tổng hợp",
                Generic: "Hoạt chất mẫu",
                Manufacturer: "Việt Nam",
                Uses: "Công dụng đang cập nhật.",
                Specifications: "Hộp tiêu chuẩn",
                Note: "Đọc kỹ hướng dẫn sử dụng trước khi dùng."
            },
            Describe: `<p>Mô tả chi tiết cho sản phẩm <strong>${name}</strong> đang được cập nhật.</p>`
        };
    });

    return [...detailedProducts, ...generatedProducts];
};

// --- 4. COMPONENT ---
export default function SeedPage() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<string>('');

    const handleSeed = async () => {
        setLoading(true);
        setStatus('Đang chuẩn bị dữ liệu...');

        try {
            const products = createMockData();
            const batch = writeBatch(db);
            const collectionRef = collection(db, 'products');

            products.forEach((prod) => {
                // Tạo docRef mới để lấy ID
                const docRef = doc(collectionRef);
                // Gán _id vào data trước khi đẩy lên
                const finalData: Product = { ...prod, _id: docRef.id };
                batch.set(docRef, finalData);
            });

            setStatus('Đang gửi dữ liệu lên Firestore...');
            await batch.commit();

            setStatus(`✅ Đã thêm thành công ${products.length} sản phẩm vào database!`);
        } catch (error) {
            console.error(error);
            setStatus(`❌ Lỗi: ${(error as Error).message}`);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-50">
            <div className="bg-white p-8 rounded shadow-md max-w-md w-full text-center">
                <h1 className="text-2xl font-bold mb-4">Seed Database Tool</h1>
                <p className="text-gray-600 mb-6">
                    Thao tác này sẽ thêm 30 sản phẩm mẫu (bao gồm FlashSale, Promotion, Variations) vào Firestore.
                </p>

                <button
                    onClick={handleSeed}
                    disabled={loading}
                    className={`w-full py-3 px-4 rounded font-semibold text-white transition-colors ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                >
                    {loading ? 'Đang xử lý...' : 'Bắt đầu Seed Data'}
                </button>

                {status && (
                    <div className={`mt-4 p-3 rounded text-sm ${status.includes('❌') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
}