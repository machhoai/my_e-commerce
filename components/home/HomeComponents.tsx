import { formatPrice } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";

export const SwiperSlide = () => {
    return (
        <div className="flex overflow-x-auto py-2 no-scrollbar pt-6 bg-white">
            <SwiperSlideItem label="Tư vấn mua thuốc" />
            <SwiperSlideItem label="Liên hệ dược sĩ" />
            <SwiperSlideItem label="Hệ thống nhà thuốc" />
            <SwiperSlideItem label="Mã giảm giá riêng" />
            <SwiperSlideItem label="Kiểm tra sức khỏe" />
            <SwiperSlideItem label="Chăm da chuẩn" />
            <SwiperSlideItem label="Nhắc thuốc" />
            <SwiperSlideItem label="Lịch sửa P-Xu vàng" />
            <SwiperSlideItem label="Đặt lịch khám" />
            <SwiperSlideItem label="Hồ sơ sức khỏe" />
            <SwiperSlideItem label="Deal hot tháng 12" />
            <SwiperSlideItem label="Chi tiêu sức khỏe" />
        </div>
    )
}

const SwiperSlideItem = ({ label = '' }) => {
    return (
        <div className="p-2 w-fit flex">
            <div className="w-[80px] flex flex-col justify-start items-center text-sm text-[#727272] gap-4">
                <div className="bg-black size-[52px] rounded-md"></div>
                <p className="line-clamp-2 w-fit text-center">{label}</p>
            </div>
        </div>
    )
}

export const ProductGroup = ({ label = '', data = [] }: { label: string, data?: any[] }) => {

    // Render dữ liệu thật thay vì log
    return (
        <div className="flex flex-col gap-4 py-4 bg-white mt-3">
            <div className="flex justify-between items-end px-3">
                <p className="font-bold text-base line-clamp-1">{label}</p>
                <p className="text-sm text-blue-500">Xem tất cả</p>
            </div>
            <div className="product-list flex gap-4 overflow-x-scroll pb-3 px-3 no-scrollbar">
                {data && data.length > 0 ? (
                    data.map((product: any) => (
                        <ProductItem key={product._id} product={product} />
                    ))
                ) : (
                    <p className="px-4 text-gray-500">Đang cập nhật...</p>
                )}
            </div>
        </div>
    )
}

// ProductItem nhận props để hiển thị động
export const ProductItem = ({ product }: { product?: any }) => {
    // Nếu không có product truyền vào thì render khung xương hoặc ẩn
    if (!product) return <div className="p-1">Demo Item</div>;

    return (
        <Link href={`/product-details/${product.Slug}`} className="relative p-1">
            <div className="relative p-1">
                {((product?.FlashSale && product?.FlashSale?.isActive) || (product?.Promotion)) && (
                    <div className="absolute top-5 -left-1"> {/* Đẩy sang trái -left-2 (8px) */}
                        <label className="bg-red-700 text-white text-sm px-2 py-1 rounded-e-sm relative shadow-md">

                            {/* Nội dung label */}
                            {product?.FlashSale &&
                                <span className="discount-label">Giảm {formatPrice(product?.Price - product?.FlashSale?.salePrice)}&nbsp;₫</span>
                            }

                            {product?.Promotion?.type === 'DISCOUNT_PERCENT' &&
                                <span className="discount-label">Giảm {product?.Promotion?.value}%</span>
                            }

                            {product?.Promotion?.type === 'GIFT' &&
                                <span className="discount-label">{product?.Promotion?.title}</span>
                            }

                            {/* --- PHẦN TẠO ĐUÔI GẬP (Tam giác) --- */}
                            <div className="absolute top-full left-0
                       border-t-[8px] border-t-red-900
                       border-l-[8px] border-l-transparent
                       brightness-75">
                            </div>
                        </label>
                    </div>
                )}
                <div className="bg-white flex-shrink-0 h-[330px] w-[178px] rounded-md overflow-hidden shadow-md flex flex-col">
                    <div className="w-full h-fit max-h-1/2 overflow-hidden flex-shrink-0">
                        <Image src={"/products/example_product_img.png"} width={640} height={640} className="object-cover w-full aspect-square" alt="" />
                    </div>
                    <div className="p-2 flex flex-col gap-1 flex-1">
                        <p className="product-title font-semibold text-sm line-clamp-2 flex-1">
                            {product?.Name}
                        </p>
                        <div className="flex-1">
                            {(product?.FlashSale && product?.FlashSale?.isActive) && (
                                <div>
                                    <p className="base-price text-sm text-[#727272] line-through">{formatPrice(product?.Price)}&nbsp;₫</p>
                                    <span className="mt-[2px] block h-6 text-base font-bold text-primary">{formatPrice(product?.FlashSale?.salePrice)}&nbsp;₫/Hộp</span>
                                </div>
                            )}
                            {(product?.Promotion && product?.Promotion?.type === 'DISCOUNT_PERCENT') && (
                                <div>
                                    <p className="base-price text-sm text-[#727272] line-through">{formatPrice(product?.Price)}&nbsp;₫</p>
                                    <span className="mt-[2px] block h-6 text-base font-bold text-primary">{formatPrice(product?.Price - (product?.Price * product?.Promotion?.value) / 100)}&nbsp;₫/Hộp</span>
                                </div>
                            )}
                            {(product?.Promotion && product?.Promotion?.type === 'DISCOUNT_AMOUNT') && (
                                <div>
                                    <p className="base-price text-sm text-[#727272] line-through">{formatPrice(product?.Price)}&nbsp;₫</p>
                                    <span className="mt-[2px] block h-6 text-base font-bold text-primary">{formatPrice(product?.Price - product?.Promotion?.value)}&nbsp;₫/Hộp</span>
                                </div>
                            )}
                            {(product?.Promotion && product?.Promotion?.type === 'GIFT') && (
                                <div>
                                    <p className="base-price text-sm text-[#727272] line-through invisible">{formatPrice(product?.Price)}&nbsp;₫</p>
                                    <span className="mt-[2px] block h-6 text-base font-bold text-primary">{formatPrice(product?.Price)}&nbsp;₫/Hộp</span>
                                </div>
                            )}
                            {(!product?.Promotion && !product?.FlashSale) && (
                                <div>
                                    <p className="base-price text-sm text-[#727272] line-through invisible">{formatPrice(product?.Price)}&nbsp;₫</p>
                                    <span className="mt-[2px] block h-6 text-base font-bold text-primary">{formatPrice(product?.Price)}&nbsp;₫/Hộp</span>
                                </div>
                            )}
                        </div>
                        <div className="bg-primary rounded-md text-white py-2 text-center font-bold text-sm">
                            Chọn sản phẩm
                        </div>
                    </div>
                </div>
            </div>
        </Link>
    )
}