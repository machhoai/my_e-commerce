// src/app/api/sizes/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, getDocs, QueryDocumentSnapshot } from "firebase/firestore";
import { Size } from "@/lib/schemas";

export async function GET() {
    try {
        const sizesRef = collection(db, "sizes");
        const snapshot = await getDocs(sizesRef);

        const sizes = snapshot.docs.map((doc: QueryDocumentSnapshot) => {
            const data = doc.data();

            return {
                id: doc.id,
                ...data,
                // Convert Timestamp của Firebase sang Date của JS
                created_at: data.created_at?.toDate ? data.created_at.toDate() : data.created_at
            } as unknown as Size; // <--- SỬA DÒNG NÀY (Thêm as unknown)
        });

        return NextResponse.json({
            success: true,
            count: sizes.length,
            data: sizes
        }, { status: 200 });

    } catch (error) {
        console.error("Fetch error:", error);
        return NextResponse.json({ success: false, error: "Lỗi lấy danh sách sản phẩm" }, { status: 500 });
    }
}