import { db } from "@/lib/firebase"; // Sửa đường dẫn config của bạn
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { Product } from "@/types/Product"; // Interface Product bạn đã có

export async function getProductBySlug(slug: string): Promise<Product | null> {
    try {
        const productsRef = collection(db, "products");

        // Query tìm document có trường 'Slug' trùng với tham số truyền vào
        const q = query(productsRef, where("Slug", "==", slug), limit(1));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return null;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        return {
            _id: doc.id, // Map doc.id vào _id
            ...data,
            created_at: data.created_at?.toDate ? data.created_at.toDate() : new Date()
        } as unknown as Product;

    } catch (error) {
        console.error("Error fetching product by slug:", error);
        throw error;
    }
}