// src/app/api/products/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
    collection,
    getDocs,
    query,
    where,
    QueryConstraint,
    QueryDocumentSnapshot
} from "firebase/firestore";
import { Product } from "@/types/Product";

export async function GET(request: NextRequest) {
    try {
        // 1. Lấy tham số
        const searchParams = request.nextUrl.searchParams;

        const category = searchParams.get("category");
        const brand = searchParams.get("brand");
        const isFlashSale = searchParams.get("isFlashSale");
        const search = searchParams.get("search")?.toLowerCase();
        const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : null;
        const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : null;
        const promotionsParam = searchParams.get("promotions");

        // [NEW] Tham số sort: 'price-asc', 'price-desc', 'name-asc', 'name-desc', 'newest'
        const sort = searchParams.get("sort");

        // 2. Query Firestore (Filter cứng)
        const productsRef = collection(db, "products");
        const constraints: QueryConstraint[] = [];

        if (category) {
            const cate = category.split(',');
            if (cate.length > 0) {
                constraints.push(where("Category", "in", cate));
            }
        }
        if (brand) constraints.push(where("Brand", "==", brand));
        if (isFlashSale === 'true') constraints.push(where("FlashSale.isActive", "==", true));
        if (promotionsParam) {
            // Biến chuỗi "A,B,C" thành mảng ["A", "B", "C"]
            const types = promotionsParam.split(',');

            if (types.length > 0) {
                constraints.push(where("Promotion.type", "in", types));
            }
        }

        const q = query(productsRef, ...constraints);
        const snapshot = await getDocs(q);

        // 3. Map dữ liệu
        let products = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
            const data = doc.data();
            return {
                _id: doc.id, // Lưu ý: Schema của bạn dùng _id
                ...data,
                // Giả sử có trường created_at, nếu không có thì fallback về Date.now()
                created_at: data.created_at?.toDate ? data.created_at.toDate() : new Date()
            } as unknown as Product;
        });

        // 4. Filter Mềm (Search & Range)
        if (search) {
            products = products.filter(p =>
                p.Name.toLowerCase().includes(search) ||
                p.Slug?.toLowerCase().includes(search)
            );
        }

        // Helper lấy giá thực tế (Ưu tiên giá Flash Sale nếu đang active)
        const getRealPrice = (p: Product) => {
            if (p.FlashSale?.isActive && p.FlashSale.salePrice) {
                return p.FlashSale.salePrice;
            }
            return p.Price;
        };

        if (minPrice !== null) {
            products = products.filter(p => getRealPrice(p) >= minPrice);
        }
        if (maxPrice !== null) {
            products = products.filter(p => getRealPrice(p) <= maxPrice);
        }

        // 5. [NEW] Xử lý Sorting
        if (sort) {
            products.sort((a, b) => {
                switch (sort) {
                    case 'price-asc': // Giá tăng dần
                        return getRealPrice(a) - getRealPrice(b);

                    case 'price-desc': // Giá giảm dần
                        return getRealPrice(b) - getRealPrice(a);

                    case 'name-asc': // Tên A-Z (Hỗ trợ tiếng Việt)
                        return a.Name.localeCompare(b.Name, 'vi');

                    case 'name-desc': // Tên Z-A
                        return b.Name.localeCompare(a.Name, 'vi');

                    case 'newest': // Mới nhất (cần trường created_at trong DB)
                        // Ép kiểu về any để truy cập created_at vì nó không có trong interface Product chính thức
                        // Bạn nên thêm created_at?: Date vào interface Product
                        const dateA = (a as any).created_at || 0;
                        const dateB = (b as any).created_at || 0;
                        return new Date(dateB).getTime() - new Date(dateA).getTime();

                    default:
                        return 0;
                }
            });
        }

        // 6. Trả về kết quả
        return NextResponse.json({
            success: true,
            count: products.length,
            data: products
        }, { status: 200 });

    } catch (error) {
        console.error("Fetch error:", error);
        return NextResponse.json({ success: false, error: "Lỗi hệ thống" }, { status: 500 });
    }
}