import { getProductBySlug } from "@/services/product";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import { formatPrice } from "@/lib/utils";
import Header from "@/components/product-details/Header";
import { ContactButton, ProductDetailsNavBar } from "@/components/product-details/ProductDetailsComponents";
// import ProductImages from "./_components/ProductImages"; // Client Component (Slide ảnh)
// import AddToCartData from "./_components/AddToCart";     // Client Component (Nút mua)

interface Props {
    params: Promise<{ slug: string }>;
}

// 1. TẠO SEO ĐỘNG (Dynamic Metadata)
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { slug } = await params;
    console.log("slug:", slug);

    const product = await getProductBySlug(slug);

    if (!product) {
        return { title: "Sản phẩm không tồn tại" };
    }

    return {
        title: `${product.Name} | Pharmacity`,
        description: product.Description?.Uses || `Mua ${product.Name} chính hãng, giá tốt.`,
        openGraph: {
            images: product.Images?.[0] ? [product.Images[0]] : [],
        },
    };
}

// 2. PAGE CHÍNH (Server Component)
export default async function ProductDetailPage({ params }: Props) {
    const { slug } = await params;
    // Fetch dữ liệu ngay trên Server
    const product = await getProductBySlug(slug);

    // Nếu không tìm thấy -> Chuyển sang trang 404 của Next.js
    if (!product) {
        return notFound();
    }

    // Logic tính giá hiển thị
    const isFlashSale = product.FlashSale?.isActive;
    const currentPrice = isFlashSale ? product.FlashSale!.salePrice : product.Price;

    return (
        <div className="container mx-auto bg-gray-500 h-full">
            <Header />
            <section className="relative">

            </section>
            <ContactButton />
            <ProductDetailsNavBar />
        </div>
    );
}