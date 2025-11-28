// src/app/api/seed/categories/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { CategorySchema } from "@/lib/schemas";
import { MOCK_ALL_CATEGORIES } from "@/lib/mock_categories";

export async function GET() {
    try {
        const results = [];

        for (const catRaw of MOCK_ALL_CATEGORIES) {
            // 1. Validate dữ liệu bằng Zod Schema
            const cleanData = CategorySchema.parse(catRaw);

            // 2. Tạo Document ID dựa trên Slug luôn cho dễ tìm kiếm và SEO
            // Thay vì để Firebase tự sinh ID (addDoc), ta dùng setDoc để tự đặt ID
            // Ví dụ: ID của "Áo Nam" sẽ là "ao-nam" -> Dễ nhìn trong database
            const docRef = doc(db, "categories", cleanData.slug);

            await setDoc(docRef, cleanData);

            results.push({ name: cleanData.name, id: cleanData.slug, status: "Success" });
        }

        return NextResponse.json({
            message: `Đã seed thành công ${results.length} danh mục!`,
            data: results
        });

    } catch (error: any) {
        console.error("Seed Categories Error:", error);
        if (error.issues) {
            return NextResponse.json({ error: "Dữ liệu không đúng Schema", details: error.issues }, { status: 400 });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}