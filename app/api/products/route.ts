// src/app/api/products/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import { Product } from "@/lib/schemas";

export async function GET() {
    try {
        const productsRef = collection(db, "products");
        const snapshot = await getDocs(productsRef);

        const products = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
            const data = doc.data();

            return {
                id: doc.id,
                ...data,
                // Convert Timestamp của Firebase sang Date của JS
                created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at
            } as unknown as Product; // <--- SỬA DÒNG NÀY (Thêm as unknown)
        });

        return NextResponse.json({
            success: true,
            count: products.length,
            data: products
        }, { status: 200 });

    } catch (error) {
        console.error("Fetch error:", error);
        return NextResponse.json({ success: false, error: "Lỗi lấy danh sách sản phẩm" }, { status: 500 });
    }
}