import { CarouselPlugin } from "@/components/ui/ImageSlide";
import { fetcher } from "@/fetcher/fetcher";
import { Bell, Menu, Search, ShoppingCart } from "lucide-react";
import Image from "next/image";

export default async function Home() {

    return (
        <div className="">
            <StickyHeader />
            <Header />
            <div className="content pt-[20px]">
                <SwiperSlide />
                <div className="w-full py-3">
                    <CarouselPlugin />
                </div>
            </div>
        </div>
    );
}

const StickyHeader = () => {
    return (
        <div className="flex h-[60px] text-white bg-primary sticky top-0 left-0 w-full p-3 gap-4 justify-between items-center z-50">
            <div><Menu /></div>
            <div className="flex-1">
                <Image src={'https://prod-cdn.pharmacity.io/e-com/images/static-website/pharmacity-logo.svg'} alt="logo" width={100} height={100} className="" />
            </div>
            <div>
                <div className="size-10 bg-white text-black flex justify-center items-center rounded-full p-2">
                    <Bell className="size-full" strokeWidth={1.5} />
                </div>
            </div>
            <div>
                <div className="size-10 bg-white text-black flex justify-center items-center rounded-full p-2">
                    <ShoppingCart className="size-full" strokeWidth={1.5} />
                </div>
            </div>
        </div>
    )
}

const Header = () => {
    return (
        <div className="relative h-[60px] -top-[1px]">
            <Image
                src={'/menu/20240807152307-0-banner-header.avif'}
                alt="menu background"
                fill
                className="absolute -z-10 object-cover object-bottom"
                sizes="100vw"
            />

            <div className="w-full px-3 left-0 absolute -bottom-5 overflow-visible">
                <div className="w-full bg-white border rounded-md flex p-2 gap-2 shadow-sm">
                    <Search />
                    <p className="text-[#727272]">Bạn đang tìm gì hôm nay...</p>
                </div>
            </div>
        </div>
    )
}

const SwiperSlide = () => {
    return (
        <div className="flex overflow-x-auto py-4">
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

const ImageSlider = () => { }



