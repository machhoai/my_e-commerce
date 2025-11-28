// src/app/api/seed/sizes/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore"; // Dùng setDoc để tự đặt ID
import { SizeSchema } from "@/lib/schemas";
import { MOCK_SIZES } from "@/lib/mock_size";

export async function GET() {
    try {
        const results = [];

        for (const sizeRaw of MOCK_SIZES) {
            // 1. Validate (Kiểm tra dữ liệu có đúng type enum CLOTHING/FOOTWEAR... không)
            const cleanData = SizeSchema.parse(sizeRaw);

            // 2. Tạo ID duy nhất: lowercase type + name (vd: clothing-xl)
            // Để tránh việc size "L" của quần áo trùng với size "L" của cái gì đó khác (nếu có)
            const docId = `${cleanData.type.toLowerCase()}-${cleanData.name.toLowerCase()}`;

            const docRef = doc(db, "sizes", docId);

            // 3. Lưu vào Firebase
            await setDoc(docRef, cleanData);

            results.push({
                id: docId,
                name: cleanData.name,
                type: cleanData.type,
                status: "Success"
            });
        }

        return NextResponse.json({
            message: `Đã seed thành công ${results.length} sizes!`,
            data: results
        });

    } catch (error: any) {
        console.error("Seed Sizes Error:", error);
        if (error.issues) {
            return NextResponse.json({ error: "Dữ liệu size sai Schema", details: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}