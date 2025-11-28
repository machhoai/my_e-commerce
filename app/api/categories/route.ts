// src/app/api/categories/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import { Category } from "@/lib/schemas";

export async function GET() {
    try {
        const categoriesRef = collection(db, "categories");
        const snapshot = await getDocs(categoriesRef);

        const categories = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
            const data = doc.data();

            return {
                id: doc.id,
                ...data,
                // Convert Timestamp của Firebase sang Date của JS
                created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at
            } as unknown as Category; // <--- SỬA DÒNG NÀY (Thêm as unknown)
        });

        return NextResponse.json({
            success: true,
            count: categories.length,
            data: categories
        }, { status: 200 });

    } catch (error) {
        console.error("Fetch error:", error);
        return NextResponse.json({ success: false, error: "Lỗi lấy danh sách sản phẩm" }, { status: 500 });
    }
}