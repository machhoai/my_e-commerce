// src/app/api/products/[slug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getProductBySlug } from "@/services/product";

// Context chứa params dynamic
interface Context {
    params: {
        slug: string;
    };
}

export async function GET(request: NextRequest, context: Context) {
    const { slug } = context.params;

    if (!slug) {
        return NextResponse.json(
            { success: false, error: "Slug is required" },
            { status: 400 }
        );
    }

    try {
        const product = await getProductBySlug(slug);

        if (!product) {
            return NextResponse.json(
                { success: false, error: "Sản phẩm không tồn tại" },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: product
        }, { status: 200 });

    } catch (error) {
        return NextResponse.json(
            { success: false, error: "Lỗi hệ thống khi lấy sản phẩm" },
            { status: 500 }
        );
    }
}