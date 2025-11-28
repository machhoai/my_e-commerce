// src/app/api/seed/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/firebase"; // File config firebase của bạn
import { collection, addDoc } from "firebase/firestore";
import { ProductSchema } from "@/lib/schemas"; // Import schema bạn đã đưa
import { MOCK_PRODUCTS } from "@/lib/mock_data";

export async function GET() {
  try {
    const results = [];

    for (const productRaw of MOCK_PRODUCTS) {
      // 1. VALIDATE: Chắc chắn dữ liệu khớp Schema trước khi đẩy
      // Zod sẽ tự thêm created_at: Date vì trong schema bạn để default
      const cleanData = ProductSchema.parse({
        ...productRaw,
        created_at: new Date() // Ép kiểu Date cho khớp schema
      });

      // 2. INSERT: Đẩy vào collection "products"
      const docRef = await addDoc(collection(db, "products"), cleanData);
      results.push({ name: cleanData.name, id: docRef.id, status: "Success" });
    }

    return NextResponse.json({
      message: "Đã seed data thành công!",
      details: results
    });

  } catch (error: any) {
    console.error("Seed error:", error);
    // Nếu lỗi validation, trả về chi tiết để sửa
    if (error.issues) {
        return NextResponse.json({ error: "Dữ liệu mẫu sai Schema", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}