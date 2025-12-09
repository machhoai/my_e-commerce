import { HeaderWrapper } from "@/components/home/HeaderWrapper";
import { ProductGroup, SwiperSlide } from "@/components/home/HomeComponents";
import { CarouselPlugin } from "@/components/ui/ImageSlide";

// 2. Component cha (Server Component) gọi Wrapper
export default async function Home() {
    const API = "http://localhost:3000/api/products?";

    // Hàm này chạy trên Server, không gây loop
    const getProduct = async (queryString: string) => {
        try {
            // fetch data trực tiếp từ API Route hoặc gọi hàm Service (như bài trước tôi chỉ)
            const res = await fetch(API + queryString, {
                cache: 'no-store' // Đảm bảo dữ liệu mới nhất
            });

            if (!res.ok) return [];

            const json = await res.json();
            return json.data || [];
        } catch (error) {
            console.error("Lỗi fetch:", error);
            return [];
        }
    }

    const flashSaleData = await getProduct("isFlashSale=true");
    const promotionData = await getProduct("promotions=GIFT,DISCOUNT_PERCENT");


    return (
        <div className="">
            {/* Chuyển logic Header vào Client Component */}
            <HeaderWrapper />
            <div className="content bg-gray-100">
                <SwiperSlide />
                <div className="w-full py-3">
                    <CarouselPlugin />
                </div>
                <ProductGroup label="Flash Sale" data={flashSaleData} />
                <ProductGroup label="Ưu đãi ngập tràn" data={promotionData} />
                <ProductGroup label="Top sản phẩm tin dùng" />
                <ProductGroup label="Sản phẩm mới tại Pharmacity" />
            </div>
        </div>
    );
}

// const ProductGroup = ({ label = '', data = [] }: { label: string, data?: Array<any> }) => {
//     console.log(data)
//     return (
//         <div className="flex flex-col gap-4 py-4 bg-white mt-3">
//             <div className="flex justify-between items-end px-3">
//                 <p className="font-bold text-base line-clamp-1">{label}</p>
//                 <p className="text-sm text-blue-500">Xem tất cả</p>
//             </div>
//             <div className="product-list flex gap-4 overflow-x-scroll pb-3 px-3 no-scrollbar">
//                 <ProductItem />
//                 <ProductItem />
//                 <ProductItem />
//                 <ProductItem />
//                 <ProductItem />
//                 <ProductItem />
//                 <ProductItem />
//                 <ProductItem />
//                 <ProductItem />
//                 <ProductItem />
//             </div>
//         </div>
//     )
// }

// const ProductItem = () => {
//     return (
//         <div className="relative p-1">
//             <div className="absolute top-5 -left-1"> {/* Đẩy sang trái -left-2 (8px) */}
//                 <label className="bg-red-700 text-white text-sm px-2 py-1 rounded-e-sm relative shadow-md">

//                     {/* Nội dung label */}
//                     <span className="discount-label">Giảm 20%</span>

//                     {/* --- PHẦN TẠO ĐUÔI GẬP (Tam giác) --- */}
//                     <div className="absolute top-full left-0
//                       border-t-[8px] border-t-red-900
//                       border-l-[8px] border-l-transparent
//                       brightness-75">
//                     </div>
//                 </label>
//             </div>
//             <div className="bg-white flex-shrink-0 h-[330px] w-[178px] rounded-md overflow-hidden shadow-md flex flex-col">
//                 <div className="w-full h-fit max-h-1/2 overflow-hidden flex-shrink-0">
//                     <Image src={"/products/example_product_img.png"} width={640} height={640} className="object-cover w-full aspect-square" alt="" />
//                 </div>
//                 <div className="p-2 flex flex-col justify-between flex-1">
//                     <p className="product-title font-semibold text-sm line-clamp-2">
//                         Gel Dưỡng Ẩm NEUTROGENA  Hydro Boost Water (50g)
//                     </p>
//                     <div>
//                         <p className="base-price text-sm text-[#727272] line-through">389.000&nbsp;₫</p>
//                         <span className="mt-[2px] block h-6 text-base font-bold text-primary">311.200&nbsp;₫/Hộp</span>
//                     </div>
//                     <div className="bg-primary rounded-md text-white py-2 text-center font-bold text-sm">
//                         Chọn sản phẩm
//                     </div>
//                 </div>
//             </div>
//         </div>
//     )
// }